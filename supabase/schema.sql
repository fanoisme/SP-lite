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
  is_active boolean not null default false,
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

-- New self-signups are inactive by default — an admin must activate them
-- (and assign a role) before they can sign in. Covers existing installs too.
alter table public.profiles alter column is_active set default false;

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
  where p.username = p_username
  limit 1;
$$;

revoke all on function public.email_for_username(text) from public;
grant execute on function public.email_for_username(text) to anon, authenticated;

-- ── 6b. ensure_profile() — self-heal missing profile rows ─────────────
-- The on_auth_user_created trigger is the primary mechanism, but it doesn't
-- fire reliably for every auth.users insert. The client calls this on profile
-- load; it returns the caller's profile, creating it from auth.users if the
-- trigger missed. profiles then drives activation + access as normal.
create or replace function public.ensure_profile()
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  p public.profiles;
begin
  select * into p from public.profiles where id = auth.uid();
  if found then return p; end if;

  insert into public.profiles (id, username, full_name)
  select
    u.id,
    coalesce(u.raw_user_meta_data ->> 'username', split_part(u.email, '@', 1)),
    u.raw_user_meta_data ->> 'full_name'
  from auth.users u
  where u.id = auth.uid()
  on conflict (id) do nothing
  returning * into p;

  return p;
end;
$$;

revoke all on function public.ensure_profile() from public, anon;
grant execute on function public.ensure_profile() to authenticated;

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
-- the admin panel. Dashboard is granted to all roles (post-login landing).
insert into public.module_access (role, module_id)
select r.name, m.id
from (values ('Admin'), ('QA'), ('ITPM'), ('IT Operations')) as r(name)
cross join (values
  ('dashboard'), ('qris'), ('template-tools'), ('video-frames'), ('admin')
) as m(id)
where not (r.name <> 'Admin' and m.id = 'admin')
on conflict (role, module_id) do nothing;

-- ── 9. bootstrap your first admin ───────────────────────────────────────
-- No service-role key in this static-site setup, so the app itself can't
-- create admins. After you sign up once through the app, run this once (with
-- your own username) directly in the SQL Editor:
--
--   update public.profiles
--   set role = 'Admin', is_active = true
--   where username = 'your_username';
--
-- (signups are inactive by default — is_active = true here unlocks you.)

-- ── 10. QR history (per-user, 14-day retention, cap 50) ──────────────────
-- QRIS generate/parse history. Written through insert_qris_history() (below),
-- which inserts a row then prunes entries older than 14 days or beyond the
-- latest 50 per user. Reads/deletes go direct through RLS (own-row only).
create table if not exists public.qris_history (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles (id) on delete cascade,
  type          text not null check (type in ('emvco','proprietary')),
  qr_value      text not null,
  qr_data_url   text,
  merchant_name text,
  mpan          text,
  merchant_id   text,
  amount        text,
  created_at    timestamptz not null default now()
);

create index if not exists idx_qris_history_user_created
  on public.qris_history (user_id, created_at desc);

alter table public.qris_history enable row level security;

-- Client reads/deletes its own rows. Insert is RPC-only (security definer),
-- so no insert grant or insert policy is needed here.
grant select, delete on public.qris_history to authenticated;

drop policy if exists "qris_history_own_select" on public.qris_history;
create policy "qris_history_own_select" on public.qris_history
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "qris_history_own_delete" on public.qris_history;
create policy "qris_history_own_delete" on public.qris_history
  for delete to authenticated using (auth.uid() = user_id);

-- insert_qris_history(): insert-then-prune in one transaction. Reads auth.uid()
-- itself (RPC is security definer, so RLS is bypassed; we enforce ownership
-- manually). Inserts the new row first, then deletes this user's rows older
-- than 14 days (no row-count cap).
create or replace function public.insert_qris_history(
  p_type          text,
  p_qr_value      text,
  p_qr_data_url   text,
  p_merchant_name text,
  p_mpan          text,
  p_merchant_id   text,
  p_amount        text
) returns public.qris_history
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row  public.qris_history;
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'not authenticated';
  end if;

  insert into public.qris_history
    (user_id, type, qr_value, qr_data_url, merchant_name, mpan, merchant_id, amount)
  values
    (v_user, p_type, p_qr_value, p_qr_data_url, p_merchant_name, p_mpan, p_merchant_id, p_amount)
  returning * into v_row;

  -- Only prune by age — no row-count cap.
  delete from public.qris_history
   where user_id = v_user
     and created_at < now() - interval '14 days';

  return v_row;
