# DD Module — Phases 2–6: CRUD parity, dashboard, exports, tools, email

2026-08-20

## Context

Phase 1 (`docs/superpowers/specs/2026-08-13-dd-module-phase1-design.md`) shipped
the `dd` module shell: nested routes, DD's second-level sidebar, the two-axis
access model, the schema mapping layer and the audit log. Six of its eight
screens were placeholders.

This spec records Phases 2–6, which were built together rather than in sequence.
The phase boundaries in the Phase 1 spec were a *dependency* order, not a
delivery order: once the shared layer below existed, the five remaining screens
touched disjoint files and had no reason to wait on each other.

Three decisions were taken before building:

- **Phase 6 shipped with SMTP unverified, and it since proved out.** The path
  was built with an honest failure mode rather than hidden; the first real send
  settled it on 2026-08-20. See §6 and §9.
- **`qrdd` is retired in the same commit.** Phase 1 deferred this to "one commit
  after Phase 2 lands". Parity was reached, so it lands here.
- **DD's bulk upload is ported.** Without it `/dd` could not replace `/qrdd`,
  which shipped an Import tab.

---

## 1. The shared layer

Phases 2–6 all needed the same three facts — what a column is, what makes a row
valid, and how to page a table — and each would otherwise have invented its own.
They are declared once.

### 1a. `src/modules/dd/lib/columns.js`

Per-column metadata for the three tables: `type`, `required`, `options` (mirroring
the DB CHECK constraints), `decimals`, `nullable`, `auto`, `textCol`, `fk`. Plus
`primaryKey()`, `coerce()`, `editableColumns()`, `searchableColumns()`, and the
amount sentinels.

Two fields carry the whole weight of the module's correctness:

- **`textCol`** marks a column that is varchar downstream even when every value
  is digits. `merchant_id`, `account1` and `account2` are all in this class. An
  unmarked column exports bare, and a bank account number then reaches Excel as
  scientific notation and MySQL as a number that has quietly dropped its leading
  zero. This is derived metadata, never a heuristic on the value — a heuristic
  would classify `0812` and `812` differently on different days.
- **`auto`** marks a column the app fills in itself. Auto columns are hidden from
  every input surface and excluded from the SQL export's column list.

A discount cap needs an "unlimited" sentinel because the downstream column is
NOT NULL — unlike `max_txn_amount` and `budget_amount`, which are nullable and
use a real NULL. `UNLIMITED_AMOUNT` is `99999999999.00` (see §10); it was
`50000000000.00` until the production import. `isUnlimited()` tests a band rather
than equality so an export taken before that change still reads as Unlimited —
free, since the largest genuine amount in the data is a 1,000,000 minimum
transaction.

### 1b. `src/modules/dd/lib/validate.js`

DD's `api/validate.js` ported. One departure worth stating: DD re-ran the same
checks server-side in `gas/Code.gs`, so a stale tab could not bypass them.
SP-lite has no server tier, so the DB CHECK constraints and foreign keys are the
real gate and these functions are the *explanation* layer — they exist to say
"percentage1 + percentage2 must add up to 1.0000" instead of surfacing a raw
23514.

The BU percentages-sum-to-1.0000 rule is the one rule with no CHECK constraint
behind it. It lives only here, so a write path that skips `validateRow` skips it
entirely.

`validatePromo` treats a channel as eligible when it carries *any* discount type.
DD keyed this off `PERCENTAGE` only, because `FIXED` did not exist in its schema;
`qrdd_promo_rules` allows both.

### 1c. `src/modules/dd/lib/format.js`

Display formatters. Every function is total — a null, an empty string and an
unparseable value all return `EM_DASH` rather than printing `NaN` or
`Invalid Date` into a table cell.

`formatDate` renders a `date` column from its string parts rather than through
`new Date()`, and `isoDay()`-style helpers build "today" from local parts. WIB is
UTC+7, so anything going through `toISOString()` hands Jakarta yesterday's
boundary every evening — which would have shifted every "expiring in 30 days"
window by a day.

### 1d. `src/modules/dd/composables/useDdTable.js`

One server-paged CRUD surface over any of the three tables.

