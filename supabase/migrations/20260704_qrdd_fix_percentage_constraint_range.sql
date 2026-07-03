-- Allow 0 and 1 (inclusive) for percentage columns — valid business case: 100/0 split
alter table if exists public.qrdd_bu_accounts
  drop constraint if exists qrdd_bu_accounts_percentage1_check,
  drop constraint if exists qrdd_bu_accounts_percentage2_check;

alter table if exists public.qrdd_bu_accounts
  add constraint qrdd_bu_accounts_percentage1_check
    check (percentage1 >= 0::numeric and percentage1 <= 1::numeric),
  add constraint qrdd_bu_accounts_percentage2_check
    check (percentage2 >= 0::numeric and percentage2 <= 1::numeric);
