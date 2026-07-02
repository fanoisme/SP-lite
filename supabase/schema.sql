-- SP-lite — Supabase schema
--
-- Run this once in your project's SQL Editor (Supabase Dashboard > SQL Editor
-- > New query > paste all of this > Run). Safe to re-run — everything is
-- idempotent (create-if-not-exists / drop-then-create for functions/triggers).
--
-- Mirrors SO-Platform's RBAC model: profiles (users) + roles + per-role
-- module_access / feature_access + global module_state + per-user_access
-- overrides. Access is resolved client-side by src/lib/access.js (a verbatim
-- port of SO-Platform's pure computeAccess); RLS below gates every write to
-- admins and exposes only what each user needs to compute their own access.

-- ── 1. profiles ───────────────────────────────────────────────────────────
-- One row per auth.users row. `role` (a roles.name value) drives access;
-- `is_active` lets an admin disable an account without deleting it.
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text unique,
  full_name text,
  role text not null default 'QA',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Migrate the old two-value role model (user/admin) onto the SO-Platform role
-- set. Runs once; subsequent runs match no rows.
alter table public.profiles drop constraint if exists profiles_role_check;
update public.profiles set role = 'Admin' where role = 'admin';
update public.profiles set role = 'QA'     where role = 'user';
alter table public.profiles alter column role set default 'QA';

alter table public.profiles add column if not exists updated_at timestamptz not null default now();

-- Postgres also requires a base table-level grant before RLS even gets
-- evaluated — without this, every request fails with "permission denied for
-- table profiles" (42501) regardless of how the RLS policies are set.
grant select, update, delete on public.profiles to authenticated;

-- ── 2. auto-create a profile row on signup ──────────────────────────────
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username, full_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'username', split_part(new.email, '@', 1)),
    new.raw_user_meta_data ->> 'full_name'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── 3. is_admin() helper, used by every RLS policy below ────────────────
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'Admin'
  );
$$;

-- ── 4. updated_at auto-bump (profiles + roles + module_state) ───────────
create or replace function public.bump_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_bump_updated_at on public.profiles;
create trigger profiles_bump_updated_at
  before update on public.profiles
  for each row execute function public.bump_updated_at();

-- ── 5. RLS on profiles ───────────────────────────────────────────────────
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "profiles_select_admin" on public.profiles;
create policy "profiles_select_admin" on public.profiles
  for select using (public.is_admin());

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "profiles_update_admin" on public.profiles;
create policy "profiles_update_admin" on public.profiles
  for update using (public.is_admin()) with check (public.is_admin());

drop policy if exists "profiles_delete_admin" on public.profiles;
create policy "profiles_delete_admin" on public.profiles
  for delete using (public.is_admin());

-- Column-level privilege escalation (a non-admin setting their own `role`
-- to 'Admin') is blocked with a trigger — the shared "authenticated" PG role
-- can't tell an admin from a regular user, so a GRANT can't enforce it.
create or replace function public.prevent_privilege_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- auth.uid() is null outside PostgREST (SQL Editor, service_role) — those
  -- bypass RLS already and may set role/is_active directly (first-admin
  -- bootstrap). Only block requests from a specific logged-in non-admin.
  if auth.uid() is not null and not public.is_admin() then
    new.role := old.role;
    new.is_active := old.is_active;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_guard_privileged_columns on public.profiles;
create trigger profiles_guard_privileged_columns
  before update on public.profiles
  for each row execute function public.prevent_privilege_escalation();

-- ── 6. username -> email lookup, for username/password login ───────────
create or replace function public.email_for_username(p_username text)
returns text
language sql
security definer
stable
set search_path = public
as $$
  select u.email
  from public.profiles p
  join auth.users u on u.id = p.id
  where p.username = p_username and p.is_active
  limit 1;
$$;

revoke all on function public.email_for_username(text) from public;
grant execute on function public.email_for_username(text) to anon, authenticated;

-- ── 7. RBAC tables (roles + module/feature/per-user access) ─────────────
-- Mirror SO-Platform's schema. Access resolution lives in the client
-- (src/lib/access.js); these tables are read by every authenticated user to
-- compute their own set, and written only by admins.