The `qrdd` composables it replaces pulled every row into the browser and paged in
a computed. That is fine at 24 rows and wrong at 24,000, and it also meant the
count on screen was whatever had been fetched rather than what exists. Search,
sort, filter, range and count are all done by Postgres.

- `filters` — equality. `rangeFilters` — `{ column: { gte, lte, gt, lt } }`.
  Both applied server-side, so `total` and the pager always describe the set
  Postgres actually narrowed.
- Responses carry a sequence number; a response older than the newest issued
  request is discarded, so fast typing never leaves a stale page rendered.
- Every ordered query gets a stable tiebreak on the primary key. Without it two
  rows sharing an `updated_at` can swap places between pages and one of them is
  never seen.
- **`bulkUpsert` keys on `DD_TABLES[id].keyColumns`, not on a single column.** A
  BU account is identified by `name` AND `sof`; keying on the local `id` would
  put every spreadsheet row in the insert path and reject all of them as
  duplicates. Updates use `.match()` rather than `.eq()` for the same reason.
  Each row's original index is carried through the whole run so an error raised
  in the third insert batch can still name the line of the file it came from.

**Live change awareness** subscribes to `dd_audit_log` INSERTs filtered to the
table, rather than to the tables themselves — one channel shape serves all three
and the payload already says who did it. Rows whose `actor_id` is the current
user are ignored, since our own writes already reloaded the view. The same person
in a second tab is therefore not flagged: an accepted miss, because the banner
exists to warn about *other* people's edits.

---

## 2. Phase 2 — CRUD parity

`DdBuAccounts.vue`, `DdMerchants.vue`, `DdPromos.vue`, each with a modal form,
plus a shared `DdBulkUpload.vue` and `lib/tabular.js`.

All three follow one shape: header with live count and gated actions, filter bar,
sortable `LiTable`, `LiPagination`, a dismissible stale banner, and an
`LiEmptyState` that distinguishes "no data yet" from "no matches for this filter".

Screen-specific decisions:

- **BU accounts** — the percentage split is the most error-prone thing in the
  module, so the form shows a live running total, red until it lands exactly on
  1.0000, and blocks submit until it does. Percentages accept `0.75`, `75` or
  `75%` and normalise on blur, not per keystroke (per keystroke mangles `7` on
  its way to `75%`). `name` and `sof` stay editable on an existing row but a
  warning appears the moment either changes, because the export matches on them
  and the old row survives downstream.
- **Merchants** — `merchant_id` is read-only on edit: it is the downstream key
  and the target of a foreign key from promo rules.
- **Promos** — the richest form. Channels are hidden entirely rather than
  disabled when a discount type is unset. The "Unlimited" affordance writes
  different things in different places, and that asymmetry is deliberate:
  discount caps write `UNLIMITED_AMOUNT` because the downstream column is NOT
  NULL, while `max_txn_amount` and `budget_amount` write real NULLs because
  theirs are nullable. Duplicate is a first-class row action — it is the
  most-used action on the screen in DD.

**Bulk upload** is a Choose → Preview → Result stepper accepting `.xlsx`, `.csv`
or pasted tab/comma text. Preview is where it earns its keep: headers are mapped
case- and separator-insensitively, every row is validated and classified New /
Update / Error, duplicate keys *within the pasted set* are flagged as errors
(letting the second silently win is how data goes quietly wrong), and Import stays
disabled while any row is in Error unless "skip the bad ones" is explicitly
ticked.

Deliberately not ported: DD's inline status toggle. DD could patch a single cell;
SP-lite's only write path rewrites the row, so a toggle would cost a round-trip
and an audit entry per flick. Status is edited in the form.

---

## 3. Phase 3 — the rich dashboard

`DdDashboard.vue` + `useDdDashboard.js`. Six sections: headline counts, expiring
soon (30 days), needs attention, starting soon (14 days), BU coverage, recent
changes.

- Sections fetch concurrently and fail independently. One broken query degrades
  its own section, not the screen.
- **Every section is gated on `canTable(id, 'read')` and an ungranted table is
  never queried at all.** Rendering a section and hiding it would leak exactly
  what the two-axis model exists to withhold.
- Counts use `head: true`, so Postgres returns a count header and no rows.
- The BU split check compares in ten-thousandths, because `0.7 + 0.3 !== 1` in
  binary and a float comparison would report a fault that does not exist.
