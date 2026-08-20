-- Give qrdd_bu_accounts a unique constraint on its actual business key.
--
-- DD_TABLES.bu_accounts.keyColumns has always declared the key as
-- (name, sof) — a business unit is identified downstream by its name and its
-- source of fund, and the local uuid is a surrogate that exists only because
-- PostgREST needs a single column to address a row by. But nothing enforced it,
-- so the same BU could be inserted twice with different uuids and neither the
-- database nor the SQL export would object; the export would then emit two
-- UPDATE statements matching the same downstream row.
--
-- It is also what lets the bulk upload use a real upsert: `on conflict
-- (name, sof)` needs a unique index to conflict against, and without one the
-- writer had to decide insert-versus-update itself by reading the existing keys
-- first — which is exactly the code path that silently truncated at PostgREST's
-- 1000-row cap and tried to insert rows that already existed.
--
-- Safe to add: the 24 live rows are twelve business units across two sources of
-- fund, with no repeats.

create unique index if not exists qrdd_bu_accounts_name_sof_key
  on public.qrdd_bu_accounts (name, sof);
