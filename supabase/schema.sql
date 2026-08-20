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
  created_at   timestamp   not null default (now() at time zone 'Asia/Jakarta'),
  updated_at   timestamp   not null default (now() at time zone 'Asia/Jakarta'),
  constraint qrdd_bu_accounts_pct_sum check (percentage1 + percentage2 = 1.0000)
);

create unique index if not exists idx_qrdd_bu_accounts_name on public.qrdd_bu_accounts (name);

alter table public.qrdd_bu_accounts enable row level security;
grant select, insert, update, delete on public.qrdd_bu_accounts to authenticated;
create policy "qrdd_bu_accounts_all" on public.qrdd_bu_accounts
  for all to authenticated using (true) with check (true);

-- merchant_id is the primary key: a whitelist row *is* its merchant id. The
-- table originally carried a surrogate uuid alongside it, which nothing used —
-- the promo foreign key, the SQL exporter's keyColumns, the bulk-upload dedupe
-- and the audit record key all address a merchant by merchant_id. Section 17
-- removes the uuid from a database created before this.
create table if not exists public.qrdd_merchant_whitelist (
  merchant_id    text primary key,
  merchant_name  text not null,
  bu_name        text not null references public.qrdd_bu_accounts (name) on delete restrict,
  status         text not null default 'ACTIVE' check (status in ('ACTIVE', 'INACTIVE')),
  created_by     text not null,
  created_at     timestamp not null default (now() at time zone 'Asia/Jakarta'),
  updated_by     text not null,
  updated_at     timestamp not null default (now() at time zone 'Asia/Jakarta')
);

-- No separate index on merchant_id: the primary key already provides one, and
-- a second would be write cost for nothing.
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
  created_at        timestamp   not null default (now() at time zone 'Asia/Jakarta'),
  updated_by        text not null,
  updated_at        timestamp   not null default (now() at time zone 'Asia/Jakarta')
);

create index if not exists idx_qrdd_pr_merchant_id on public.qrdd_promo_rules (merchant_id);
create index if not exists idx_qrdd_pr_bu_name on public.qrdd_promo_rules (bu_name);

alter table public.qrdd_promo_rules enable row level security;
grant select, insert, update, delete on public.qrdd_promo_rules to authenticated;
create policy "qrdd_pr_all" on public.qrdd_promo_rules
  for all to authenticated using (true) with check (true);

-- The qrdd module registration that used to live here is gone: the module was
-- retired once `dd` reached parity (Phase 2), and seeding it on a fresh run
-- would resurrect a module with no routes and no screens, listing twelve
-- features against code that no longer exists.
--
-- The three tables above stay exactly as they are. They keep their qrdd_*
-- storage names on purpose — renaming them means migrating foreign keys,
-- indexes and RLS policies against live data for no functional gain — and they
-- are now owned by the `dd` module in section 12. Section 20 removes the module
-- rows from a database that was seeded before the retirement.

-- ── 12. DD Module ───────────────────────────────────────────────────────────
-- Phase 1: audit log over the qrdd_* tables. See
-- docs/superpowers/specs/2026-08-13-dd-module-phase1-design.md
--
-- Section 11 (QR DD Module) stays as-is; the qrdd module is retired after
-- Phase 2, not here.

create table if not exists public.dd_audit_log (
  audit_id    bigint generated always as identity primary key,
  ts          timestamptz not null default now(),
  actor       text not null default 'SYSTEM',
  actor_id    uuid,
  action      text not null check (action in ('INSERT', 'UPDATE', 'DELETE', 'REPLACE')),
  target_db   text not null,
  table_id    text not null,
  record_key  text,
  column_name text,
  old_value   text,
  new_value   text,
  detail      text
);

create index if not exists idx_dd_audit_ts     on public.dd_audit_log (ts desc);
create index if not exists idx_dd_audit_table  on public.dd_audit_log (table_id, audit_id desc);
create index if not exists idx_dd_audit_actor  on public.dd_audit_log (actor);
create index if not exists idx_dd_audit_action on public.dd_audit_log (action);

-- Display name of the signed-in user. security definer because profiles is
-- behind RLS. Falls back to the JWT email, then SYSTEM for writes made outside
-- a user session (dashboard SQL editor, a future service-role job).
create or replace function public.dd_actor()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select nullif(btrim(p.full_name), '') from public.profiles p where p.id = auth.uid()),
    nullif(auth.jwt() ->> 'email', ''),
    'SYSTEM'
  );
$$;

