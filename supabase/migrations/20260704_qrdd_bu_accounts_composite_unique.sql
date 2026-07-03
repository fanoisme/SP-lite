-- Guard: warn if merchant_whitelist has data (FK will be dropped)
do $$ begin
  if exists (select 1 from qrdd_merchant_whitelist limit 1) then
    raise warning 'qrdd_merchant_whitelist has % row(s) -- FK qrdd_merchant_whitelist_bu_name_fkey will be dropped; re-add manually after migration',
      (select count(*) from qrdd_merchant_whitelist);
  end if;
end $$;

-- Drop old unique constraint on name only (CASCADE also drops FK qrdd_merchant_whitelist_bu_name_fkey)
alter table if exists public.qrdd_bu_accounts drop constraint if exists qrdd_bu_accounts_name_key cascade;

-- Also drop the old plain index if it still exists
drop index if exists idx_qrdd_bu_accounts_name;

-- Composite unique: same BU name allowed with different SOF/account1
create unique index if not exists idx_qrdd_bu_accounts_name_sof_acct1
  on public.qrdd_bu_accounts (name, sof, account1);

-- ponytail: FK qrdd_merchant_whitelist_bu_name_fkey cannot be recreated at DB level
-- because name is no longer uniquely constrained (only the composite is).
-- Enforce referential integrity at app layer, or re-add when whitelist moves to bu_accounts.id.
