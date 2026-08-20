-- Let a promo's discount channel be genuinely absent.
--
-- qrdd_promo_rules was created with prm_/pl_ discount_value and max_discount
-- NOT NULL, so "this channel is not eligible" had nowhere to live. The type
-- column was already nullable and carries that meaning; the two numeric columns
-- beside it were forced to hold something regardless.
--
-- The DD production extract settles it: 2,514 of 2,546 promos are Paylater-only
-- and carry no Prime figures at all. Writing 0 for those would not be a
-- rounding detail — 0 is a real discount value, and a reader (or the SQL
-- exporter) cannot tell an intentional zero from a channel that was never
-- configured. NULL says the second thing and only the second thing.
--
-- Symmetric on both channels even though every row in today's extract has
-- Paylater populated: a Prime-only promo is equally legitimate and should not
-- be the row that discovers this constraint.

alter table public.qrdd_promo_rules alter column prm_discount_value drop not null;
alter table public.qrdd_promo_rules alter column prm_max_discount   drop not null;
alter table public.qrdd_promo_rules alter column pl_discount_value  drop not null;
alter table public.qrdd_promo_rules alter column pl_max_discount    drop not null;

-- Two rows in the same extract predate DD stamping an actor. 'SYSTEM' is what
-- dd_actor() falls back to for writes made outside a user session, so putting
-- it here would claim a specific provenance the source does not have.
alter table public.qrdd_promo_rules alter column created_by drop not null;
alter table public.qrdd_promo_rules alter column updated_by drop not null;

-- Deliberately unchanged: min_txn_amount, priority and status are populated on
-- every row of the extract and are meaningful for every promo, so they keep
-- their NOT NULL. max_txn_amount and budget_amount were already nullable, which
-- is how "no limit" is expressed — distinct from the discount caps, where the
-- unlimited sentinel is used because the downstream column is NOT NULL.