-- Downstream key for a row, e.g. 'ANTAVAYA|PRIME' or '1029384'.
create or replace function public.dd_record_key(rec jsonb, keys text[])
returns text
language sql
immutable
as $$
  select string_agg(coalesce(rec ->> k, ''), '|' order by ord)
  from unnest(keys) with ordinality as t(k, ord);
$$;

-- One generic trigger function for every audited table. Table id, target
-- database and key columns arrive as trigger arguments, so auditing a fourth
-- table later is one create-trigger statement and no change here.
create or replace function public.dd_audit_row()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_table_id  text   := tg_argv[0];
  v_target_db text   := tg_argv[1];
  v_keys      text[] := string_to_array(tg_argv[2], ',');
  -- These two change on every single write. Logging them would bury the real
  -- changes; the actor and ts columns already carry the same information.
  v_skip      constant text[] := array['updated_at', 'updated_by'];
  v_actor     text := public.dd_actor();
  v_actor_id  uuid := auth.uid();
  v_old       jsonb;
  v_new       jsonb;
  v_key       text;
  v_old_key   text;
  v_detail    text;
  k           text;
  ov          text;
  nv          text;
begin
  if tg_op = 'DELETE' then
    v_old := to_jsonb(old);
    insert into public.dd_audit_log (actor, actor_id, action, target_db, table_id, record_key)
    values (v_actor, v_actor_id, 'DELETE', v_target_db, v_table_id,
            public.dd_record_key(v_old, v_keys));
    return old;
  end if;

  v_new := to_jsonb(new);
  v_key := public.dd_record_key(v_new, v_keys);

  if tg_op = 'INSERT' then
    insert into public.dd_audit_log (actor, actor_id, action, target_db, table_id, record_key)
    values (v_actor, v_actor_id, 'INSERT', v_target_db, v_table_id, v_key);
    return new;
  end if;

  v_old := to_jsonb(old);
  v_old_key := public.dd_record_key(v_old, v_keys);
  -- A key column is itself editable, so a rename would otherwise file the
  -- history under two unrelated record_keys with no way to join them.
  v_detail := case when v_old_key is distinct from v_key
                   then 'previous key: ' || v_old_key
                   else null end;
  for k in select jsonb_object_keys(v_new) loop
    if k = any(v_skip) then continue; end if;
    ov := v_old ->> k;
    nv := v_new ->> k;
    -- `is distinct from`, not `<>`, so a NULL<->value transition is recorded
    -- rather than silently skipped.
    if ov is distinct from nv then
      insert into public.dd_audit_log
        (actor, actor_id, action, target_db, table_id, record_key, column_name, old_value, new_value, detail)
      values (v_actor, v_actor_id, 'UPDATE', v_target_db, v_table_id, v_key, k, ov, nv, v_detail);
    end if;
  end loop;
  return new;
end;
$$;

-- `after`, not `before`: a write rejected by a CHECK or FK leaves no audit row.
drop trigger if exists trg_dd_audit_bu_accounts on public.qrdd_bu_accounts;
create trigger trg_dd_audit_bu_accounts
  after insert or update or delete on public.qrdd_bu_accounts
  for each row execute function public.dd_audit_row('bu_accounts', 'ihybrid_order', 'name,sof');

drop trigger if exists trg_dd_audit_merchants on public.qrdd_merchant_whitelist;
create trigger trg_dd_audit_merchants
  after insert or update or delete on public.qrdd_merchant_whitelist
  for each row execute function public.dd_audit_row('merchants', 'ihybrid_discount', 'merchant_id');

drop trigger if exists trg_dd_audit_promos on public.qrdd_promo_rules;
create trigger trg_dd_audit_promos
  after insert or update or delete on public.qrdd_promo_rules
  for each row execute function public.dd_audit_row('promos', 'ihybrid_discount', 'promo_id');

-- Append-only: authenticated gets SELECT and nothing else. The only writer is
-- dd_audit_row(), which runs security definer as the table owner and so
-- bypasses RLS. No insert/update/delete policy is created, deliberately.
alter table public.dd_audit_log enable row level security;

grant select on public.dd_audit_log to authenticated;

