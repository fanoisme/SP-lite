# DD Module — Phase 1: Foundation, Schema Mapping & Audit Log

2026-08-13

## Context

`C:\Users\22002420\Desktop\Allo\VIBE\DD` ("DD MPM") is an Apps Script + Google
Sheets admin panel. It is being ported to SP-lite on Supabase.

SP-lite already ships a `qrdd` module that covers DD's three core sheets with
CRUD, bulk import, a basic dashboard and XLSX export. The remainder of DD —
audit log, SQL export, Export Center, SQL editor, Table Explorer, the rich
dashboard, and scheduled emails — is not ported.

The decision is to build a **new `dd` module that reaches full DD parity**, then
retire `qrdd`. The three tables keep their `qrdd_*` storage names (renaming them
buys nothing and risks the live data); the module, its routes and all new
database objects use `dd`.

### Phase breakdown

Full DD is ~10,400 lines of Vue plus an audit subsystem, a SQL-generation
engine, and email infrastructure SP-lite has never run. It is decomposed into
six independently shippable phases, each with its own spec, plan and build:

| # | Phase | Depends on |
|---|---|---|
| 1 | **Foundation** — module + route + schema mapping + audit log (table, triggers, screen) | — |
| 2 | Core CRUD parity — BU / Merchant / Promo screens, shared validator, server-side paging, live change awareness | 1 |
| 3 | Rich dashboard — expiring soon, needs attention, starting soon, BU coverage, recent changes | 2 |
| 4 | Export Center + SQL export | 1, 2 |
| 5 | Table Explorer + SQL Editor | 2 |
| 6 | Emails — Edge Function over SMTP, settings table, pg_cron scheduling | 4 |

**This spec covers Phase 1 only.**

`qrdd` stays live and untouched throughout Phase 1. It is retired in a single
commit once Phase 2 lands, so there is never a window without a working screen.

### Decisions taken before this spec

- **Placement** — new `dd` module, `qrdd` retired after Phase 2.
- **Table names** — the three existing tables keep their `qrdd_*` names. No
  rename migration.
- **Downstream mapping** — `ihybrid_order.discount_bu_accounts`,
  `ihybrid_discount.merchant_whitelist`, `ihybrid_discount.promo_info`.
- **SMTP (Phase 6)** — Zimbra, via `denomailer` in a Supabase Edge Function.
  Blocked on confirming the Zimbra host is reachable from the public internet;
  Supabase's Edge runtime cannot reach an internal-only mail server.
- **Audit screen pulled into Phase 1** — it is cheap once the table exists and
  makes Phase 1 immediately useful, since it records every write made through
  the still-live `qrdd` screens.

---

## 1. Module registration

### 1a. Registry entry

**File:** `src/lib/modules.js` — append to `MODULE_REGISTRY`:

