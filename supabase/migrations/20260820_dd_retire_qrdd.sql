-- Retire the qrdd module.
--
-- The `dd` module reached parity in Phase 2, so `qrdd`'s routes, views and
-- registry entry are deleted from the front end in the same commit as this
-- migration. What remains is its registration in the access tables, which would
-- otherwise leave every role holding a module that resolves to nothing: the
-- global sidebar builds itself from MODULE_REGISTRY ∩ granted modules, so a
-- stale row is invisible there, but the Admin UI would still list `qrdd` as a
-- grantable module with twelve features behind it.
--
-- The three tables are NOT touched. They keep their qrdd_* storage names and
-- all their data; only the module registration goes. The audit triggers
-- attached to them by 20260813_dd_audit_log.sql are likewise untouched — they
-- belong to `dd`, not to `qrdd`.
--
-- Safe to run before or after the front-end deploy, and safe to re-run.

-- Guard: refuse to strand anybody. Every role holding qrdd must already hold
-- dd, which 20260813_dd_module_seed.sql and its follow-ups arranged by copying
-- the twelve CRUD grants across under the new feature ids. If that has not
-- happened, stop here rather than silently removing someone's only access to
-- these three tables.
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
      'Refusing to retire qrdd: these roles hold qrdd but not dd (%). Run 20260813_dd_module_seed.sql first.',
      stranded;
  end if;
end $$;

delete from public.feature_access where module_id = 'qrdd';
delete from public.module_access  where module_id = 'qrdd';
delete from public.module_state   where module_id = 'qrdd';

-- Per-user overrides pointed at the old module. A deny row here would have kept
-- denying a module nobody can reach, and a grant row would have granted one.
delete from public.user_access where module_id = 'qrdd';