- "Needs attention" is the one place rows are fetched uncapped. PostgREST cannot
  express column-vs-column, derived-sum or anti-join predicates, so four of the
  five checks fetch a narrow column set and evaluate in JS. A cap would silently
  hide a broken row, which is the opposite of the section's purpose. If promo
  volume grows past a few thousand, the fix is a Postgres view.
- Links carry `?q=<record key>`, which the three manage screens read on mount to
  seed their *visible* search box — the reader can then see why the list is
  narrowed, and clear it.

---

## 4. Phase 4 — Export Center + SQL export

`lib/sql-export.js` (pure generator), `useDdExport.js`, `DdExport.vue`.

The generator is where a subtle bug corrupts a production database, so it is
pure, separately testable, and hard-fails rather than guessing:

- Timestamp columns are renamed per `DD_TABLES[id].timestamps`.
- `WHERE` clauses use `keyColumns`; the local `id` never appears in generated SQL.
- An empty key column **throws** rather than emitting an unbounded UPDATE or
  DELETE. `buildScript` catches those and names them in a `-- !!` block in the
  header instead of silently dropping the row.
- The cache reset is `SET static_data_refresh_time = NULL`, matching DD's
  `utils/exporters.js` and `gas/Mailer.gs`. An earlier draft of this spec said
  `NOW()`; that is the opposite instruction, since NULL tells the instance its
  static data is stale and must be reloaded whereas a fresh timestamp says the
  cache was just refreshed and may suppress the reload the export exists to
  trigger. One statement per database, however many rows moved.

The delta export derives pending changes from `dd_audit_log` rather than from a
session-scoped list as DD did. Each record's history in the window collapses to
one net action: INSERT then UPDATE is an INSERT; **INSERT then DELETE is nothing
at all**, and no statement is emitted for a row that never survived. A record
renamed in-window is logged under its new key with the old one in `detail`, so
`buildUpdate` also SETs the key columns — otherwise the WHERE matches nothing
downstream.

---

## 5. Phase 5 — Table Explorer + SQL Editor

**Table Explorer** (`/dd/table/:name`) is the raw view: downstream table naming,
every column including stamps, no business formatting, and a `NULL` rendered
distinguishably from an empty string. It is the screen the two-axis model is a
test of — `db.ihybrid_order.update` alone must grant Edit on
`discount_bu_accounts` with no `bu-accounts.*` at all. It still runs
`validateRow`: bypassing the guided forms must not mean bypassing the business
rules.

**SQL Editor.** DD's `useSqlEngine.js` turned out to delegate to AlaSQL rather
than hand-parse, so the grammar was re-implemented; the *model* is ported
faithfully — granted tables are mounted into memory, queries run locally, and an
unmounted table is refused with DD's exact wording, "Not available in this
connection". That refusal is the load-bearing behaviour: an ungranted table is
never fetched, so it cannot be read even by someone who knows its name.

SP-lite must not gain a SQL passthrough. A proxy would run outside RLS and
outside the audit triggers.

Two deliberate improvements on the source:

- Writes apply **row by row** on the affected set, keyed on the local primary
  key, rather than rewriting the whole table as DD did. DD rewrote sheets because
  Apps Script had no other option; a targeted write means `dd_audit_row()`
  records a proper per-column diff instead of one opaque REPLACE.
- `UPDATE` and `DELETE` without a `WHERE` are refused. DD allowed them; a
  whole-table wipe from a typo is not worth porting.

Writes need `sql.write` **and** table-level write access — holding `sql.write`
never grants write on a table the person could not otherwise write. Nothing
applies without a confirmation modal naming the statement, the table and the
affected count.

---

## 6. Phase 6 — scheduled emails

`dd_email_settings` + `dd_email_log` (migration `20260820_dd_email_settings.sql`),
the `dd-send-email` Edge Function, `lib/email-templates.js`, `useDdEmail.js`,
`DdEmail.vue`.

**The transport is new, not ported.** DD sent these three mails with
`MailApp.sendEmail` — through the Apps Script owner's Google Workspace account.
It never spoke SMTP to a company mail server at all. SP-lite has no Apps Script
tier, so the send moves to `mail.allobank.com:587` (submission, STARTTLS) via
`denomailer`. Phase 1 recorded this as a Zimbra dependency inherited from DD; it
is not inherited, and nothing about it is proven by DD having worked.

