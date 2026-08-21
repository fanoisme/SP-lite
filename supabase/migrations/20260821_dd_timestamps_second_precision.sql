-- Cut DD's row timestamps to second precision.
--
-- `timestamp` with no precision means microseconds, so a row written by the
-- column default read back as '2026-08-21 09:14:23.123456'. The six-digit tail
-- is visible rather than cosmetic: lib/columns.js rawSelectList() casts these
-- columns to text on purpose so the Table Explorer shows what is stored instead
-- of what a JSON encoder made of it, and the CSV taken off that screen carried
-- the same string.
--
-- Second precision is the shape the rest of the pipeline already assumes. The
-- DD source spreadsheets carry '2026-04-04 11:39:53', the downstream MySQL
-- DATETIME columns are second-precision, and nowWib() in lib/format.js has
-- never written a fraction — only the column default ever did.
--
-- date_trunc rather than a bare cast to timestamp(0): the cast *rounds*, so
-- 09:14:23.678 would become 09:14:24, and a created_at could end up one second
-- ahead of the updated_at written by the same statement. That matters now that
-- the full export reads created_at <> updated_at as "this row has been edited,
-- send an UPDATE" — rounding would invent edits. Truncation cannot.
--
-- Not changed here: dd_audit_log.ts and dd_email_log.ts. They are timestamptz
-- on purpose (see 20260821_dd_timestamps_are_wib.sql) and their microseconds
-- are load-bearing — useDdExport orders the fold by audit_id precisely because
-- rows written by one statement share a ts to the microsecond.

alter table public.qrdd_bu_accounts
  alter column created_at type timestamp(0) using date_trunc('second', created_at),
  alter column updated_at type timestamp(0) using date_trunc('second', updated_at);

alter table public.qrdd_merchant_whitelist
  alter column created_at type timestamp(0) using date_trunc('second', created_at),
  alter column updated_at type timestamp(0) using date_trunc('second', updated_at);

alter table public.qrdd_promo_rules
  alter column created_at type timestamp(0) using date_trunc('second', created_at),
  alter column updated_at type timestamp(0) using date_trunc('second', updated_at);

-- The defaults survive the type change by being rounded into it, which is the
-- one behaviour the paragraph above rejects. Restate them so a new row is
-- truncated like every existing one.

alter table public.qrdd_bu_accounts
  alter column created_at set default date_trunc('second', now() at time zone 'Asia/Jakarta'),
  alter column updated_at set default date_trunc('second', now() at time zone 'Asia/Jakarta');

alter table public.qrdd_merchant_whitelist
  alter column created_at set default date_trunc('second', now() at time zone 'Asia/Jakarta'),
  alter column updated_at set default date_trunc('second', now() at time zone 'Asia/Jakarta');

alter table public.qrdd_promo_rules
  alter column created_at set default date_trunc('second', now() at time zone 'Asia/Jakarta'),
  alter column updated_at set default date_trunc('second', now() at time zone 'Asia/Jakarta');