```js
{
  id: 'dd', label: 'DD MPM', icon: 'inventory', path: '/dd',
  desc: 'Business units, merchants, promo rules, audit and exports.',
  features: [
    { id: 'bu-accounts.read',   label: 'BU Accounts — Read',   desc: 'View business unit accounts.' },
    { id: 'bu-accounts.create', label: 'BU Accounts — Create', desc: 'Add business unit accounts.' },
    { id: 'bu-accounts.update', label: 'BU Accounts — Update', desc: 'Edit business unit accounts.' },
    { id: 'bu-accounts.delete', label: 'BU Accounts — Delete', desc: 'Delete business unit accounts.' },
    { id: 'merchants.read',   label: 'Merchants — Read',   desc: 'View the merchant whitelist.' },
    { id: 'merchants.create', label: 'Merchants — Create', desc: 'Add merchants to the whitelist.' },
    { id: 'merchants.update', label: 'Merchants — Update', desc: 'Edit whitelisted merchants.' },
    { id: 'merchants.delete', label: 'Merchants — Delete', desc: 'Remove merchants from the whitelist.' },
    { id: 'promos.read',   label: 'Promos — Read',   desc: 'View promo rules.' },
    { id: 'promos.create', label: 'Promos — Create', desc: 'Add promo rules.' },
    { id: 'promos.update', label: 'Promos — Update', desc: 'Edit promo rules.' },
    { id: 'promos.delete', label: 'Promos — Delete', desc: 'Delete promo rules.' },
    { id: 'audit.read',  label: 'Audit Log',   desc: 'Browse who changed what, when.' },
    { id: 'export.read', label: 'Export',      desc: 'Export SQL and XLSX.' },
    { id: 'tables.read',   label: 'Tables — Browse', desc: 'Browse raw tables.' },
    { id: 'tables.update', label: 'Tables — Edit',   desc: 'Edit rows inline in the raw table browser.' },
    { id: 'sql.read',  label: 'SQL — Query', desc: 'Run SELECT queries.' },
    { id: 'sql.write', label: 'SQL — Write',  desc: 'Run INSERT/UPDATE/DELETE that rewrite a table.' },
    { id: 'email.read',   label: 'Email Settings — Read',   desc: 'View scheduled email settings.' },
    { id: 'email.update', label: 'Email Settings — Update', desc: 'Edit and send scheduled emails.' },
  ],
},
```

Twenty features. Rationale for two of the splits:

- `sql.write` is separate from `sql.read` because DD's SQL editor writes back by
  rewriting an entire table. That is a materially more dangerous capability than
  querying and must be revocable on its own.
- `tables.update` is separate from `tables.read` for the same reason: the raw
  table browser bypasses the guided forms and their validation affordances.

Feature ids use DD's vocabulary (`merchants`, `promos`) rather than `qrdd`'s
(`merchant-whitelist`, `promo-rule`). They live under a different `module_id`,
so there is no collision; the seed migration in §4c maps old grants to new.

### 1b. Route

**File:** `src/router/index.js` — insert after the `/qrdd` route:

```js
{
  path: '/dd',
  name: 'dd',
  meta: { module: 'dd', label: 'DD MPM', icon: 'inventory' },
  component: () => import('../modules/dd/views/DdView.vue'),
},
```

The sidebar auto-discovers routes, and `router.beforeEach` already gates on
`to.meta.module` via `canModule()`. No other wiring is required.

---

## 2. Schema mapping layer

**New file:** `src/modules/dd/lib/schema.js`

One module owns every local↔downstream fact. Phases 4–6 read from it exclusively,
so the exporter, the mailer and the UI cannot drift apart.

```js
export const DD_TABLES = {
  bu_accounts: {
    id: 'bu_accounts',
    label: 'BU Accounts',
    local: 'qrdd_bu_accounts',
    targetDb: 'ihybrid_order',
    targetTable: 'discount_bu_accounts',
    keyColumns: ['name', 'sof'],
    timestamps: { created_at: 'created_datetime', updated_at: 'last_modified' },
    textColumns: [],
    readGate: 'bu-accounts.read',
  },
  merchants: {
    id: 'merchants',
    label: 'Merchants',
    local: 'qrdd_merchant_whitelist',
    targetDb: 'ihybrid_discount',
    targetTable: 'merchant_whitelist',
    keyColumns: ['merchant_id'],
    timestamps: { created_at: 'created_time', updated_at: 'updated_time' },
    textColumns: ['merchant_id'],
    readGate: 'merchants.read',
  },
  promos: {
    id: 'promos',
    label: 'Promo Rules',
    local: 'qrdd_promo_rules',
    targetDb: 'ihybrid_discount',
    targetTable: 'promo_info',
    keyColumns: ['promo_id'],
    timestamps: { created_at: 'created_time', updated_at: 'updated_time' },
    textColumns: ['merchant_id'],
    readGate: 'promos.read',
  },
}

// Apply order for a full export. Each database is closed by one cache-reset
// statement against app_instances, emitted once no matter how many rows moved.
export const EXPORT_ORDER = ['bu_accounts', 'merchants', 'promos']
export const CACHE_RESET_TABLE = 'app_instances'
export const CACHE_RESET_COLUMN = 'static_data_refresh_time'

export const TABLE_IDS = Object.keys(DD_TABLES)
export const byLocal = (name) => Object.values(DD_TABLES).find(t => t.local === name)
export const targetDbs = () => [...new Set(Object.values(DD_TABLES).map(t => t.targetDb))]
```

