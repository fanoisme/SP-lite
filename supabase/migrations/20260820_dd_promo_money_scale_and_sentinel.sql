-- Two changes to how promo money is stored.
--
-- 1. Fixed scale. The seven numeric columns were declared bare `numeric`, which
--    in Postgres means arbitrary precision and *no* scale: typing 10 stores
--    exactly `10` and reads back `10`, while 10.5 reads back `10.5`. Amounts
--    then render inconsistently across the app and the SQL export, and a
--    currency column that sometimes shows two decimals and sometimes none is a
--    reporting bug waiting to happen. numeric(18,2) makes 10 store as 10.00.
--
--    18 digits is deliberate headroom: the largest value the data can now hold
--    is the 99999999999.00 sentinel below (13 digits with scale), and a budget
--    figure has no strict ceiling.
--
-- 2. The "unlimited" sentinel moves from 50000000000 to 99999999999.
--
--    It only ever appears in the two discount-cap columns — verified against
--    the DD extract: 28 rows in prm_max_discount, 85 in pl_max_discount, and no
--    other value in any of the seven columns reaches 1e10. So the rewrite below
--    cannot collide with a real amount. The largest genuine figure in the
--    extract is a 1,000,000 minimum transaction.
--
--    A sentinel exists at all because the downstream column is NOT NULL, so
--    "no cap" has to be spelled as a number. That is distinct from
--    max_txn_amount and budget_amount, which are nullable and use a real NULL.

-- Order matters: widen the scale first, so the rewritten sentinel lands in a
-- column that can already hold it with two decimals.
alter table public.qrdd_promo_rules
  alter column prm_discount_value type numeric(18,2),
  alter column prm_max_discount   type numeric(18,2),
  alter column pl_discount_value  type numeric(18,2),
  alter column pl_max_discount    type numeric(18,2),
  alter column min_txn_amount     type numeric(18,2),
  alter column max_txn_amount     type numeric(18,2),
  alter column budget_amount      type numeric(18,2);

-- Carry any already-loaded rows onto the new sentinel. A no-op on an empty
-- table, and re-running is harmless because the old value no longer exists
-- afterwards.
update public.qrdd_promo_rules
   set prm_max_discount = 99999999999
 where prm_max_discount = 50000000000;

update public.qrdd_promo_rules
   set pl_max_discount = 99999999999
 where pl_max_discount = 50000000000;