end;
$$;

revoke all on function public.insert_qris_history(text, text, text, text, text, text, text) from public, anon;
grant  execute on function public.insert_qris_history(text, text, text, text, text, text, text) to authenticated;

-- ── 11. QR DD Module ────────────────────────────────────────────────────────

create table if not exists public.qrdd_bu_accounts (
  id           uuid primary key default gen_random_uuid(),
  name         text not null unique,
  sof          text not null check (sof in ('PRIME', 'PAYLATER')),
  account1     text not null,
  acctname1    text not null,
  percentage1  numeric(5,4) not null check (percentage1 > 0 and percentage1 < 1),
  account2     text not null,
  acctname2    text not null,
  percentage2  numeric(5,4) not null check (percentage2 > 0 and percentage2 < 1),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint qrdd_bu_accounts_pct_sum check (percentage1 + percentage2 = 1.0000)
);

create unique index if not exists idx_qrdd_bu_accounts_name on public.qrdd_bu_accounts (name);

alter table public.qrdd_bu_accounts enable row level security;
grant select, insert, update, delete on public.qrdd_bu_accounts to authenticated;
create policy "qrdd_bu_accounts_all" on public.qrdd_bu_accounts
  for all to authenticated using (true) with check (true);

create table if not exists public.qrdd_merchant_whitelist (
  id             uuid primary key default gen_random_uuid(),
  merchant_id    text not null unique,
  merchant_name  text not null,
  bu_name        text not null references public.qrdd_bu_accounts (name) on delete restrict,
  status         text not null default 'ACTIVE' check (status in ('ACTIVE', 'INACTIVE')),
  created_by     text not null,
  created_at     timestamptz not null default now(),
  updated_by     text not null,
  updated_at     timestamptz not null default now()
);

create unique index if not exists idx_qrdd_mw_merchant_id on public.qrdd_merchant_whitelist (merchant_id);
create index if not exists idx_qrdd_mw_bu_name on public.qrdd_merchant_whitelist (bu_name);

alter table public.qrdd_merchant_whitelist enable row level security;
grant select, insert, update, delete on public.qrdd_merchant_whitelist to authenticated;
create policy "qrdd_mw_all" on public.qrdd_merchant_whitelist
  for all to authenticated using (true) with check (true);

create table if not exists public.qrdd_promo_rules (
  promo_id          text primary key,
  promo_name        text not null,
  merchant_id       text references public.qrdd_merchant_whitelist (merchant_id) on delete set null,
  bu_name           text not null,
  start_date        date not null,
  end_date          date not null,
  prm_discount_type  text not null check (prm_discount_type in ('PERCENTAGE', 'FIXED')),
  prm_discount_value numeric not null,
  prm_max_discount   numeric not null,
  pl_discount_type   text not null check (pl_discount_type in ('PERCENTAGE', 'FIXED')),
  pl_discount_value  numeric not null,
  pl_max_discount    numeric not null,
  min_txn_amount     numeric not null,
  max_txn_amount     numeric,
  budget_amount      numeric,
  priority          integer not null default 0,
  status            text not null default 'ACTIVE' check (status in ('ACTIVE', 'INACTIVE')),
  created_by        text not null,
  created_at        timestamptz not null default now(),
  updated_by        text not null,
  updated_at        timestamptz not null default now()
);

create index if not exists idx_qrdd_pr_merchant_id on public.qrdd_promo_rules (merchant_id);
create index if not exists idx_qrdd_pr_bu_name on public.qrdd_promo_rules (bu_name);

alter table public.qrdd_promo_rules enable row level security;
grant select, insert, update, delete on public.qrdd_promo_rules to authenticated;
create policy "qrdd_pr_all" on public.qrdd_promo_rules
  for all to authenticated using (true) with check (true);