**Shipped unverified, deliberately.** The Phase 1 spec assumed the host was
internal-only and therefore unroutable from a hosted function. That assumption
was never checked and is wrong: `mail.allobank.com` resolves on public DNS to
`103.161.143.17` and accepts TCP on 587. What remains unproven is whether it
will accept a *session* from an arbitrary internet address — a public IP with an
open port can still refuse to relay or drop anything outside an allowlist, and
Supabase's Edge egress addresses rotate, so an allowlist is not a workable
answer if it does.

The failure mode is therefore honest rather than hidden: connection failures are
classified and returned as a plain "could not reach the mail server", every
attempt writes `dd_email_log` whether it succeeded or not, and a banner on the
screen says nothing has been sent yet. A silent failure would make it look like
the sender's mistake. The first real Send now settles the question in about a
minute.

- `dd_email_log` models its RLS on `dd_audit_log`: `authenticated` gets `select`
  and nothing else, TRUNCATE revoked, only the Edge Function writes.
- pg_cron and pg_net are existence-guarded inside plpgsql bodies, so the
  migration applies on a project without them and the feature degrades to manual
  send. Cron expressions are stored in UTC and rendered back as WIB in the UI.
- The preview renders into a sandboxed `<iframe srcdoc>`, not `v-html`. It is
  generated markup with inline styles meant for a mail client; in the page it
  would join the app's DOM and fight the app's CSS.
- `dd_audit_row()` is **not** attached to `dd_email_settings`. It writes full old
  and new values per changed column, so every wording tweak to a ~3 kB HTML
  wrapper would write two copies of it into the log, and the per-send `last_*`
  stamps would add three rows per mail. Settings edits are consequently
  unaudited — a known gap, not an oversight.

---

## 7. Retiring `qrdd`

Front end: `src/modules/qrdd/` deleted, registry entry and `/qrdd` route removed.
SP-lite's global dashboard used `useQrddDashboard` for four numbers; it now uses
a new `useDdSummary` that gets them from four `head: true` counts instead of
fetching every row of all three tables.

Database (`20260820_dd_retire_qrdd.sql`, mirrored as schema.sql section 14): the
module, feature and per-user access rows go. The three tables and their audit
triggers do not — the triggers belong to `dd`.

The migration **refuses to run** if any role holds `qrdd` without holding `dd`,
rather than silently removing someone's only access to these three tables.
Verified before running: every role's grants had already been carried across by
the Phase 1 seed, including Digital Lending's partial nine.

---

## 8. Verification

No test suite exists. `npm run build` passes. The engine in `lib/sql-engine.js`
was exercised against fixture tables outside the app.

Not yet verified, and needing a person against live data:

1. Each manage screen's create / edit / delete round-trip, and that the audit log
   records what the screen did.
2. Bulk upload of a real spreadsheet for each table, including a file with
   deliberate errors and one with a leading-zero `merchant_id`.
3. The generated SQL against a downstream staging database — in particular the
   `promo_rule` / `promo_info` question in §9.
4. Database-axis gating: grant a role `db.ihybrid_order.read` and nothing else,
   and confirm the dashboard, sidebar and Table Explorer all show
   `discount_bu_accounts` and nothing about `ihybrid_discount`.
5. A real send from the Edge Function, once §9's SMTP question is answered.

## 9. Open questions

**Not open:** `promo_rule` vs `promo_info`. DD maps the promo sheet to
`promo_info`; `lib/schema.js` declares `promo_rule`. This was settled before
Phase 1 — SP-lite is correct and `promo_rule` is right. It is recorded here
because the disagreement is visible in the source of the app being ported and
will otherwise be re-raised every time someone reads DD's `api/schema.js`.

**Genuinely open:**

1. **The `db.*` access axis is not a security boundary.** RLS on the three data
   tables is `using (true)` for every `authenticated` user, so the SQL editor's
   "Not available in this connection" refusal and the Table Explorer's write
   gating are UI conventions. Anyone signed in can reach every one of those
   tables directly with the anon key that ships in the public bundle. This was
   flagged as a decision to take *before* Phase 5 and was not taken; Phase 5
   shipped on the client-side model. Either make it real — per-table RLS keyed
   on the caller's resolved features, or routing the SQL editor through an Edge
   Function — or state plainly that the axis organises the UI and does not
   restrict data. More client-side checks will not close it.
