-- Make merchant_id the primary key of the whitelist and drop the surrogate uuid.
--
-- The table was created with a `id uuid` primary key and a UNIQUE on
-- merchant_id, which meant every row carried two identities. Nothing used the
-- uuid: the foreign key from qrdd_promo_rules already points at merchant_id,
-- the SQL exporter matches on merchant_id (DD_TABLES.merchants.keyColumns), the
-- bulk upload dedupes on merchant_id, and the audit trigger records
-- merchant_id as the record key. The uuid existed only because the table was
-- scaffolded from a template.
--
-- Keeping it was actively harmful: useDdTable issued its writes against the
-- uuid while every other part of the module reasoned in merchant_id, so the
-- two could drift and a spreadsheet — which has no uuid column — could never
-- address an existing row directly.
--
-- Done now because qrdd_promo_rules is empty mid-import, so re-validating the
-- foreign key is free. On a populated table this would be a much larger job.

begin;

-- The FK depends on the UNIQUE it references, so it goes first and comes back
-- at the end pointing at the new primary key.
alter table public.qrdd_promo_rules
  drop constraint if exists qrdd_promo_rules_merchant_id_fkey;

alter table public.qrdd_merchant_whitelist
  drop constraint if exists qrdd_merchant_whitelist_pkey;

-- Dropping the column rather than leaving it nullable and unused: a column
-- nothing writes and nothing reads is a trap for the next person, who will
-- reasonably assume it means something.
alter table public.qrdd_merchant_whitelist drop column if exists id;

-- Redundant once merchant_id is the primary key — a PK is already unique, and
-- two indexes on the same column is pure write cost.
alter table public.qrdd_merchant_whitelist
  drop constraint if exists qrdd_merchant_whitelist_merchant_id_key;

alter table public.qrdd_merchant_whitelist
  add constraint qrdd_merchant_whitelist_pkey primary key (merchant_id);

-- ON DELETE SET NULL preserved from the original: removing a merchant turns a
-- promo that named it into an all-merchants promo rather than deleting the
-- promo outright. That is DD's behaviour and is not being changed here, though
-- it is worth a second look — silently widening a promo's scope on delete is a
-- surprising default.
alter table public.qrdd_promo_rules
  add constraint qrdd_promo_rules_merchant_id_fkey
  foreign key (merchant_id) references public.qrdd_merchant_whitelist (merchant_id)
  on delete set null;

commit;