-- The grant above is not sufficient on its own: Supabase's default privileges
-- on `public` also hand new tables TRUNCATE. TRUNCATE bypasses both RLS and
-- FOR EACH ROW triggers, so without this revoke a single statement would wipe
-- the log unlogged — and truncating an audited table would be an unaudited
-- mass delete. Revoke explicitly so the guarantee is fail-closed rather than
-- resting on the absence of a grant.
revoke insert, update, delete, truncate on public.dd_audit_log        from anon, authenticated;
revoke truncate                          on public.qrdd_bu_accounts       from anon, authenticated;
revoke truncate                          on public.qrdd_merchant_whitelist from anon, authenticated;
revoke truncate                          on public.qrdd_promo_rules       from anon, authenticated;

drop policy if exists "dd_audit_read" on public.dd_audit_log;
create policy "dd_audit_read" on public.dd_audit_log
  for select to authenticated using (true);

-- Distinct actors for the Audit Log filter, so the client never scans the
-- whole table to build a dropdown.
create or replace function public.dd_audit_actors()
returns table (actor text)
language sql
stable
security definer
set search_path = public
as $$
  select distinct a.actor from public.dd_audit_log a order by 1;
$$;

revoke all on function public.dd_audit_actors() from public, anon;
grant execute on function public.dd_audit_actors() to authenticated;

-- Phase 2's stale-data banners subscribe to this. Nothing subscribes yet;
-- it is added now so Phase 2 needs no migration. Guarded because
-- `alter publication ... add table` errors if the table is already a member,
-- which would break re-running schema.sql.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'dd_audit_log'
  ) then
    alter publication supabase_realtime add table public.dd_audit_log;
  end if;
end $$;

-- 12b. DD module registration and access seed.

-- DD module — registration and access seed. Mirrors the pattern used for the
-- qrdd module at the end of schema.sql. Idempotent.

insert into public.module_state (module_id, is_enabled)
values ('dd', true)
on conflict (module_id) do update set is_enabled = true;

insert into public.module_access (role, module_id)
select r.name, 'dd'
from public.roles r
where not exists (
  select 1 from public.module_access ma where ma.role = r.name and ma.module_id = 'dd'
);

-- Admin gets all twenty-eight features.
insert into public.feature_access (role, module_id, feature_id)
select 'Admin', 'dd', f.feature_id
from (values
  ('bu-accounts.read'), ('bu-accounts.create'), ('bu-accounts.update'), ('bu-accounts.delete'),
  ('merchants.read'), ('merchants.create'), ('merchants.update'), ('merchants.delete'),
  ('promos.read'), ('promos.create'), ('promos.update'), ('promos.delete'),
  ('audit.read'), ('export.read'),
  ('tables.read'), ('tables.update'),
  ('sql.read'), ('sql.write'),
  ('email.read'), ('email.update'),
  ('db.ihybrid_order.read'), ('db.ihybrid_order.create'),
  ('db.ihybrid_order.update'), ('db.ihybrid_order.delete'),
  ('db.ihybrid_discount.read'), ('db.ihybrid_discount.create'),
  ('db.ihybrid_discount.update'), ('db.ihybrid_discount.delete')
) as f(feature_id)
where not exists (
  select 1 from public.feature_access fa
  where fa.role = 'Admin' and fa.module_id = 'dd' and fa.feature_id = f.feature_id
);

-- The one-time carry-over of non-Admin roles' qrdd grants onto dd (translating
-- merchant-whitelist.*/promo-rule.* to merchants.*/promos.*) deliberately does
-- NOT live here. It ran once in
-- supabase/migrations/20260813_dd_module_seed.sql. Keeping it out of the
-- re-runnable schema is intentional: it is guarded only by "does this role
-- already have this dd row", so if an admin later revokes, say,
-- merchants.delete from a role in the Admin UI, re-running this file would
-- silently re-derive it from qrdd and hand it straight back. A one-shot
-- migration that already ran cannot do that; a re-runnable schema.sql block
-- could, every time.

