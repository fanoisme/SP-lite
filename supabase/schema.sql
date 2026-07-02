-- SP-lite — Supabase schema
--
-- Run this once in your project's SQL Editor (Supabase Dashboard > SQL Editor
-- > New query > paste all of this > Run). Safe to re-run — everything is
-- idempotent (create-if-not-exists / drop-then-create for functions/triggers).

-- ── 1. profiles ───────────────────────────────────────────────────────────
-- One row per auth.users row. `role` drives access to /admin; `is_active`
-- lets an admin disable an account without deleting it.
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text unique,
  full_name text,
  role text not null default 'user' check (role in ('user', 'admin')),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

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

-- ── 3. is_admin() helper, used by RLS policies below ────────────────────
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- ── 4. RLS policies ──────────────────────────────────────────────────────
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

-- A Supabase project has a single Postgres "authenticated" role shared by
-- every signed-in user — GRANT can't tell an admin from a regular user, so
-- column-level privilege escalation (a non-admin setting their own `role`
-- to 'admin') is blocked with a trigger instead of a GRANT.
create or replace function public.prevent_privilege_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- auth.uid() is null when running outside PostgREST's authenticated
  -- context (SQL Editor, service_role, migrations) — those already bypass
  -- RLS and should be able to set role/is_active directly (this is how the
  -- first admin gets bootstrapped). Only block requests that arrive as a
  -- specific logged-in (non-admin) end user.
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

-- ── 5. username -> email lookup, for username/password login ───────────
-- Supabase Auth only signs in by email, so the login form resolves a
-- username to its email through this function before calling
-- signInWithPassword. security definer lets it read auth.users (normally
-- locked down); it only ever returns an email, never a password/hash.
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

-- ── 6. bootstrap your first admin ───────────────────────────────────────
-- There's no service-role key in this static-site setup, so nobody can be
-- made admin via the app itself. After you sign up once through the app,
-- run this once (with your own username) directly in the SQL Editor:
--
--   update public.profiles set role = 'admin' where username = 'your_username';
