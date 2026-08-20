-- Revoke TRUNCATE from anon and authenticated on every table in `public`.
--
-- Supabase's default privileges on the `public` schema hand new tables more
-- than the app ever grants explicitly, TRUNCATE among them. That matters more
-- than it looks: TRUNCATE bypasses RLS entirely *and* bypasses FOR EACH ROW
-- triggers, so no policy and no audit trigger can see or stop it. A single
-- statement would empty `roles` or `module_access` — wiping the access control
-- system — or `dd_audit_log`, defeating its append-only guarantee.
--
-- Nothing in this application truncates anything, so there is no legitimate
-- caller to break. It is not reachable through PostgREST today (no HTTP verb
-- maps to TRUNCATE), but `anon` is the role whose key ships in the public
-- client bundle, so this is defence in depth rather than a fixed exploit.
--
-- Written as a loop over the catalog rather than a list of table names so it
-- covers tables added later: re-running it after a new migration closes the
-- same hole on the new table without anyone remembering to.

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