Three facts here are easy to get wrong later and are the reason this file exists
in Phase 1 rather than Phase 4:

- **Timestamp column renames.** SP-lite stores `created_at` / `updated_at`, but
  downstream `discount_bu_accounts` expects `created_datetime` / `last_modified`
  while the other two expect `created_time` / `updated_time`.
- **Text columns.** `merchant_id` is varchar downstream, so it must always
  export quoted (`"1029384"`), never as a bare number.
- **Key columns.** `UPDATE` and `DELETE` statements identify a row by its
  downstream key, not by SP-lite's surrogate `id` — a business unit is matched
  on `name AND sof`, which does not exist as a unique constraint locally.

Phase 1 only consumes `label`, `local`, `targetDb` and `keyColumns` (the audit
triggers and the Audit Log screen). The rest is declared now so Phase 4 has a
single place to read from, and is otherwise unused.

---

## 3. Audit log

### 3a. Object naming

New database objects use the `dd_` prefix (`dd_audit_log`, `dd_actor()`,
`dd_audit_row()`). The decision to keep `qrdd_*` applies to the three **existing**
tables, where a rename means migrating foreign keys, indexes and RLS policies
against live data for no functional gain. A brand-new table carries no such
cost, so it takes the name of the module it belongs to.

### 3b. Table

```sql
create table if not exists public.dd_audit_log (
  audit_id    bigint generated always as identity primary key,
  ts          timestamptz not null default now(),
  actor       text not null default 'SYSTEM',
  actor_id    uuid,
  action      text not null check (action in ('INSERT', 'UPDATE', 'DELETE', 'REPLACE')),
  target_db   text not null,
  table_id    text not null,
  record_key  text,
  column_name text,
  old_value   text,
  new_value   text,
  detail      text
);

create index if not exists idx_dd_audit_ts     on public.dd_audit_log (ts desc);
create index if not exists idx_dd_audit_table  on public.dd_audit_log (table_id, audit_id desc);
create index if not exists idx_dd_audit_actor  on public.dd_audit_log (actor);
create index if not exists idx_dd_audit_action on public.dd_audit_log (action);
```

`audit_id` is a monotonically increasing identity, which doubles as the change
marker Phase 2 polls if Realtime is ever unavailable.

Column semantics match DD's `audit_log` sheet 1:1 (`AUDIT_HEADERS` in
`gas/Code.gs`), with two additions: `actor_id` (the `auth.users` uuid, so an
audit row survives a display-name change) and `target_db` stored explicitly
rather than derived from a `DB_GROUPS` lookup at read time.

### 3c. Granularity

Matching DD exactly:

