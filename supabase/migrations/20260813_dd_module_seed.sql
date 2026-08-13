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

-- Admin gets all twenty features.
insert into public.feature_access (role, module_id, feature_id)
select 'Admin', 'dd', f.feature_id
from (values
  ('bu-accounts.read'), ('bu-accounts.create'), ('bu-accounts.update'), ('bu-accounts.delete'),
  ('merchants.read'), ('merchants.create'), ('merchants.update'), ('merchants.delete'),
  ('promos.read'), ('promos.create'), ('promos.update'), ('promos.delete'),
  ('audit.read'), ('export.read'),
  ('tables.read'), ('tables.update'),
  ('sql.read'), ('sql.write'),
  ('email.read'), ('email.update')
) as f(feature_id)
where not exists (
  select 1 from public.feature_access fa
  where fa.role = 'Admin' and fa.module_id = 'dd' and fa.feature_id = f.feature_id
);

-- Non-Admin roles inherit whatever they already hold on qrdd, translated to
-- the new feature ids, so nobody has to re-tick twenty boxes in Admin.
-- Only the twelve CRUD features can be inherited — they are all qrdd has.
-- audit.read, export.read, tables.*, sql.* and email.* stay Admin-only until
-- handed out deliberately; they are the powerful ones.
insert into public.feature_access (role, module_id, feature_id)
select fa.role, 'dd',
       replace(replace(fa.feature_id, 'merchant-whitelist.', 'merchants.'),
               'promo-rule.', 'promos.')
from public.feature_access fa
where fa.module_id = 'qrdd'
  and fa.role <> 'Admin'
  and not exists (
    select 1 from public.feature_access x
    where x.role = fa.role
      and x.module_id = 'dd'
      and x.feature_id = replace(replace(fa.feature_id, 'merchant-whitelist.', 'merchants.'),
                                 'promo-rule.', 'promos.')
  );