create table if not exists public.roles (
  id          serial primary key,
  name        text unique not null,
  is_system   boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.module_access (
  id          serial primary key,
  role        text not null,
  module_id   text not null,
  created_at  timestamptz not null default now(),
  unique(role, module_id)
);

create table if not exists public.feature_access (
  id          serial primary key,
  role        text not null,
  module_id   text not null,
  feature_id  text not null,
  created_at  timestamptz not null default now(),
  unique(role, module_id, feature_id)
);

create table if not exists public.module_state (
  module_id   text primary key,
  is_enabled  boolean not null default true,
  updated_at  timestamptz not null default now()
);

-- Per-user overrides on top of role. feature_id = '' means whole-module.
-- mode: 'grant' (add) or 'deny' (remove); deny wins; user rows win over role.
create table if not exists public.user_access (
  id          serial primary key,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  module_id   text not null,
  feature_id  text not null default '',
  mode        text not null check (mode in ('grant','deny')),
  created_at  timestamptz not null default now(),
  unique(user_id, module_id, feature_id)
);

alter table public.roles          enable row level security;
alter table public.module_access  enable row level security;
alter table public.feature_access enable row level security;
alter table public.module_state   enable row level security;
alter table public.user_access    enable row level security;

grant select, insert, update, delete on public.roles, public.module_access, public.feature_access, public.module_state, public.user_access to authenticated;
grant usage, select on public.roles_id_seq, public.module_access_id_seq, public.feature_access_id_seq, public.user_access_id_seq to authenticated;

-- updated_at bump for the tables that own one
drop trigger if exists roles_bump_updated_at on public.roles;
create trigger roles_bump_updated_at
  before update on public.roles
  for each row execute function public.bump_updated_at();

drop trigger if exists module_state_bump_updated_at on public.module_state;
create trigger module_state_bump_updated_at
  before update on public.module_state
  for each row execute function public.bump_updated_at();

-- Read: any authenticated user (needed to compute their own access).
-- Write: admins only. user_access select is further scoped to own-or-admin.
drop policy if exists "roles_read" on public.roles;
create policy "roles_read" on public.roles
  for select to authenticated using (true);
drop policy if exists "roles_admin_write" on public.roles;
create policy "roles_admin_write" on public.roles
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "module_access_read" on public.module_access;
create policy "module_access_read" on public.module_access
  for select to authenticated using (true);
drop policy if exists "module_access_admin_write" on public.module_access;
create policy "module_access_admin_write" on public.module_access
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "feature_access_read" on public.feature_access;
create policy "feature_access_read" on public.feature_access
  for select to authenticated using (true);
drop policy if exists "feature_access_admin_write" on public.feature_access;
create policy "feature_access_admin_write" on public.feature_access
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "module_state_read" on public.module_state;
create policy "module_state_read" on public.module_state
  for select to authenticated using (true);
drop policy if exists "module_state_admin_write" on public.module_state;
create policy "module_state_admin_write" on public.module_state
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "user_access_read" on public.user_access;
create policy "user_access_read" on public.user_access
  for select to authenticated using (auth.uid() = user_id or public.is_admin());
drop policy if exists "user_access_admin_write" on public.user_access;
create policy "user_access_admin_write" on public.user_access
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ── 8. seed default roles + module access (idempotent) ──────────────────
insert into public.roles (name, is_system) values
  ('Admin', true),
  ('QA', false),
  ('ITPM', false),
  ('IT Operations', false)
on conflict (name) do nothing;

-- Admin gets every module; other default roles get every tool module except
-- the admin panel.
insert into public.module_access (role, module_id)
select r.name, m.id
from (values ('Admin'), ('QA'), ('ITPM'), ('IT Operations')) as r(name)
cross join (values
  ('qris'), ('template-tools'), ('video-frames'), ('admin')
) as m(id)
where not (r.name <> 'Admin' and m.id = 'admin')
on conflict (role, module_id) do nothing;

-- ── 9. bootstrap your first admin ───────────────────────────────────────
-- No service-role key in this static-site setup, so the app itself can't
-- create admins. After you sign up once through the app, run this once (with
-- your own username) directly in the SQL Editor:
--
--   update public.profiles set role = 'Admin' where username = 'your_username';