2. **`created_by` / `updated_by` are not exported.** They are `auto`, and unlike
   the timestamps they have no declared downstream name to map to. DD sent them
   as the literal `'SYSTEM'`. If either is NOT NULL without a default downstream,
   the INSERTs fail.
3. **Export timestamps are emitted in UTC**, stated in the generated file's
   header. Worth confirming downstream does not expect WIB.
4. ~~Whether `mail.allobank.com:587` accepts a session from Supabase's Edge
   runtime.~~ **Settled 2026-08-20: it does.** `dd_email_log` id=3 records a
   successful send. Only 587 is open (465 and 25 refuse), STARTTLS is mandatory,
   and no AUTH mechanism is advertised until after the upgrade — so the
   transport is `smtp.ts`, a hand-rolled client, rather than denomailer, whose
   handshake failures are uncatchable and kill the isolate.
5. **The Edge Function imports from `src/`** via relative paths outside
   `supabase/functions/`, which is what keeps the browser preview and the sent
   mail rendering from one source. Supabase's bundler following parent-directory
   imports needs confirming on first deploy.


---

## 10. What loading the real data changed

Phases 2–6 were built against an empty schema. Importing the DD production
extract — 24 BU accounts, 4,098 merchants, 2,546 promos — showed that schema had
been scaffolded rather than modelled, and forced five corrections. Each is
recorded because each was invisible until real rows arrived.

**`merchant_id` is the whitelist's primary key.** The table carried an `id uuid`
alongside a UNIQUE on `merchant_id`, so every row had two identities. Nothing
used the uuid — the promo foreign key, the exporter's `keyColumns`, the bulk
upload's dedupe and the audit record key all address a merchant by
`merchant_id` — but `useDdTable` issued its writes against the uuid. The two
could drift, and a spreadsheet, which has no uuid column, could never address an
existing row.

**A promo's discount channel can be absent.** Both the type and the amount
columns were NOT NULL, so "not eligible" had nowhere to live. 2,514 of 2,546
promos are Paylater-only: writing `0` for Prime would be a real discount value,
indistinguishable from a channel nobody configured. The type columns already
carried `check (… is null or …)` while being NOT NULL — a constraint permitting
a value the column could not hold, so the NOT NULL was never deliberate.

**Money columns are `numeric(18,2)`.** Bare `numeric` in Postgres has no scale:
`10` stored as `10` while `10.5` stored as `10.5`, so amounts rendered
inconsistently across the app and the export.

**Row timestamps are naive WIB, not `timestamptz`.** DD kept them as spreadsheet
wall-clock values in Asia/Jakarta with no zone attached. Modelling them as
`timestamptz` added a zone the data never had, and with the database session in
UTC the import read `'11:39:53'` (WIB) as 11:39:53 UTC — seven hours off, with
the digits still looking correct in a listing, which is what made it easy to
miss. Column defaults and `useDdTable`'s write path both had to follow, or every
new row would reintroduce it. `dd_audit_log.ts` and `dd_email_log.ts` stay
`timestamptz` on purpose: they record when something happened, and for an audit
trail an unambiguous instant beats a familiar reading.

**A static SPA makes schema and code a single deploy.** Changing the merchant
primary key before pushing the matching bundle broke the live site with
`column qrdd_merchant_whitelist.id does not exist`. There is no server tier to
absorb the mismatch — a migration and its front-end change have to ship together.

### On moving bulk data

Do not route a bulk import through an agent's context. The first attempt passed
SQL text through a model and silently normalised a U+00A0 to an ordinary space
in three merchant names; row counts were perfect and the corruption was only
caught by checksumming against the source. `Read` also truncates at ~25k tokens,
so a 400-row file cannot even be relayed whole.

What worked: generate the SQL to disk, keep it **pure ASCII** by emitting any
non-ASCII value as `convert_from(decode('<hex>','hex'),'UTF8')`, run the files
directly in the SQL editor, and verify with a collation-free content
fingerprint — hash each row, sort the hashes, hash the result. Counts cannot
detect a mangled character; the fingerprint can.
