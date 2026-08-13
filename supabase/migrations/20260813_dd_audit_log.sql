-- DD module — append-only audit log over the three qrdd_* tables.
--
-- Granularity matches the DD Apps Script app it replaces: INSERT and DELETE
-- write one row per record, UPDATE writes one row per changed column.
--
-- The actor is derived from the session server-side. It is deliberately not
-- taken from the created_by/updated_by columns, which the client sets and a
-- tampered client can therefore forge.

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
