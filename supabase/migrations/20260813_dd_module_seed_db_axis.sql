-- DD module — the database access axis.
--
-- DD grants raw-table and SQL-editor access per database, independently of the
-- guided-screen menus, so a role can be given ihybrid_order alone. These eight
-- features are the second axis; the twenty from 20260813_dd_module_seed.sql are
-- the first.
--
-- Admin only. Handing a database scope to a non-Admin role is a deliberate act
-- performed in the Admin UI, because it bypasses the guided forms' validation
-- affordances.

insert into public.feature_access (role, module_id, feature_id)
select 'Admin', 'dd', f.feature_id
from (values
  ('db.ihybrid_order.read'), ('db.ihybrid_order.create'),
  ('db.ihybrid_order.update'), ('db.ihybrid_order.delete'),
  ('db.ihybrid_discount.read'), ('db.ihybrid_discount.create'),
  ('db.ihybrid_discount.update'), ('db.ihybrid_discount.delete')
) as f(feature_id)
where not exists (
  select 1 from public.feature_access fa
  where fa.role = 'Admin' and fa.module_id = 'dd' and fa.feature_id = f.feature_id
);
