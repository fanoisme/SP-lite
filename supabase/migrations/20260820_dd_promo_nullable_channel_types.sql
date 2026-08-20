-- Finish making a promo's discount channel optional.
--
-- 20260820_dd_promo_nullable_channels.sql dropped NOT NULL from the four
-- channel *amount* columns but left prm_discount_type and pl_discount_type
-- themselves NOT NULL, which made the earlier migration useless for its actual
-- purpose: "not eligible" is expressed by the type being absent, and the two
-- amounts follow from it.
--
-- The original schema contradicted itself. Both columns carried
--   check (prm_discount_type is null or prm_discount_type in ('PERCENTAGE','FIXED'))
-- while being declared NOT NULL — a constraint written to permit a value the
-- column could never hold. The NOT NULL was not deliberate.
--
-- Caught by the DD extract: 2,514 of 2,546 promos are Paylater-only and carry
-- no Prime type at all.

alter table public.qrdd_promo_rules alter column prm_discount_type drop not null;
alter table public.qrdd_promo_rules alter column pl_discount_type  drop not null;

-- Everything else the import writes NULL into was already nullable
-- (merchant_id, the four channel amounts, max_txn_amount, budget_amount,
-- created_by, updated_by). The columns that remain NOT NULL — promo_id,
-- promo_name, bu_name, start_date, end_date, min_txn_amount, priority, status
-- — are populated on every row of the extract and are meaningful for every
-- promo, so they stay as they are.
