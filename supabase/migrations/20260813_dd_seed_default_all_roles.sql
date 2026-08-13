-- Any role holding the dd module but no explicit dd feature rows resolves to
-- ALL features via computeAccess's default-all branch (src/lib/access.js).
-- That silently hands out audit.read, sql.write, tables.update, email.update
-- and both database scopes. Seed the 12 CRUD features explicitly so the
-- default-all branch stops applying to them.
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