| Operation | Rows written |
|---|---|
| `INSERT` | one row per record; `column_name`, `old_value`, `new_value` null |
| `DELETE` | one row per record; same nulls |
| `UPDATE` | **one row per changed column**, carrying `old_value` → `new_value` |
| `REPLACE` | one row per bulk rewrite, with a count in `detail` (written by Phase 5's SQL editor; the action is allowed by the CHECK constraint now so Phase 5 needs no migration) |

`updated_at` and `updated_by` are excluded from `UPDATE` diffs. They change on
every single write, and including them would bury the real changes under noise.
`created_at` / `created_by` are not excluded — if either ever changes, that is
worth seeing.

### 3d. Actor resolution

```sql
create or replace function public.dd_actor()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select nullif(btrim(p.full_name), '') from public.profiles p where p.id = auth.uid()),
    nullif(auth.jwt() ->> 'email', ''),
    'SYSTEM'
  );
$$;
```

The actor is derived server-side from the session, never accepted from the
client. This is a deliberate departure from the `created_by` / `updated_by`
columns on the existing tables, which the `qrdd` composables set from
`profile.full_name` in the browser — a tampered client can write anything it
likes into those. The audit log cannot be forged the same way.

Fallback chain: profile display name → JWT email → `SYSTEM`. The last case
covers writes made outside a user session (SQL Editor in the Supabase
dashboard, a future service-role job).

### 3e. Record key helper

```sql
create or replace function public.dd_record_key(rec jsonb, keys text[])
returns text
language sql
immutable
as $$
  select string_agg(coalesce(rec ->> k, ''), '|' order by ord)
  from unnest(keys) with ordinality as t(k, ord);
$$;
```

Produces `ANTAVAYA|PRIME` for a BU account and `1029384` for a merchant.

### 3f. Trigger function

One generic function serves all three tables. The table id, target database and
key columns arrive as trigger arguments, so attaching a fourth table later is a
single `create trigger` statement with no change here.

```sql
create or replace function public.dd_audit_row()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_table_id  text   := tg_argv[0];
  v_target_db text   := tg_argv[1];
  v_keys      text[] := string_to_array(tg_argv[2], ',');
  v_skip      constant text[] := array['updated_at', 'updated_by'];
  v_actor     text := public.dd_actor();
  v_actor_id  uuid := auth.uid();
  v_old       jsonb;
  v_new       jsonb;
  v_key       text;
  k           text;
  ov          text;
  nv          text;
begin
  if tg_op = 'DELETE' then
    v_old := to_jsonb(old);
    insert into public.dd_audit_log (actor, actor_id, action, target_db, table_id, record_key)
    values (v_actor, v_actor_id, 'DELETE', v_target_db, v_table_id,
            public.dd_record_key(v_old, v_keys));
    return old;
  end if;

  v_new := to_jsonb(new);
  v_key := public.dd_record_key(v_new, v_keys);

  if tg_op = 'INSERT' then
    insert into public.dd_audit_log (actor, actor_id, action, target_db, table_id, record_key)
    values (v_actor, v_actor_id, 'INSERT', v_target_db, v_table_id, v_key);
    return new;
  end if;

  v_old := to_jsonb(old);
  for k in select jsonb_object_keys(v_new) loop
    if k = any(v_skip) then continue; end if;
    ov := v_old ->> k;
    nv := v_new ->> k;
    if ov is distinct from nv then
      insert into public.dd_audit_log
        (actor, actor_id, action, target_db, table_id, record_key, column_name, old_value, new_value)
      values (v_actor, v_actor_id, 'UPDATE', v_target_db, v_table_id, v_key, k, ov, nv);
    end if;
  end loop;
  return new;
end;
$$;
```

`is distinct from` rather than `<>` so a NULL↔value transition is recorded
rather than silently skipped.

An `UPDATE` that changes nothing but `updated_at` writes no audit rows at all,
which is correct: nothing was changed.

### 3g. Triggers

```sql
drop trigger if exists trg_dd_audit_bu_accounts on public.qrdd_bu_accounts;
create trigger trg_dd_audit_bu_accounts
  after insert or update or delete on public.qrdd_bu_accounts
  for each row execute function public.dd_audit_row('bu_accounts', 'ihybrid_order', 'name,sof');

drop trigger if exists trg_dd_audit_merchants on public.qrdd_merchant_whitelist;
create trigger trg_dd_audit_merchants
  after insert or update or delete on public.qrdd_merchant_whitelist
  for each row execute function public.dd_audit_row('merchants', 'ihybrid_discount', 'merchant_id');

drop trigger if exists trg_dd_audit_promos on public.qrdd_promo_rules;
create trigger trg_dd_audit_promos
  after insert or update or delete on public.qrdd_promo_rules
  for each row execute function public.dd_audit_row('promos', 'ihybrid_discount', 'promo_id');
```

`after` rather than `before`, so a write rejected by a CHECK constraint or a
foreign key leaves no audit row behind.

### 3h. Append-only RLS

```sql
alter table public.dd_audit_log enable row level security;

grant select on public.dd_audit_log to authenticated;

drop policy if exists "dd_audit_read" on public.dd_audit_log;
create policy "dd_audit_read" on public.dd_audit_log
  for select to authenticated using (true);
```

`authenticated` receives `SELECT` and nothing else — no `INSERT`, `UPDATE` or
`DELETE` grant exists, and no policy for those commands is created. The only
writer is `dd_audit_row()`, which runs `security definer` as the table owner and
therefore bypasses RLS.

The consequence is that the log is append-only for every application user: it
cannot be edited or quietly pruned from the browser, which is what makes it
worth trusting. Read access is not further restricted at the row level; it is
gated at the application layer by the `dd` module plus the `audit.read` feature.

### 3i. Realtime publication

```sql
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'dd_audit_log'
  ) then
    alter publication supabase_realtime add table public.dd_audit_log;
  end if;
end $$;
```

Wrapped in the existence check because `alter publication ... add table` errors
if the table is already a member, which would break re-running `schema.sql`.

Nothing in Phase 1 subscribes to this. It is added now because Phase 2's
stale-data banners need it, and adding it later means another migration.
Supabase Realtime replaces DD's 15-second `getRevision` poll — a genuine
improvement over the source, since Apps Script could not push.

### 3j. Actors RPC

The Audit Log screen's actor filter needs a distinct list. Fetching it
client-side would mean scanning the whole table.

```sql
create or replace function public.dd_audit_actors()
returns table (actor text)
language sql
stable
security definer
set search_path = public
as $$
  select distinct a.actor from public.dd_audit_log a order by 1;
$$;

revoke all on function public.dd_audit_actors() from public, anon;
grant execute on function public.dd_audit_actors() to authenticated;
```

`select distinct` over a growing table is acceptable at the scale this log will
reach in the near term (thousands of rows, backed by `idx_dd_audit_actor`). If
it becomes slow, the fix is a `loose indexscan` CTE or a small materialised
actors table — noted, not built.

---

## 4. Migrations

Two new migration files, plus an idempotent mirror appended to `schema.sql`, in
keeping with the existing convention.

### 4a. `supabase/migrations/20260813_dd_audit_log.sql`

Everything in §3: table, indexes, `dd_actor()`, `dd_record_key()`,
`dd_audit_row()`, the three triggers, RLS, the publication guard, and
`dd_audit_actors()`.

### 4b. `supabase/migrations/20260813_dd_module_seed.sql`

Registers the module and seeds access, following the pattern already used for
`qrdd` at the end of `schema.sql`:

```sql
insert into public.module_state (module_id, is_enabled)
values ('dd', true)
on conflict (module_id) do update set is_enabled = true;

insert into public.module_access (role, module_id)
select r.name, 'dd'
from public.roles r
where not exists (
  select 1 from public.module_access ma where ma.role = r.name and ma.module_id = 'dd'
);

insert into public.feature_access (role, module_id, feature_id)
select 'Admin', 'dd', f.feature_id
from (values
  ('bu-accounts.read'), ('bu-accounts.create'), ('bu-accounts.update'), ('bu-accounts.delete'),
  ('merchants.read'), ('merchants.create'), ('merchants.update'), ('merchants.delete'),
  ('promos.read'), ('promos.create'), ('promos.update'), ('promos.delete'),
  ('audit.read'), ('export.read'),
  ('tables.read'), ('tables.update'),
  ('sql.read'), ('sql.write'),
  ('email.read'), ('email.update')
) as f(feature_id)
where not exists (
  select 1 from public.feature_access fa
  where fa.role = 'Admin' and fa.module_id = 'dd' and fa.feature_id = f.feature_id
);
```

### 4c. Carrying existing grants across

So that nobody has to re-tick twenty boxes in Admin, non-Admin roles inherit
whatever they already hold on `qrdd`, translated to the new ids:

```sql
insert into public.feature_access (role, module_id, feature_id)
select fa.role, 'dd',
       replace(replace(fa.feature_id, 'merchant-whitelist.', 'merchants.'),
               'promo-rule.', 'promos.')
from public.feature_access fa
where fa.module_id = 'qrdd'
  and fa.role <> 'Admin'
  and not exists (
    select 1 from public.feature_access x
    where x.role = fa.role and x.module_id = 'dd'
      and x.feature_id = replace(replace(fa.feature_id, 'merchant-whitelist.', 'merchants.'),
                                 'promo-rule.', 'promos.')
  );
```

Only the twelve CRUD features can be inherited, because they are the only ones
`qrdd` has. `audit.read`, `export.read`, `tables.*`, `sql.*` and `email.*` are
granted to Admin only and must be handed out deliberately in the Admin UI. That
is the right default: they are the powerful ones.

### 4d. `supabase/schema.sql`

Append a `── 12. DD Module ──` section mirroring 4a–4c verbatim, so the full
schema stays re-runnable from scratch. Section 11 (`QR DD Module`) is left
exactly as it is; it is removed when `qrdd` is retired after Phase 2.

---

## 5. Front end

### 5a. Shell — `src/modules/dd/views/DdView.vue`

Reuses the animated pill-tab pattern from `QrisView.vue` / `QrddView.vue`: a
`<nav>` of buttons with an absolutely-positioned indicator whose `left` / `width`
are computed from the active button's `offsetLeft` / `offsetWidth`, transitioned
with `all 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)`, recomputed on tab switch and
on window resize.

Tabs are declared for every phase up front so the shell does not need
restructuring five more times:

| Tab | Gate | Phase 1 state |
|---|---|---|
| Dashboard | — | placeholder |
| BU Accounts | `bu-accounts.read` | placeholder |
| Merchants | `merchants.read` | placeholder |
| Promo Rules | `promos.read` | placeholder |
| Audit Log | `audit.read` | **built** |
| Export | `export.read` | placeholder |
| Tables | `tables.read` | placeholder |
| SQL | `sql.read` | placeholder |

A tab whose gate is denied is not rendered at all (same as `QrddView`). A tab
that is granted but not yet built renders a shared `<DdPlaceholder>` naming the
phase it arrives in — the shell tells the truth about what exists rather than
showing a blank panel. Default tab is Audit Log while it is the only real one.

### 5b. `src/modules/dd/composables/useAuditLog.js`

Server-side paged. Shape follows the existing `qrdd` composables (a `rows` ref,
a `loading` ref, an async loader) so the module reads consistently.

- Query: `.from('dd_audit_log').select('*', { count: 'exact' })` with
  `.order('audit_id', { ascending: false })` and `.range(from, to)`.
- Filters, all applied server-side and all optional: `table_id` (eq),
  `action` (eq), `actor` (eq), and a free-text search applied as an `.or()`
  across `record_key`, `column_name`, `old_value`, `new_value`, `detail`.
- Search input is debounced (250 ms) and responses carry a request sequence
  number; a response older than the newest issued request is discarded. This
  mirrors `useServerTable.js` in DD and prevents fast typing leaving a stale
  page on screen.
- `actors` loaded once via `supabase.rpc('dd_audit_actors')`.
- `exportCsv()` writes the **current filtered page** — matching DD's Audit Log,
  which exports the page rather than the whole log.

Ordering is on `audit_id desc`, not `ts desc`: two rows written inside one
statement share a timestamp to the microsecond, and only the identity column
orders them deterministically.

### 5c. `src/modules/dd/components/AuditLogTab.vue`

Filter bar — table select, action select, actor select, search box, Reset —
above an `LiTable`. Columns:

| Column | Notes |
|---|---|
| When | `ts`, formatted `dd MMM yyyy HH:mm` |
| Who | `actor` |
| Action | badge; INSERT green, UPDATE amber, DELETE red, REPLACE grey |
| Table | `table_id` → `DD_TABLES[id].label` |
| Record | `record_key` |
| Column | `column_name`, em dash when null |
| Old → New | `old_value` and `new_value` in one cell, old struck through; empty rendered as a muted `NULL` so a blank is distinguishable from an empty string |
| Detail | `detail`, em dash when null |

Pagination below, plus an Export CSV button in the toolbar. Read-only: no row
actions, no editing.

---

## 6. Files

| File | Change |
|---|---|
| `supabase/migrations/20260813_dd_audit_log.sql` | **New** |
| `supabase/migrations/20260813_dd_module_seed.sql` | **New** |
| `supabase/schema.sql` | Append section 12 |
| `src/lib/modules.js` | Add `dd` entry (20 features) |
| `src/router/index.js` | Add `/dd` route |
| `src/modules/dd/lib/schema.js` | **New** |
| `src/modules/dd/views/DdView.vue` | **New** |
| `src/modules/dd/components/DdPlaceholder.vue` | **New** |
| `src/modules/dd/components/AuditLogTab.vue` | **New** |
| `src/modules/dd/composables/useAuditLog.js` | **New** |

`CLAUDE.md` gets a `dd` row in the Modules table and a note that `dd_audit_log`
is append-only.

No changes to any `qrdd` file. No changes to the three existing tables' columns,
constraints or policies — only triggers are attached.

---

## 7. Verification

The project has no test suite, so Phase 1 is verified by hand against the live
Supabase project:

1. **Triggers fire on the live path.** Edit a BU account through the existing
   `/qrdd` screen. Open `/dd` → Audit Log: one `UPDATE` row per changed field,
   with the correct `record_key` (`NAME|SOF`) and the signed-in user's display
   name as actor.
2. **Insert and delete.** Add and then remove a merchant via `/qrdd`. Expect one
   `INSERT` row and one `DELETE` row, both with `record_key` = the merchant id
   and `target_db` = `ihybrid_discount`.
3. **Noise is suppressed.** An update that changes only a value and its
   `updated_at` produces exactly one audit row, not two.
4. **NULL transitions are caught.** Clear an optional field (e.g. a promo's
   `max_txn_amount`). Expect a row with a populated `old_value` and a null
   `new_value`.
5. **The log is append-only.** From the browser console, attempt
   `supabase.from('dd_audit_log').delete().eq('audit_id', <n>)` and
   `.update({ actor: 'x' })`. Both must fail with a permission error, and the
   row must still be present.
6. **Filters and paging.** Each filter narrows correctly; combining filters
   ANDs them; paging holds the filter; fast typing in search never leaves an
   older result rendered.
7. **Access gating.** A role without `audit.read` does not see the Audit Log
   tab. A role without the `dd` module is redirected away from `/dd` by the
   router guard.
8. **`schema.sql` is still idempotent.** Run it twice against a scratch
   project; the second run must succeed, in particular the publication guard
   and the three `drop trigger if exists` statements.
9. **`npm run build` succeeds.**

---

## 8. Not in Phase 1

Deferred to the phase named, not dropped:

- Any BU / Merchant / Promo screen under `/dd` — Phase 2. `/qrdd` remains the
  working surface until then.
- Retiring the `qrdd` module — one commit after Phase 2 lands.
- Live change awareness / stale banners — Phase 2 (the publication is added
  here, but nothing subscribes).
- Rich dashboard — Phase 3.
- SQL export, Export Center, `app_instances` cache-reset statements — Phase 4.
  `schema.js` declares the mapping they need; nothing reads it yet.
- Table Explorer, SQL Editor, `REPLACE` audit rows — Phase 5. The `REPLACE`
  action is permitted by the CHECK constraint now so Phase 5 needs no migration.
- Emails, `dd_email_settings`, the Edge Function, pg_cron — Phase 6, and blocked
  on confirming Zimbra is reachable from Supabase's Edge runtime.
- Renaming the three `qrdd_*` tables — explicitly rejected.
- Backfilling audit history for rows written before Phase 1 — impossible; the
  old values were never recorded.
