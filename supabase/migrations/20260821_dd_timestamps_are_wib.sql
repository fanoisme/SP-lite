-- Store DD's row timestamps as naive WIB instead of timestamptz.
--
-- DD kept these as spreadsheet wall-clock values in Asia/Jakarta with no zone
-- attached, and every person and system that reads them is in WIB. Modelling
-- them as timestamptz added a zone that was never in the data, and because the
-- database session runs in UTC it actively corrupted the import: the bare
-- string '2026-04-04 11:39:53' — 11:39 in Jakarta — was read as 11:39 UTC and
-- stored as an instant seven hours earlier than it happened. The digits looked
-- right in a listing, which is what made it easy to miss.
--
-- `at time zone 'UTC'` below reads each stored value back at the zone it was
-- (mis)interpreted in, which recovers exactly the wall-clock reading the source
-- file carried. So this both changes the type and repairs the seven-hour error
-- in the rows already loaded.
--
-- The trade-off is deliberate and worth stating: a naive timestamp cannot
-- survive a move to another timezone, and if this data is ever consumed outside
-- WIB the zone will have to be reintroduced. That is the right call here
-- because the downstream MySQL columns are themselves naive DATETIME, so
-- keeping timestamptz would mean converting on every export and getting it
-- wrong once.

alter table public.qrdd_bu_accounts
  alter column created_at type timestamp using created_at at time zone 'UTC',
  alter column updated_at type timestamp using updated_at at time zone 'UTC';

alter table public.qrdd_merchant_whitelist
  alter column created_at type timestamp using created_at at time zone 'UTC',
  alter column updated_at type timestamp using updated_at at time zone 'UTC';

alter table public.qrdd_promo_rules
  alter column created_at type timestamp using created_at at time zone 'UTC',
  alter column updated_at type timestamp using updated_at at time zone 'UTC';

-- now() is an instant, so it still has to be converted — a bare now() would
-- write UTC wall-clock into a column that now means WIB, reintroducing the same
-- seven-hour error for every new row.
alter table public.qrdd_bu_accounts
  alter column created_at set default (now() at time zone 'Asia/Jakarta'),
  alter column updated_at set default (now() at time zone 'Asia/Jakarta');

alter table public.qrdd_merchant_whitelist
  alter column created_at set default (now() at time zone 'Asia/Jakarta'),
  alter column updated_at set default (now() at time zone 'Asia/Jakarta');

alter table public.qrdd_promo_rules
  alter column created_at set default (now() at time zone 'Asia/Jakarta'),
  alter column updated_at set default (now() at time zone 'Asia/Jakarta');

-- Deliberately NOT changed: dd_audit_log.ts and dd_email_log.ts. Those record
-- when something happened rather than describing a business record, they are
-- written only by triggers and the Edge Function, and an audit trail is the one
-- place an unambiguous instant is worth more than a familiar reading. They
-- still display as WIB in the UI.