-- 12c. Close the default-all gap for any role that holds the dd module but
-- ended up with zero explicit dd feature rows (e.g. it never held qrdd
-- grants for 12b to carry over). computeAccess's default-all branch
-- (src/lib/access.js) hands such a role every dd feature — including
-- audit.read, sql.write, tables.update, email.update and both database
-- scopes — the moment it has zero rows. Seeding the 12 CRUD features closes
-- that branch for it while leaving roles that already have explicit rows
-- (e.g. Digital Lending's 9-feature grant) untouched.
-- One-shot version already applied live: supabase/migrations/20260813_dd_seed_default_all_roles.sql.
insert into public.feature_access (role, module_id, feature_id)
select ma.role, 'dd', f.feature_id
from public.module_access ma
cross join (values
  ('bu-accounts.read'), ('bu-accounts.create'), ('bu-accounts.update'), ('bu-accounts.delete'),
  ('merchants.read'), ('merchants.create'), ('merchants.update'), ('merchants.delete'),
  ('promos.read'), ('promos.create'), ('promos.update'), ('promos.delete')
) as f(feature_id)
where ma.module_id = 'dd'
  and ma.role <> 'Admin'
  and not exists (
    select 1 from public.feature_access x
    where x.role = ma.role and x.module_id = 'dd'
  )
  and not exists (
    select 1 from public.feature_access y
    where y.role = ma.role and y.module_id = 'dd' and y.feature_id = f.feature_id
  );


-- ── 13. Revoke TRUNCATE from anon and authenticated ─────────────────────────
-- Runs last, so it covers every table created above it.
--
-- Supabase's default privileges on `public` hand new tables more than this file
-- grants explicitly, TRUNCATE among them. That matters more than it looks:
-- TRUNCATE bypasses RLS entirely *and* bypasses FOR EACH ROW triggers, so no
-- policy and no audit trigger can see or stop it. One statement would empty
-- `roles` or `module_access` — wiping access control — or `dd_audit_log`,
-- defeating its append-only guarantee.
--
-- Nothing in this application truncates anything, so there is no legitimate
-- caller to break. Not reachable through PostgREST today (no HTTP verb maps to
-- TRUNCATE), but `anon` is the role whose key ships in the public client
-- bundle, so this is defence in depth.
--
-- A loop over the catalog rather than a list of names, so adding a table above
-- does not require remembering to add a revoke here.

do $$
declare
  t record;
begin
  for t in
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'
  loop
    execute format('revoke truncate on public.%I from anon, authenticated', t.relname);
  end loop;
end $$;

-- ── 14. Retire the qrdd module ──────────────────────────────────────────────
-- Section 11 keeps the three tables and no longer registers a `qrdd` module.
-- This clears the registration from a database seeded before the retirement.
-- Mirrors supabase/migrations/20260820_dd_retire_qrdd.sql; see that file for
-- why the guard exists.
do $$
declare
  stranded text;
begin
  select string_agg(ma.role, ', ')
    into stranded
  from public.module_access ma
  where ma.module_id = 'qrdd'
    and not exists (
      select 1 from public.module_access d
      where d.role = ma.role and d.module_id = 'dd'
    );

  if stranded is not null then
    raise exception
      'Refusing to retire qrdd: these roles hold qrdd but not dd (%).', stranded;
  end if;
end $$;

delete from public.feature_access where module_id = 'qrdd';
delete from public.module_access  where module_id = 'qrdd';
delete from public.module_state   where module_id = 'qrdd';
delete from public.user_access    where module_id = 'qrdd';

-- ── 15. service_role reads for the dd-send-email Edge Function ──────────────
-- Supabase's default privileges normally give service_role full access to new
-- public tables; on this project it holds only REFERENCES/TRIGGER/TRUNCATE on
-- everything that predates the DD email work. The function builds its reports
-- with the service-role client, which must see every row regardless of RLS, so
-- the reads it needs are stated explicitly. Read-only, and only these tables.
-- Mirrors supabase/migrations/20260820_dd_service_role_reads.sql.
grant select on public.qrdd_bu_accounts        to service_role;
grant select on public.qrdd_merchant_whitelist to service_role;
grant select on public.qrdd_promo_rules        to service_role;

-- Used by mayUpdateEmail(), which re-derives `email.update` server-side because
-- src/lib/access.js runs in the browser. A failed feature_access read returns
-- null, null is indistinguishable from "zero rows", and zero rows is
-- computeAccess's default-all branch — so a missing grant here silently granted
-- the whole module until the function was changed to deny on read error.
grant select on public.module_state   to service_role;
grant select on public.module_access  to service_role;
grant select on public.feature_access to service_role;
grant select on public.user_access    to service_role;

-- profiles is deliberately NOT granted: the function reads it with the caller's
-- own client so RLS still applies.

-- ── 16. A promo's discount channel may be genuinely absent ──────────────────
-- qrdd_promo_rules was created with the prm_/pl_ value and max columns NOT
-- NULL, so "this channel is not eligible" had nowhere to live. 2,514 of the
-- 2,546 promos in the DD extract are Paylater-only: writing 0 for Prime would
-- be a real discount value, indistinguishable from a channel nobody configured.
-- Mirrors supabase/migrations/20260820_dd_promo_nullable_channels.sql.
alter table public.qrdd_promo_rules alter column prm_discount_value drop not null;
alter table public.qrdd_promo_rules alter column prm_max_discount   drop not null;
alter table public.qrdd_promo_rules alter column pl_discount_value  drop not null;
alter table public.qrdd_promo_rules alter column pl_max_discount    drop not null;
alter table public.qrdd_promo_rules alter column created_by drop not null;
alter table public.qrdd_promo_rules alter column updated_by drop not null;

-- ── 17. merchant_id becomes the whitelist's primary key ─────────────────────
-- For a database created before section 11 was rewritten: drop the unused
-- surrogate uuid and promote merchant_id. Guarded so a from-scratch run, where
-- the column never existed, passes straight through.
-- Mirrors supabase/migrations/20260820_dd_merchant_pk_is_merchant_id.sql.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'qrdd_merchant_whitelist' and column_name = 'id'
  ) then
    alter table public.qrdd_promo_rules       drop constraint if exists qrdd_promo_rules_merchant_id_fkey;
    alter table public.qrdd_merchant_whitelist drop constraint if exists qrdd_merchant_whitelist_pkey;
    alter table public.qrdd_merchant_whitelist drop column id;
    alter table public.qrdd_merchant_whitelist drop constraint if exists qrdd_merchant_whitelist_merchant_id_key;
    alter table public.qrdd_merchant_whitelist add constraint qrdd_merchant_whitelist_pkey primary key (merchant_id);
    alter table public.qrdd_promo_rules
      add constraint qrdd_promo_rules_merchant_id_fkey
      foreign key (merchant_id) references public.qrdd_merchant_whitelist (merchant_id)
      on delete set null;
  end if;
