-- Add created_by/updated_by audit columns to bu_accounts (was missing)
alter table if exists public.qrdd_bu_accounts
  add column if not exists created_by text,
  add column if not exists updated_by text;

-- Allow NULL in prm/pl discount_type (Not Eligible = NULL)
-- Existing CHECK only allowed PERCENTAGE/FIXED — drop and re-add with IS NULL clause
alter table if exists public.qrdd_promo_rules
  drop constraint if exists qrdd_promo_rules_prm_discount_type_check,
  drop constraint if exists qrdd_promo_rules_pl_discount_type_check;

alter table if exists public.qrdd_promo_rules
  add constraint qrdd_promo_rules_prm_discount_type_check
    check (prm_discount_type is null or prm_discount_type = any(array['PERCENTAGE'::text, 'FIXED'::text])),
  add constraint qrdd_promo_rules_pl_discount_type_check
    check (pl_discount_type is null or pl_discount_type = any(array['PERCENTAGE'::text, 'FIXED'::text]));