end $$;

drop index if exists public.idx_qrdd_mw_merchant_id;

-- ── 18. A promo's discount TYPE may also be absent ──────────────────────────
-- Section 16 dropped NOT NULL from the four channel amount columns but left the
-- two type columns NOT NULL, which defeated the point: "not eligible" is
-- expressed by the type being absent and the amounts follow from it. Both
-- columns already carried a CHECK reading "… is null or … in (…)" — a
-- constraint permitting a value the column could not hold, so the NOT NULL was
-- never deliberate.
-- Mirrors supabase/migrations/20260820_dd_promo_nullable_channel_types.sql.
alter table public.qrdd_promo_rules alter column prm_discount_type drop not null;
alter table public.qrdd_promo_rules alter column pl_discount_type  drop not null;

-- ── 19. DD row timestamps are naive WIB ─────────────────────────────────────
-- For a database created before section 11 was rewritten. DD kept these as
-- spreadsheet wall-clock values in Asia/Jakarta with no zone attached; storing
-- them as timestamptz added a zone the data never had, and with the session in
-- UTC it read '11:39:53' (WIB) as 11:39:53 UTC — seven hours off, with the
-- digits still looking right. `at time zone 'UTC'` reads each value back at the
-- zone it was misinterpreted in, recovering the source reading exactly.
-- Mirrors supabase/migrations/20260821_dd_timestamps_are_wib.sql.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'qrdd_merchant_whitelist'
      and column_name = 'created_at' and data_type = 'timestamp with time zone'
  ) then
    alter table public.qrdd_bu_accounts
      alter column created_at type timestamp using created_at at time zone 'UTC',
      alter column updated_at type timestamp using updated_at at time zone 'UTC';
    alter table public.qrdd_merchant_whitelist
      alter column created_at type timestamp using created_at at time zone 'UTC',
      alter column updated_at type timestamp using updated_at at time zone 'UTC';
    alter table public.qrdd_promo_rules
      alter column created_at type timestamp using created_at at time zone 'UTC',
      alter column updated_at type timestamp using updated_at at time zone 'UTC';
  end if;
end $$;

-- A bare now() would write UTC wall-clock into a column that means WIB.
alter table public.qrdd_bu_accounts
  alter column created_at set default (now() at time zone 'Asia/Jakarta'),
  alter column updated_at set default (now() at time zone 'Asia/Jakarta');
alter table public.qrdd_merchant_whitelist
  alter column created_at set default (now() at time zone 'Asia/Jakarta'),
  alter column updated_at set default (now() at time zone 'Asia/Jakarta');
alter table public.qrdd_promo_rules
  alter column created_at set default (now() at time zone 'Asia/Jakarta'),
  alter column updated_at set default (now() at time zone 'Asia/Jakarta');
