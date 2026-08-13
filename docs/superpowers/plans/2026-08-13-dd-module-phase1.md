# DD Module Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Register a new `dd` module in SP-lite with its schema-mapping layer, an append-only audit log enforced by database triggers, and a working Audit Log screen.

**Architecture:** Three database triggers on the existing `qrdd_*` tables write to a new `public.dd_audit_log` — one row per record for INSERT/DELETE, one row per changed column for UPDATE. The actor is resolved server-side from `auth.uid()`, never sent by the browser, and `authenticated` holds only `SELECT` so the log cannot be edited from the app. The Vue side adds a `/dd` route rendering a pill-tab shell where every future phase's tab is declared but only Audit Log is built; the rest render a placeholder naming the phase they arrive in.

**Tech Stack:** Vue 3 (`<script setup>`, Composition API), Vue Router (hash history), Supabase JS v2, Postgres (PL/pgSQL triggers, RLS), Vite. Design system: `src/lib/components/Li*.vue`.

## Global Constraints

- **No test framework exists in this repo, and this plan does not add one.** `npm run test` does not exist. Verification is: SQL assertions run against the live Supabase project, `npm run build`, and browser checks through the Browser pane against the `sp-lite-dev` launch config. Every task states its exact verification commands and expected output.
- **No linter is configured.** Match the surrounding code style by eye.
- **Path aliases:** `@` → `src/`, `@lib` → `src/lib/`. Use them; do not write deep relative imports from module code.
- **The three existing tables keep their `qrdd_*` names.** No rename migration. Do not alter their columns, constraints or policies — only attach triggers.
- **All new database objects use the `dd_` prefix:** `dd_audit_log`, `dd_actor()`, `dd_record_key()`, `dd_audit_row()`, `dd_audit_actors()`.
- **Downstream mapping is fixed:** `qrdd_bu_accounts` → `ihybrid_order.discount_bu_accounts`; `qrdd_merchant_whitelist` → `ihybrid_discount.merchant_whitelist`; `qrdd_promo_rules` → `ihybrid_discount.promo_info`.
- **`supabase/schema.sql` must stay idempotent and re-runnable.** Every migration in this plan is mirrored into it as a new `── 12. DD Module ──` section. Section 11 (`QR DD Module`) is left exactly as-is.
- **The `qrdd` module must keep working untouched.** No file under `src/modules/qrdd/` is modified by this plan. `qrdd` is retired after Phase 2, not here.
- **Work on branch `feat/dd-module-phase1`.** Do not commit to `main` — pushing to `main` triggers a GitHub Pages deploy.
- **Migrations are applied to the live project** (24 BU accounts, 1 merchant, 0 promos). Triggers are additive and safe. Trigger tests use rows named `ZZ_AUDIT_TEST` and clean up after themselves.
- **Spec:** `docs/superpowers/specs/2026-08-13-dd-module-phase1-design.md`. Read it if a decision here seems arbitrary.

---

### Task 1: Schema mapping layer

The single source of truth for every local↔downstream fact. Phase 1 uses only `label`, `local`, `targetDb` and `keyColumns`; the rest is declared now so Phase 4's exporter has one place to read from.

**Files:**
- Create: `src/modules/dd/lib/schema.js`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `DD_TABLES` — object keyed by table id (`'bu_accounts' | 'merchants' | 'promos'`). Each value: `{ id: string, label: string, local: string, targetDb: string, targetTable: string, keyColumns: string[], timestamps: Record<string,string>, textColumns: string[], readGate: string }`
  - `EXPORT_ORDER: string[]`, `CACHE_RESET_TABLE: string`, `CACHE_RESET_COLUMN: string`, `TABLE_IDS: string[]`
  - `byLocal(localName: string) => table | undefined`
  - `targetDbs() => string[]`
  - `tableLabel(id: string) => string` — label for a table id, falling back to the id itself for an unknown value

- [ ] **Step 1: Write the file**

Create `src/modules/dd/lib/schema.js`:

```js
// DD module — mapping between SP-lite's local storage and the downstream
// MySQL databases the exports target.
//
// The three tables keep their qrdd_* storage names from the module this
// replaces; only the module, its routes and its new database objects use `dd`.
//
// Phase 1 reads `label`, `local`, `targetDb` and `keyColumns`. Everything else
// is declared for Phase 4 (Export Center / SQL export) so the exporter and the
// UI can never disagree about a table name or a key.

export const DD_TABLES = {
  bu_accounts: {
    id: 'bu_accounts',
    label: 'BU Accounts',
    local: 'qrdd_bu_accounts',
    targetDb: 'ihybrid_order',
    targetTable: 'discount_bu_accounts',
    // Downstream has no surrogate id, so UPDATE/DELETE match on name AND sof.
    keyColumns: ['name', 'sof'],
    // Local column -> downstream column. This table is the odd one out.
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
    // merchant_id is varchar downstream — always export it quoted, never as a
    // bare number, or a leading zero is lost and the import mismatches.
    textColumns: ['merchant_id'],
    readGate: 'merchants.read',
  },
  promos: {
    id: 'promos',
    label: 'Promo Rules',
    local: 'qrdd_promo_rules',
    targetDb: 'ihybrid_discount',
    // The sheet was promo_rule; the table downstream is promo_info.
    targetTable: 'promo_info',
    keyColumns: ['promo_id'],
    timestamps: { created_at: 'created_time', updated_at: 'updated_time' },
    textColumns: ['merchant_id'],
    readGate: 'promos.read',
  },
}

// Apply order for a full export. Each database is closed by one cache-reset
// statement against app_instances, emitted once however many rows moved.
export const EXPORT_ORDER = ['bu_accounts', 'merchants', 'promos']
export const CACHE_RESET_TABLE = 'app_instances'
export const CACHE_RESET_COLUMN = 'static_data_refresh_time'

export const TABLE_IDS = Object.keys(DD_TABLES)

export function byLocal(localName) {
  return Object.values(DD_TABLES).find(t => t.local === localName)
}

export function targetDbs() {
  return [...new Set(Object.values(DD_TABLES).map(t => t.targetDb))]
}

export function tableLabel(id) {
  return DD_TABLES[id]?.label ?? id
}
```

- [ ] **Step 2: Verify it loads and the mapping is right**

Run from the repo root:

```bash
node -e "import('./src/modules/dd/lib/schema.js').then(m=>{const a=(c,l)=>{if(!c)throw new Error('FAIL: '+l);console.log('ok  '+l)};a(m.TABLE_IDS.length===3,'3 tables');a(m.DD_TABLES.bu_accounts.targetTable==='discount_bu_accounts','bu -> discount_bu_accounts');a(m.DD_TABLES.promos.targetTable==='promo_info','promos -> promo_info');a(m.DD_TABLES.merchants.targetDb==='ihybrid_discount','merchants db');a(m.DD_TABLES.bu_accounts.keyColumns.join()==='name,sof','bu key is name,sof');a(m.DD_TABLES.bu_accounts.timestamps.updated_at==='last_modified','bu updated_at -> last_modified');a(m.DD_TABLES.merchants.timestamps.updated_at==='updated_time','merchant updated_at -> updated_time');a(m.byLocal('qrdd_promo_rules').id==='promos','byLocal');a(m.targetDbs().join()==='ihybrid_order,ihybrid_discount','targetDbs deduped and ordered');a(m.tableLabel('merchants')==='Merchants','tableLabel');a(m.tableLabel('nope')==='nope','tableLabel fallback');console.log('ALL PASS')})"
```

Expected: eleven `ok` lines then `ALL PASS`. Any `FAIL:` means the mapping is wrong — fix `schema.js`, do not weaken the assertion.

- [ ] **Step 3: Commit**

```bash
git add src/modules/dd/lib/schema.js
git commit -m "feat(dd): add local-to-downstream schema mapping layer"
```

---

### Task 2: Audit log database objects

**Files:**
- Create: `supabase/migrations/20260813_dd_audit_log.sql`
- Modify: `supabase/schema.sql` (append section 12a)

**Interfaces:**
- Consumes: the three existing tables `public.qrdd_bu_accounts`, `public.qrdd_merchant_whitelist`, `public.qrdd_promo_rules`; `public.profiles(id, full_name)`.
- Produces:
  - Table `public.dd_audit_log(audit_id bigint, ts timestamptz, actor text, actor_id uuid, action text, target_db text, table_id text, record_key text, column_name text, old_value text, new_value text, detail text)`
  - `public.dd_actor() returns text`
  - `public.dd_record_key(rec jsonb, keys text[]) returns text`
  - `public.dd_audit_row() returns trigger` — trigger args `(table_id, target_db, comma_separated_key_columns)`
  - `public.dd_audit_actors() returns table(actor text)` — executable by `authenticated`
  - `table_id` values are exactly `'bu_accounts' | 'merchants' | 'promos'`, matching `DD_TABLES` keys from Task 1.

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/20260813_dd_audit_log.sql`:

```sql
-- DD module — append-only audit log over the three qrdd_* tables.
--
-- Granularity matches the DD Apps Script app it replaces: INSERT and DELETE
-- write one row per record, UPDATE writes one row per changed column.
--
-- The actor is derived from the session server-side. It is deliberately not
-- taken from the created_by/updated_by columns, which the client sets and a
-- tampered client can therefore forge.

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

-- Display name of the signed-in user. security definer because profiles is
-- behind RLS. Falls back to the JWT email, then SYSTEM for writes made outside
-- a user session (dashboard SQL editor, a future service-role job).
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

-- Downstream key for a row, e.g. 'ANTAVAYA|PRIME' or '1029384'.
create or replace function public.dd_record_key(rec jsonb, keys text[])
returns text
language sql
immutable
as $$
  select string_agg(coalesce(rec ->> k, ''), '|' order by ord)
  from unnest(keys) with ordinality as t(k, ord);
$$;

-- One generic trigger function for every audited table. Table id, target
-- database and key columns arrive as trigger arguments, so auditing a fourth
-- table later is one create-trigger statement and no change here.
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
  -- These two change on every single write. Logging them would bury the real
  -- changes; the actor and ts columns already carry the same information.
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
    -- `is distinct from`, not `<>`, so a NULL<->value transition is recorded
    -- rather than silently skipped.
    if ov is distinct from nv then
      insert into public.dd_audit_log
        (actor, actor_id, action, target_db, table_id, record_key, column_name, old_value, new_value)
      values (v_actor, v_actor_id, 'UPDATE', v_target_db, v_table_id, v_key, k, ov, nv);
    end if;
  end loop;
  return new;
end;
$$;

-- `after`, not `before`: a write rejected by a CHECK or FK leaves no audit row.
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

-- Append-only: authenticated gets SELECT and nothing else. The only writer is
-- dd_audit_row(), which runs security definer as the table owner and so
-- bypasses RLS. No insert/update/delete policy is created, deliberately.
alter table public.dd_audit_log enable row level security;

grant select on public.dd_audit_log to authenticated;

drop policy if exists "dd_audit_read" on public.dd_audit_log;
create policy "dd_audit_read" on public.dd_audit_log
  for select to authenticated using (true);

-- Distinct actors for the Audit Log filter, so the client never scans the
-- whole table to build a dropdown.
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

-- Phase 2's stale-data banners subscribe to this. Nothing subscribes yet;
-- it is added now so Phase 2 needs no migration. Guarded because
-- `alter publication ... add table` errors if the table is already a member,
-- which would break re-running schema.sql.
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

- [ ] **Step 2: Apply the migration**

Apply the whole file against the live project — Supabase Dashboard → SQL Editor → New query → paste → Run (or `mcp__supabase__apply_migration` with name `dd_audit_log`).

Expected: `Success. No rows returned`. No errors.

- [ ] **Step 3: Verify the objects exist**

Run:

```sql
select count(*) as triggers
from pg_trigger
where tgname in ('trg_dd_audit_bu_accounts', 'trg_dd_audit_merchants', 'trg_dd_audit_promos');

select count(*) as fns
from pg_proc
where proname in ('dd_actor', 'dd_record_key', 'dd_audit_row', 'dd_audit_actors');
```

Expected: `triggers = 3`, `fns = 4`.

- [ ] **Step 4: Test INSERT / UPDATE / DELETE granularity**

This writes and then removes a row named `ZZ_AUDIT_TEST`. Run the whole block:

```sql
insert into public.qrdd_bu_accounts
  (name, sof, account1, acctname1, percentage1, account2, acctname2, percentage2, created_by, updated_by)
values ('ZZ_AUDIT_TEST', 'PRIME', '1001', 'Expense Test', 0.6000, '2001', 'Receivable Test', 0.4000, 'tester', 'tester');

-- Three real changes plus updated_at, which must be suppressed.
update public.qrdd_bu_accounts
set acctname1 = 'Expense Renamed', percentage1 = 0.7000, percentage2 = 0.3000, updated_at = now()
where name = 'ZZ_AUDIT_TEST';

-- NULL transition: tests `is distinct from` rather than `<>`.
update public.qrdd_bu_accounts set created_by = null where name = 'ZZ_AUDIT_TEST';

delete from public.qrdd_bu_accounts where name = 'ZZ_AUDIT_TEST';

select action, table_id, target_db, actor, column_name, old_value, new_value
from public.dd_audit_log
where record_key = 'ZZ_AUDIT_TEST|PRIME'
order by audit_id;
```

Expected: exactly **six** rows, in this order.

| action | table_id | target_db | actor | column_name | old_value | new_value |
|---|---|---|---|---|---|---|
| INSERT | bu_accounts | ihybrid_order | SYSTEM | *null* | *null* | *null* |
| UPDATE | bu_accounts | ihybrid_order | SYSTEM | acctname1 | Expense Test | Expense Renamed |
| UPDATE | bu_accounts | ihybrid_order | SYSTEM | percentage1 | 0.6000 | 0.7000 |
| UPDATE | bu_accounts | ihybrid_order | SYSTEM | percentage2 | 0.4000 | 0.3000 |
| UPDATE | bu_accounts | ihybrid_order | SYSTEM | created_by | tester | *null* |
| DELETE | bu_accounts | ihybrid_order | SYSTEM | *null* | *null* | *null* |

Three things this proves at once: one row per changed column; `updated_at` suppressed (four columns changed, three rows written); a NULL transition recorded.

`actor` is `SYSTEM` because the SQL editor has no user session — that is the correct fallback, and the in-app actor is checked in Task 8.

Within one UPDATE the column order comes from jsonb key ordering (shortest key first, then bytewise), not table order. If your rows appear in a different order but the *set* matches, that is fine.

- [ ] **Step 5: Test that the log is append-only**

Run:

```sql
begin;
set local role authenticated;
delete from public.dd_audit_log;
rollback;
```

Expected: `ERROR: permission denied for table dd_audit_log`.

If this succeeds instead, an `INSERT`/`UPDATE`/`DELETE` grant or policy leaked in — find and remove it before continuing. The append-only guarantee is the whole reason the log is worth trusting.

- [ ] **Step 6: Clean up the test rows**

```sql
delete from public.dd_audit_log where record_key = 'ZZ_AUDIT_TEST|PRIME';

select count(*) as leftover from public.dd_audit_log where record_key = 'ZZ_AUDIT_TEST|PRIME';
select count(*) as leftover_bu from public.qrdd_bu_accounts where name = 'ZZ_AUDIT_TEST';
```

Expected: `leftover = 0`, `leftover_bu = 0`.

This delete works because the dashboard connection is the table owner, which bypasses RLS. From the app it would fail, as Step 5 proved.

- [ ] **Step 7: Mirror into schema.sql**

Append to the end of `supabase/schema.sql`:

```sql

-- ── 12. DD Module ───────────────────────────────────────────────────────────
-- Phase 1: audit log over the qrdd_* tables. See
-- docs/superpowers/specs/2026-08-13-dd-module-phase1-design.md
--
-- Section 11 (QR DD Module) stays as-is; the qrdd module is retired after
-- Phase 2, not here.
```

then paste the **entire contents** of `supabase/migrations/20260813_dd_audit_log.sql` beneath it, minus that file's own leading comment block. Every statement in it is already idempotent (`create table if not exists`, `create or replace`, `drop ... if exists` before `create`, and the publication guard), so `schema.sql` stays re-runnable.

- [ ] **Step 8: Verify schema.sql is still idempotent**

Run the appended section 12 a second time in the SQL editor.

Expected: `Success. No rows returned`, no error. In particular no `relation "dd_audit_log" already exists` and no `table "dd_audit_log" is already member of publication "supabase_realtime"`.

- [ ] **Step 9: Commit**

```bash
git add supabase/migrations/20260813_dd_audit_log.sql supabase/schema.sql
git commit -m "feat(dd): append-only audit log with per-column update tracking"
```

---

### Task 3: Module registration, route and access seed

**Files:**
- Modify: `src/lib/modules.js` (append to `MODULE_REGISTRY`, after the `qrdd` entry)
- Modify: `src/router/index.js` (insert a route after `/qrdd`)
- Create: `supabase/migrations/20260813_dd_module_seed.sql`
- Modify: `supabase/schema.sql` (append section 12b)

**Interfaces:**
- Consumes: `MODULE_REGISTRY` from Task 1's sibling file `src/lib/modules.js`; `public.roles`, `public.module_state`, `public.module_access`, `public.feature_access`.
- Produces: module id `'dd'` with these twenty feature ids, referenced by later tasks —
  `bu-accounts.read|create|update|delete`, `merchants.read|create|update|delete`,
  `promos.read|create|update|delete`, `audit.read`, `export.read`,
  `tables.read`, `tables.update`, `sql.read`, `sql.write`, `email.read`, `email.update`.
  Route name `'dd'` at path `/dd`, `meta.module === 'dd'`.

- [ ] **Step 1: Add the registry entry**

In `src/lib/modules.js`, insert this object into `MODULE_REGISTRY` immediately after the `qrdd` entry and before the `admin` entry:

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
      { id: 'audit.read',  label: 'Audit Log', desc: 'Browse who changed what, when.' },
      { id: 'export.read', label: 'Export',    desc: 'Export SQL and XLSX.' },
      { id: 'tables.read',   label: 'Tables — Browse', desc: 'Browse raw tables.' },
      { id: 'tables.update', label: 'Tables — Edit',   desc: 'Edit rows inline in the raw table browser.' },
      { id: 'sql.read',  label: 'SQL — Query', desc: 'Run SELECT queries.' },
      { id: 'sql.write', label: 'SQL — Write',  desc: 'Run INSERT/UPDATE/DELETE that rewrite a table.' },
      { id: 'email.read',   label: 'Email Settings — Read',   desc: 'View scheduled email settings.' },
      { id: 'email.update', label: 'Email Settings — Update', desc: 'Edit and send scheduled emails.' },
    ],
  },
```

`sql.write` and `tables.update` are separate from their `.read` counterparts because both can rewrite a whole table, which must be revocable independently of merely looking at data.

- [ ] **Step 2: Add the route**

In `src/router/index.js`, insert immediately after the `/qrdd` route object and before the `/admin` one:

```js
  {
    path: '/dd',
    name: 'dd',
    meta: { module: 'dd', label: 'DD MPM', icon: 'inventory' },
    component: () => import('../modules/dd/views/DdView.vue'),
  },
```

No other wiring: the sidebar auto-discovers routes and `router.beforeEach` already gates on `to.meta.module` via `canModule()`.

`DdView.vue` does not exist yet — the app will fail to navigate to `/dd` until Task 4. That is expected; every other route keeps working because the import is lazy.

- [ ] **Step 3: Write the seed migration**

Create `supabase/migrations/20260813_dd_module_seed.sql`:

```sql
-- DD module — registration and access seed. Mirrors the pattern used for the
-- qrdd module at the end of schema.sql. Idempotent.

insert into public.module_state (module_id, is_enabled)
values ('dd', true)
on conflict (module_id) do update set is_enabled = true;

insert into public.module_access (role, module_id)
select r.name, 'dd'
from public.roles r
where not exists (
  select 1 from public.module_access ma where ma.role = r.name and ma.module_id = 'dd'
);

-- Admin gets all twenty features.
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

-- Non-Admin roles inherit whatever they already hold on qrdd, translated to
-- the new feature ids, so nobody has to re-tick twenty boxes in Admin.
-- Only the twelve CRUD features can be inherited — they are all qrdd has.
-- audit.read, export.read, tables.*, sql.* and email.* stay Admin-only until
-- handed out deliberately; they are the powerful ones.
insert into public.feature_access (role, module_id, feature_id)
select fa.role, 'dd',
       replace(replace(fa.feature_id, 'merchant-whitelist.', 'merchants.'),
               'promo-rule.', 'promos.')
from public.feature_access fa
where fa.module_id = 'qrdd'
  and fa.role <> 'Admin'
  and not exists (
    select 1 from public.feature_access x
    where x.role = fa.role
      and x.module_id = 'dd'
      and x.feature_id = replace(replace(fa.feature_id, 'merchant-whitelist.', 'merchants.'),
                                 'promo-rule.', 'promos.')
  );
```

- [ ] **Step 4: Apply and verify the seed**

Apply the file (Dashboard SQL Editor, or `mcp__supabase__apply_migration` named `dd_module_seed`), then run:

```sql
select count(*) as admin_features
from public.feature_access where role = 'Admin' and module_id = 'dd';

select count(*) as roles_with_module
from public.module_access where module_id = 'dd';

select is_enabled from public.module_state where module_id = 'dd';
```

Expected: `admin_features = 20`; `roles_with_module` equals the row count of `public.roles` (7 at time of writing); `is_enabled = true`.

- [ ] **Step 5: Verify the seed is idempotent**

Run the same migration a second time, then re-run the three queries from Step 4.

Expected: identical numbers — `admin_features` is still 20, not 40.

- [ ] **Step 6: Mirror into schema.sql**

Append the full contents of `supabase/migrations/20260813_dd_module_seed.sql` to `supabase/schema.sql`, beneath the section 12 material added in Task 2, under a comment line:

```sql

-- 12b. DD module registration and access seed.
```

- [ ] **Step 7: Verify the build still passes**

```bash
npm run build
```

Expected: build succeeds. `DdView.vue` is missing, but Vite will not fail on it — the dynamic import is only resolved at runtime. If the build *does* fail on the missing file, create an empty placeholder `src/modules/dd/views/DdView.vue` containing `<template><div /></template>` and let Task 4 overwrite it.

- [ ] **Step 8: Commit**

```bash
git add src/lib/modules.js src/router/index.js supabase/migrations/20260813_dd_module_seed.sql supabase/schema.sql
git commit -m "feat(dd): register dd module, route and access seed"
```

---

### Task 4: DD shell view with pill tabs

**Files:**
- Create: `src/modules/dd/views/DdView.vue`
- Create: `src/modules/dd/components/DdPlaceholder.vue`

**Interfaces:**
- Consumes: `useAccess()` from `@/composables/useAccess.js` (`canFeature(moduleId, featureId)`); feature ids from Task 3.
- Produces: `DdView.vue` renders a `<nav>` of `.dd__tab` buttons and a `.dd__panel-wrap` container. Task 5 mounts `<AuditLogTab />` into the `audit` branch of that container.
  `DdPlaceholder.vue` props: `{ title: String, phase: String, icon: String }`.

- [ ] **Step 1: Write the placeholder component**

Create `src/modules/dd/components/DdPlaceholder.vue`:

```vue
<template>
  <div class="dd-placeholder">
    <span class="material-symbols-outlined dd-placeholder__icon">{{ icon }}</span>
    <h2 class="dd-placeholder__title">{{ title }}</h2>
    <p class="dd-placeholder__body">
      Not built yet — arriving in {{ phase }}.
    </p>
    <p class="dd-placeholder__hint">
      Until then, use <RouterLink to="/qrdd" class="dd-placeholder__link">QR DD</RouterLink>
      for business units, merchants and promo rules.
    </p>
  </div>
</template>

<script setup>
import { RouterLink } from 'vue-router'

defineProps({
  title: { type: String, required: true },
  phase: { type: String, required: true },
  icon: { type: String, default: 'construction' },
})
</script>

<style scoped>
.dd-placeholder {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 6px; padding: 64px 24px; text-align: center;
  background: rgba(255, 255, 255, 0.5);
  border: 1px dashed rgba(0, 0, 0, 0.12);
  border-radius: var(--radius-md, 16px);
}
.dd-placeholder__icon { font-size: 40px; color: var(--color-gray-400, #aaa); }
.dd-placeholder__title { font-size: 18px; font-weight: 700; margin: 4px 0 0; }
.dd-placeholder__body { font-size: 14px; color: var(--color-gray-500, #8e8ea0); margin: 0; }
.dd-placeholder__hint { font-size: 13px; color: var(--color-gray-400, #aaa); margin: 8px 0 0; }
.dd-placeholder__link { color: #6366F1; font-weight: 600; text-decoration: none; }
.dd-placeholder__link:hover { text-decoration: underline; }
</style>
```

- [ ] **Step 2: Write the shell view**

Create `src/modules/dd/views/DdView.vue`. This copies the pill-tab pattern from `src/modules/qrdd/views/QrddView.vue` — same markup shape, same spring transition — with the `qrdd__` class prefix renamed to `dd__`.

```vue
<template>
  <div class="dd">
    <header class="dd__header">
      <div class="dd__header-content">
        <div class="dd__title-group">
          <div class="dd__icon-badge">
            <span class="material-symbols-outlined">inventory</span>
          </div>
          <div>
            <h1 class="dd__title">DD MPM</h1>
            <p class="dd__subtitle">Business units, merchants, promo rules, audit and exports</p>
          </div>
        </div>
      </div>
    </header>

    <nav class="dd__tabs-wrapper">
      <div class="dd__tabs">
        <button
          v-for="(tab, index) in visibleTabs"
          :key="tab.id"
          class="dd__tab"
          :class="{ 'dd__tab--active': activeTab === tab.id }"
          @click="switchTab(tab.id, index)"
        >
          <span class="material-symbols-outlined dd__tab-icon">{{ tab.icon }}</span>
          <span class="dd__tab-label">{{ tab.label }}</span>
          <span class="dd__tab-desc">{{ tab.desc }}</span>
        </button>
        <div class="dd__tab-indicator" :style="indicatorStyle" />
      </div>
    </nav>

    <Transition name="panel-slide" mode="out-in">
      <div :key="activeTab" class="dd__panel-wrap">
        <DdPlaceholder
          v-if="activeTab !== 'audit'"
          :title="currentTab?.label ?? ''"
          :phase="currentTab?.phase ?? 'a later phase'"
          :icon="currentTab?.icon ?? 'construction'"
        />
        <DdPlaceholder
          v-else
          title="Audit Log"
          phase="the next step of Phase 1"
          icon="history"
        />
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useAccess } from '@/composables/useAccess.js'
import DdPlaceholder from '../components/DdPlaceholder.vue'

const { canFeature } = useAccess()
function can(feature) { return canFeature('dd', feature) }

// Every phase's tab is declared now so the shell needs no restructuring five
// more times. `phase` is what the placeholder tells the user.
const allTabDefs = [
  { id: 'dashboard',   label: 'Dashboard',   desc: 'Reports & stats',    icon: 'monitoring',      gate: null,           phase: 'Phase 3' },
  { id: 'bu-accounts', label: 'BU Accounts', desc: 'Manage accounts',    icon: 'account_balance', gate: 'bu-accounts.read', phase: 'Phase 2' },
  { id: 'merchants',   label: 'Merchants',   desc: 'Whitelist',          icon: 'store',           gate: 'merchants.read',   phase: 'Phase 2' },
  { id: 'promos',      label: 'Promo Rules', desc: 'Discount rules',     icon: 'percent',         gate: 'promos.read',      phase: 'Phase 2' },
  { id: 'audit',       label: 'Audit Log',   desc: 'Who changed what',   icon: 'history',         gate: 'audit.read',       phase: 'Phase 1' },
  { id: 'export',      label: 'Export',      desc: 'SQL & XLSX',         icon: 'file_save',       gate: 'export.read',      phase: 'Phase 4' },
  { id: 'tables',      label: 'Tables',      desc: 'Raw table browser',  icon: 'table',           gate: 'tables.read',      phase: 'Phase 5' },
  { id: 'sql',         label: 'SQL',         desc: 'Query workspace',    icon: 'terminal',        gate: 'sql.read',         phase: 'Phase 5' },
]

const visibleTabs = computed(() => allTabDefs.filter(t => !t.gate || can(t.gate)))

// Audit Log is the only tab that does anything in Phase 1, so open on it when
// it is granted.
const activeTab = ref(
  visibleTabs.value.find(t => t.id === 'audit')?.id ?? visibleTabs.value[0]?.id,
)
const currentTab = computed(() => allTabDefs.find(t => t.id === activeTab.value))
const indicatorStyle = ref({})

watch(visibleTabs, (list) => {
  if (list.length && !list.find(t => t.id === activeTab.value)) {
    activeTab.value = list[0].id
    nextTick(() => updateIndicator())
  }
})

function switchTab(id, index) {
  activeTab.value = id
  nextTick(() => updateIndicator(index))
}

function updateIndicator(targetIndex) {
  const idx = targetIndex ?? visibleTabs.value.findIndex(t => t.id === activeTab.value)
  const tabEl = document.querySelectorAll('.dd__tab')[idx]
  if (tabEl) {
    indicatorStyle.value = {
      left: `${tabEl.offsetLeft}px`,
      width: `${tabEl.offsetWidth}px`,
    }
  }
}

function onResize() { nextTick(() => updateIndicator()) }

onMounted(() => {
  nextTick(() => updateIndicator())
  window.addEventListener('resize', onResize)
})
onBeforeUnmount(() => window.removeEventListener('resize', onResize))
</script>

<style scoped>
.dd {
  max-width: 1280px;
  margin: 0 auto;
  padding: var(--space-lg, 24px) var(--space-xl, 32px);
  display: flex;
  flex-direction: column;
  gap: var(--space-lg, 24px);
}

.dd__header-content { display: flex; justify-content: space-between; align-items: center; }
.dd__title-group { display: flex; align-items: center; gap: var(--space-l, 16px); }
.dd__icon-badge {
  width: 48px; height: 48px;
  display: flex; align-items: center; justify-content: center;
  background: linear-gradient(135deg, #6366F1, #8B5CF6);
  border-radius: var(--radius-sm, 12px);
  box-shadow: 0 4px 16px rgba(99, 102, 241, 0.3);
}
.dd__icon-badge .material-symbols-outlined { font-size: 26px; color: #fff; }
.dd__title { font-size: 26px; font-weight: 800; margin: 0; letter-spacing: -0.5px; }
.dd__subtitle { font-size: 14px; color: var(--color-gray-500, #8e8ea0); margin: 2px 0 0; }

.dd__tabs {
  display: flex; position: relative;
  background: rgba(255,255,255,0.5); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(0,0,0,0.06); border-radius: var(--radius-md, 16px);
  padding: 5px; gap: 2px;
}
.dd__tab {
  flex: 1; display: flex; flex-direction: column; align-items: center; gap: 2px;
  padding: 14px 12px; border: none; border-radius: var(--radius-sm, 12px);
  background: transparent; cursor: pointer;
  font-family: var(--font-body, 'Inter', sans-serif);
  transition: all 300ms ease-out;
  position: relative; z-index: 1;
}
.dd__tab:hover { background: rgba(255,255,255,0.5); }
.dd__tab--active { color: var(--color-on-surface, #1a1a2e); }
.dd__tab-icon { font-size: 22px; color: var(--color-gray-500, #8e8ea0); transition: color 300ms ease-out, transform 300ms cubic-bezier(0.34, 1.56, 0.64, 1); }
.dd__tab--active .dd__tab-icon { color: #6366F1; transform: scale(1.1); }
.dd__tab-label { font-size: 13px; font-weight: 600; color: var(--color-gray-700, #555); transition: color 300ms ease-out; }
.dd__tab--active .dd__tab-label { color: var(--color-on-surface, #1a1a2e); }
.dd__tab-desc { font-size: 11px; color: var(--color-gray-400, #aaa); font-weight: 400; transition: color 300ms ease-out; }
.dd__tab--active .dd__tab-desc { color: var(--color-gray-500, #8e8ea0); }
.dd__tab-indicator {
  position: absolute; top: 5px; height: calc(100% - 10px);
  background: #fff; border-radius: var(--radius-sm, 12px);
  box-shadow: 0 2px 8px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.02);
  transition: all 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
  z-index: 0;
}

.panel-slide-enter-active { transition: all 0.35s cubic-bezier(0.16, 1, 0.3, 1); }
.panel-slide-leave-active { transition: all 0.2s ease-in; }
.panel-slide-enter-from { opacity: 0; transform: translateY(12px); }
.panel-slide-leave-to { opacity: 0; transform: translateY(-8px); }

@media (max-width: 768px) {
  .dd { padding: var(--space-md, 16px); gap: var(--space-md, 16px); }
  .dd__title { font-size: 20px; }
  .dd__icon-badge { width: 40px; height: 40px; }
  .dd__icon-badge .material-symbols-outlined { font-size: 22px; }
  .dd__tab { padding: 10px 8px; min-width: 0; flex-shrink: 0; }
  .dd__tab-desc { display: none; }
  .dd__tabs { overflow-x: auto; -webkit-overflow-scrolling: touch; scrollbar-width: none; }
  .dd__tabs::-webkit-scrollbar { display: none; }
}
@media (max-width: 480px) {
  .dd__icon-badge { display: none; }
  .dd__tab-label { font-size: 12px; }
  .dd__tab-icon { font-size: 18px; }
}
@media (prefers-reduced-motion: reduce) {
  .dd__tab-indicator { transition: none; }
  .dd__tab-icon { transition: none; }
  .panel-slide-enter-active, .panel-slide-leave-active { transition-duration: 0.01ms; }
}
</style>
```

The file ends after `</style>` — three top-level blocks only: `<template>`, `<script setup>`, `<style scoped>`.

- [ ] **Step 3: Verify in the browser**

Start the dev server and open `/dd`:

- `mcp__Claude_Browser__preview_start` with `{ name: "sp-lite-dev" }`
- `mcp__Claude_Browser__navigate` to `http://localhost:5173/#/dd`
- Sign in if prompted.

Then check, using `read_page` and `read_console_messages`:

1. Eight tabs render: Dashboard, BU Accounts, Merchants, Promo Rules, Audit Log, Export, Tables, SQL.
2. Audit Log is the active tab on load, and the white pill indicator sits under it.
3. Clicking another tab slides the indicator and swaps the panel.
4. Each placeholder names the right phase — Export says "Phase 4", Tables and SQL say "Phase 5", BU Accounts says "Phase 2".
5. `read_console_messages` with `onlyErrors: true` returns nothing.
6. `resize_window` to `preset: "mobile"` — the tab strip scrolls horizontally and the `desc` sub-labels disappear.

- [ ] **Step 4: Take a screenshot as evidence**

`mcp__Claude_Browser__computer` with `{ action: "screenshot" }`. Confirm the header, the eight-tab strip and the placeholder panel all render.

- [ ] **Step 5: Verify the build**

```bash
npm run build
```

Expected: succeeds with no errors.

- [ ] **Step 6: Commit**

```bash
git add src/modules/dd/views/DdView.vue src/modules/dd/components/DdPlaceholder.vue
git commit -m "feat(dd): add module shell with pill tabs and phase placeholders"
```

---

### Task 5: Audit Log — list and paging

**Files:**
- Create: `src/modules/dd/composables/useAuditLog.js`
- Create: `src/modules/dd/components/AuditLogTab.vue`
- Modify: `src/modules/dd/views/DdView.vue` (render the real tab instead of the audit placeholder)

**Interfaces:**
- Consumes: `supabase` from `@/lib/supabase.js`; `tableLabel` from `../lib/schema.js` (Task 1); table `public.dd_audit_log` (Task 2).
- Produces: `useAuditLog()` returning
  `{ rows, loading, error, total, currentPage, pageSize, totalPages, load }` —
  `rows: Ref<Array>`, `loading/error: Ref`, `total/currentPage: Ref<number>`,
  `pageSize: number` (constant 25), `totalPages: ComputedRef<number>`,
  `load: () => Promise<void>`.
  Task 6 extends this same object with filters; Task 7 adds `exportCsv`.

- [ ] **Step 1: Write the composable**

Create `src/modules/dd/composables/useAuditLog.js`:

```js
import { ref, computed, watch } from 'vue'
import { supabase } from '@/lib/supabase.js'

// Audit log reader. Server-side paged — the log only grows, so it is never
// pulled into the browser wholesale the way the qrdd composables do.
export function useAuditLog() {
  const rows = ref([])
  const loading = ref(true)
  const error = ref(null)
  const total = ref(0)

  const currentPage = ref(1)
  const pageSize = 25

  const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize)))

  watch(currentPage, () => { load() })

  async function load() {
    loading.value = true
    error.value = null
    const from = (currentPage.value - 1) * pageSize
    const to = from + pageSize - 1
    try {
      const { data, error: e, count } = await supabase
        .from('dd_audit_log')
        .select('*', { count: 'exact' })
        // audit_id, not ts: rows written by one statement share a timestamp to
        // the microsecond and only the identity column orders them stably.
        .order('audit_id', { ascending: false })
        .range(from, to)
      if (e) throw e
      rows.value = data || []
      total.value = count ?? 0
    } catch (e) {
      error.value = e.message
      rows.value = []
      total.value = 0
    } finally {
      loading.value = false
    }
  }

  return { rows, loading, error, total, currentPage, pageSize, totalPages, load }
}
```

- [ ] **Step 2: Write the tab component**

Create `src/modules/dd/components/AuditLogTab.vue`. Plain columns for now; formatting comes in Task 7.

```vue
<template>
  <section class="audit">
    <div class="audit__toolbar">
      <p class="audit__count">
        {{ total }} {{ total === 1 ? 'entry' : 'entries' }}
      </p>
    </div>

    <p v-if="error" class="audit__error">{{ error }}</p>

    <LiTable :data="rows" :columns="columns" row-key="audit_id" :loading="loading">
      <template #cell-ts="{ value }">{{ formatTs(value) }}</template>
      <template #cell-table_id="{ value }">{{ tableLabel(value) }}</template>
      <template #cell-column_name="{ value }">{{ value || '—' }}</template>
      <template #cell-detail="{ value }">{{ value || '—' }}</template>
    </LiTable>

    <div v-if="totalPages > 1" class="audit__pagination">
      <LiPagination
        :model-value="currentPage"
        :total-pages="totalPages"
        @update:model-value="$emit('update:currentPage', $event)"
      />
    </div>
  </section>
</template>

<script setup>
import LiTable from '@lib/components/LiTable.vue'
import LiPagination from '@lib/components/LiPagination.vue'
import { tableLabel } from '../lib/schema.js'

defineProps({
  rows: { type: Array, default: () => [] },
  loading: Boolean,
  error: { type: String, default: null },
  total: { type: Number, default: 0 },
  currentPage: { type: Number, default: 1 },
  totalPages: { type: Number, default: 1 },
})

defineEmits(['update:currentPage'])

const columns = [
  { key: 'ts', label: 'When' },
  { key: 'actor', label: 'Who' },
  { key: 'action', label: 'Action' },
  { key: 'table_id', label: 'Table' },
  { key: 'record_key', label: 'Record' },
  { key: 'column_name', label: 'Column' },
  { key: 'old_value', label: 'Old' },
  { key: 'new_value', label: 'New' },
  { key: 'detail', label: 'Detail' },
]

function formatTs(v) {
  if (!v) return '—'
  return new Date(v).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}
</script>

<style scoped>
.audit { display: flex; flex-direction: column; gap: var(--space-md, 16px); }
.audit__toolbar { display: flex; justify-content: space-between; align-items: center; }
.audit__count { font-size: 13px; color: var(--color-gray-500, #8e8ea0); margin: 0; }
.audit__error {
  font-size: 13px; color: var(--color-red-400, #C83E3B);
  background: rgba(200, 62, 59, 0.08);
  border-radius: var(--radius-sm, 12px); padding: 10px 14px; margin: 0;
}
.audit__pagination { display: flex; justify-content: center; }
</style>
```

- [ ] **Step 3: Mount it in the shell**

In `src/modules/dd/views/DdView.vue`:

Add to the imports:

```js
import AuditLogTab from '../components/AuditLogTab.vue'
import { useAuditLog } from '../composables/useAuditLog.js'
```

Add after the `const { canFeature } = useAccess()` line:

```js
const audit = useAuditLog()
```

Add inside `onMounted`, before the existing `nextTick` call:

```js
  if (can('audit.read')) audit.load()
```

Replace the two `<DdPlaceholder>` elements inside `.dd__panel-wrap` with:

```vue
        <AuditLogTab
          v-if="activeTab === 'audit' && can('audit.read')"
          :rows="audit.rows.value"
          :loading="audit.loading.value"
          :error="audit.error.value"
          :total="audit.total.value"
          :current-page="audit.currentPage.value"
          :total-pages="audit.totalPages.value"
          @update:current-page="audit.currentPage.value = $event"
        />
        <DdPlaceholder
          v-else
          :title="currentTab?.label ?? ''"
          :phase="currentTab?.phase ?? 'a later phase'"
          :icon="currentTab?.icon ?? 'construction'"
        />
```

- [ ] **Step 4: Generate rows to look at**

The log is empty after Task 2's cleanup. In the running app, go to `/qrdd` → BU Accounts, edit any account's expense account name, and save.

- [ ] **Step 5: Verify in the browser**

Navigate to `http://localhost:5173/#/dd` and confirm with `read_page`:

1. The Audit Log tab renders a table, not the placeholder.
2. There is a row with action `UPDATE`, table `BU Accounts` (the label, not `bu_accounts`), the column you changed, and its old and new values.
3. `Who` shows **your display name**, not `SYSTEM` — this proves `dd_actor()` resolves a real session, unlike the SQL-editor path tested in Task 2.
4. The entry count above the table matches.
5. `read_console_messages` with `onlyErrors: true` returns nothing.

- [ ] **Step 6: Verify paging**

Generate more than 25 entries — in the Supabase SQL editor:

```sql
insert into public.dd_audit_log (actor, action, target_db, table_id, record_key, detail)
select 'PAGING TEST', 'INSERT', 'ihybrid_discount', 'merchants', 'PAGE_' || g, 'paging fixture'
from generate_series(1, 30) g;
```

Reload `/dd`. Confirm: the table shows 25 rows, pagination appears, page 2 shows the remainder, and the newest row is first.

Then clean up:

```sql
delete from public.dd_audit_log where actor = 'PAGING TEST';
```

- [ ] **Step 7: Verify the build**

```bash
npm run build
```

Expected: succeeds.

- [ ] **Step 8: Commit**

```bash
git add src/modules/dd/composables/useAuditLog.js src/modules/dd/components/AuditLogTab.vue src/modules/dd/views/DdView.vue
git commit -m "feat(dd): audit log list with server-side paging"
```

---

### Task 6: Audit Log — filters, debounced search, race guard

**Files:**
- Modify: `src/modules/dd/composables/useAuditLog.js`
- Modify: `src/modules/dd/components/AuditLogTab.vue`
- Modify: `src/modules/dd/views/DdView.vue` (pass the new props and events)

**Interfaces:**
- Consumes: everything `useAuditLog()` produced in Task 5; RPC `public.dd_audit_actors()` (Task 2); `TABLE_IDS`/`tableLabel` from `../lib/schema.js`.
- Produces: `useAuditLog()` additionally returns
  `{ filterTable, filterAction, filterActor, search, actors, loadActors, resetFilters }` —
  the first four are `Ref<string>` (empty string means "no filter"),
  `actors: Ref<string[]>`, `loadActors: () => Promise<void>`,
  `resetFilters: () => void`.

- [ ] **Step 1: Add filters, debounce and the race guard to the composable**

Rewrite `src/modules/dd/composables/useAuditLog.js` in full:

```js
import { ref, computed, watch } from 'vue'
import { supabase } from '@/lib/supabase.js'

const SEARCH_DEBOUNCE_MS = 250

// Columns the free-text box searches. Numeric and enum columns are excluded —
// they have their own dropdowns.
const SEARCH_COLUMNS = ['record_key', 'column_name', 'old_value', 'new_value', 'detail']

// Audit log reader. Server-side paged and server-side filtered — the log only
// grows, so it is never pulled into the browser wholesale.
export function useAuditLog() {
  const rows = ref([])
  const loading = ref(true)
  const error = ref(null)
  const total = ref(0)

  const currentPage = ref(1)
  const pageSize = 25

  const filterTable = ref('')
  const filterAction = ref('')
  const filterActor = ref('')
  const search = ref('')
  const actors = ref([])

  const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize)))

  // Discards out-of-order responses: fast typing must never leave an older
  // result on screen after a newer request has already returned.
  let seq = 0
  let searchTimer = null

  watch(currentPage, () => { load() })

  // Any filter change invalidates the current page number.
  watch([filterTable, filterAction, filterActor], () => {
    if (currentPage.value !== 1) currentPage.value = 1
    else load()
  })

  watch(search, () => {
    clearTimeout(searchTimer)
    searchTimer = setTimeout(() => {
      if (currentPage.value !== 1) currentPage.value = 1
      else load()
    }, SEARCH_DEBOUNCE_MS)
  })

  async function load() {
    const mySeq = ++seq
    loading.value = true
    error.value = null
    const from = (currentPage.value - 1) * pageSize
    const to = from + pageSize - 1
    try {
      let q = supabase
        .from('dd_audit_log')
        .select('*', { count: 'exact' })
        // audit_id, not ts: rows written by one statement share a timestamp to
        // the microsecond and only the identity column orders them stably.
        .order('audit_id', { ascending: false })

      if (filterTable.value) q = q.eq('table_id', filterTable.value)
      if (filterAction.value) q = q.eq('action', filterAction.value)
      if (filterActor.value) q = q.eq('actor', filterActor.value)

      const term = search.value.trim()
      if (term) {
        // Commas and parentheses are PostgREST `or` syntax; strip them so a
        // literal one in the search box cannot break the filter expression.
        const safe = term.replace(/[,()]/g, ' ')
        q = q.or(SEARCH_COLUMNS.map(c => `${c}.ilike.%${safe}%`).join(','))
      }

      const { data, error: e, count } = await q.range(from, to)
      if (mySeq !== seq) return   // a newer request already answered
      if (e) throw e
      rows.value = data || []
      total.value = count ?? 0
    } catch (e) {
      if (mySeq !== seq) return
      error.value = e.message
      rows.value = []
      total.value = 0
    } finally {
      if (mySeq === seq) loading.value = false
    }
  }

  async function loadActors() {
    const { data, error: e } = await supabase.rpc('dd_audit_actors')
    if (e) { actors.value = []; return }
    actors.value = (data || []).map(r => r.actor).filter(Boolean)
  }

  function resetFilters() {
    filterTable.value = ''
    filterAction.value = ''
    filterActor.value = ''
    search.value = ''
  }

  return {
    rows, loading, error, total,
    currentPage, pageSize, totalPages,
    filterTable, filterAction, filterActor, search, actors,
    load, loadActors, resetFilters,
  }
}
```

Note `resetFilters()` sets four refs at once, which fires the watchers. The redundant loads are harmless — the race guard means only the last response is applied.

- [ ] **Step 2: Add the filter bar to the tab**

In `src/modules/dd/components/AuditLogTab.vue`, insert this block immediately **above** `<div class="audit__toolbar">` in the template:

```vue
    <div class="audit__filters">
      <LiSelect
        :model-value="filterTable"
        :options="tableOptions"
        placeholder="All tables"
        @update:model-value="$emit('update:filterTable', $event)"
      />
      <LiSelect
        :model-value="filterAction"
        :options="actionOptions"
        placeholder="All actions"
        @update:model-value="$emit('update:filterAction', $event)"
      />
      <LiSelect
        :model-value="filterActor"
        :options="actorOptions"
        placeholder="All people"
        @update:model-value="$emit('update:filterActor', $event)"
      />
      <LiTextField
        :model-value="search"
        placeholder="Search record, column or value…"
        @update:model-value="$emit('update:search', $event)"
      />
      <button class="audit__reset" type="button" @click="$emit('reset')">Reset</button>
    </div>
```

Add to the imports in `<script setup>`:

```js
import LiSelect from '@lib/components/LiSelect.vue'
import LiTextField from '@lib/components/LiTextField.vue'
import { computed } from 'vue'
import { TABLE_IDS, tableLabel } from '../lib/schema.js'
```

(remove the now-duplicated `tableLabel` import line from Task 5 — one import statement from `../lib/schema.js` only)

Replace the `defineProps` call with:

```js
const props = defineProps({
  rows: { type: Array, default: () => [] },
  loading: Boolean,
  error: { type: String, default: null },
  total: { type: Number, default: 0 },
  currentPage: { type: Number, default: 1 },
  totalPages: { type: Number, default: 1 },
  filterTable: { type: String, default: '' },
  filterAction: { type: String, default: '' },
  filterActor: { type: String, default: '' },
  search: { type: String, default: '' },
  actors: { type: Array, default: () => [] },
})
```

Replace the `defineEmits` call with:

```js
defineEmits([
  'update:currentPage',
  'update:filterTable',
  'update:filterAction',
  'update:filterActor',
  'update:search',
  'reset',
])
```

Add the option lists after `defineEmits`:

```js
// Empty-string value is the "no filter" sentinel the composable expects.
const tableOptions = computed(() => [
  { label: 'All tables', value: '' },
  ...TABLE_IDS.map(id => ({ label: tableLabel(id), value: id })),
])

const actionOptions = [
  { label: 'All actions', value: '' },
  { label: 'Insert', value: 'INSERT' },
  { label: 'Update', value: 'UPDATE' },
  { label: 'Delete', value: 'DELETE' },
  { label: 'Replace', value: 'REPLACE' },
]

const actorOptions = computed(() => [
  { label: 'All people', value: '' },
  ...props.actors.map(a => ({ label: a, value: a })),
])
```

Add to `<style scoped>`:

```css
.audit__filters {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr 2fr auto;
  gap: var(--space-sm, 12px);
  align-items: end;
}
.audit__reset {
  padding: 10px 18px;
  border: 1px solid rgba(0,0,0,0.1);
  border-radius: var(--radius-pill, 999px);
  background: transparent;
  font-family: var(--font-body, 'Inter', sans-serif);
  font-size: 13px; font-weight: 600;
  color: var(--color-gray-700, #666);
  cursor: pointer; transition: all 200ms;
}
.audit__reset:hover { background: rgba(0,0,0,0.04); }

@media (max-width: 768px) {
  .audit__filters { grid-template-columns: 1fr 1fr; }
}
```

- [ ] **Step 3: Wire the new props and events in the shell**

In `src/modules/dd/views/DdView.vue`, replace the `<AuditLogTab ... />` element with:

```vue
        <AuditLogTab
          v-if="activeTab === 'audit' && can('audit.read')"
          :rows="audit.rows.value"
          :loading="audit.loading.value"
          :error="audit.error.value"
          :total="audit.total.value"
          :current-page="audit.currentPage.value"
          :total-pages="audit.totalPages.value"
          :filter-table="audit.filterTable.value"
          :filter-action="audit.filterAction.value"
          :filter-actor="audit.filterActor.value"
          :search="audit.search.value"
          :actors="audit.actors.value"
          @update:current-page="audit.currentPage.value = $event"
          @update:filter-table="audit.filterTable.value = $event"
          @update:filter-action="audit.filterAction.value = $event"
          @update:filter-actor="audit.filterActor.value = $event"
          @update:search="audit.search.value = $event"
          @reset="audit.resetFilters()"
        />
```

And in `onMounted`, replace the audit line with:

```js
  if (can('audit.read')) { audit.load(); audit.loadActors() }
```

- [ ] **Step 4: Seed varied fixture rows**

In the Supabase SQL editor:

```sql
insert into public.dd_audit_log (actor, action, target_db, table_id, record_key, column_name, old_value, new_value)
values
  ('FILTER TEST A', 'INSERT', 'ihybrid_order',    'bu_accounts', 'FT_BU|PRIME',  null,        null,      null),
  ('FILTER TEST A', 'UPDATE', 'ihybrid_order',    'bu_accounts', 'FT_BU|PRIME',  'acctname1', 'alpha',   'bravo'),
  ('FILTER TEST B', 'UPDATE', 'ihybrid_discount', 'merchants',   'FT_MERCH_001', 'status',    'ACTIVE',  'INACTIVE'),
  ('FILTER TEST B', 'DELETE', 'ihybrid_discount', 'promos',      'FT_PROMO_01',  null,        null,      null);
```

- [ ] **Step 5: Verify each filter**

Reload `/dd` and check with `read_page` after each action:

1. **Table filter** → "Merchants": only the `FT_MERCH_001` row remains.
2. **Action filter** → "Update": only UPDATE rows; the INSERT and DELETE fixtures are gone.
3. **Actor filter**: the dropdown lists `FILTER TEST A` and `FILTER TEST B` (proving `dd_audit_actors()` works). Selecting `FILTER TEST B` leaves only that person's two rows.
4. **Combined**: actor `FILTER TEST A` **and** action `UPDATE` → exactly one row (`acctname1`, alpha → bravo). Filters AND together, not OR.
5. **Search**: type `bravo` → only the `acctname1` row. Type `FT_PROMO` → only the promos DELETE row.
6. **Reset** clears all four controls and restores the full count.
7. **Paging holds the filter**: with a filter active and more than 25 matches, page 2 stays filtered.

- [ ] **Step 6: Verify the race guard**

With the browser open, type `abcdefgh` into the search box quickly, one character at a time, then clear it.

Expected: the table settles on the unfiltered result. It must not end up showing results for a prefix like `abc`. Check `read_network_requests` with `urlPattern: "dd_audit_log"` — the debounce means far fewer requests than keystrokes.

- [ ] **Step 7: Verify a comma in the search box does not break the query**

Type `alpha, bravo` into the search box.

Expected: the table shows a result or an empty state — **not** the error banner. Confirm `read_console_messages` with `onlyErrors: true` is empty. A raw comma reaching PostgREST's `or` parser would produce a 400.

- [ ] **Step 8: Clean up the fixtures**

```sql
delete from public.dd_audit_log where actor in ('FILTER TEST A', 'FILTER TEST B');
```

- [ ] **Step 9: Verify the build**

```bash
npm run build
```

Expected: succeeds.

- [ ] **Step 10: Commit**

```bash
git add src/modules/dd/composables/useAuditLog.js src/modules/dd/components/AuditLogTab.vue src/modules/dd/views/DdView.vue
git commit -m "feat(dd): audit log filters with debounced search and race guard"
```

---

### Task 7: Audit Log — cell formatting and CSV export

**Files:**
- Create: `src/modules/dd/lib/csv.js`
- Modify: `src/modules/dd/components/AuditLogTab.vue`
- Modify: `src/modules/dd/composables/useAuditLog.js`
- Modify: `src/modules/dd/views/DdView.vue` (wire the export event)

**Interfaces:**
- Consumes: `useAuditLog()` from Task 6.
- Produces:
  - `src/modules/dd/lib/csv.js` exports `downloadCsv(rows, columns, filename)` where `rows: object[]`, `columns: Array<{ key: string, label: string, format?: (value, row) => string }>`, `filename: string` (no extension).
  - `useAuditLog()` additionally returns `exportCsv: () => void`.

- [ ] **Step 1: Write the CSV helper**

Create `src/modules/dd/lib/csv.js`:

```js
// Minimal CSV writer for the DD module. XLSX export lives in
// @/lib/export-xlsx.js and is for data tables; the audit log is a text log, so
// CSV is the right shape and needs no dependency.

function escapeCell(v) {
  if (v == null) return ''
  const s = String(v)
  // Quote when the value contains a delimiter, a quote or a newline; double
  // any embedded quote. This is the whole of RFC 4180 that matters here.
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

export function downloadCsv(rows, columns, filename) {
  const header = columns.map(c => escapeCell(c.label)).join(',')
  const body = rows.map(row =>
    columns.map(c => {
      const raw = row[c.key]
      return escapeCell(c.format ? c.format(raw, row) : raw)
    }).join(','),
  )
  // The BOM makes Excel open a UTF-8 CSV without mangling accented names.
  const csv = '﻿' + [header, ...body].join('\r\n')

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${filename}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
```

- [ ] **Step 2: Verify the escaping**

```bash
node -e "import('./src/modules/dd/lib/csv.js').then(async ()=>{const src=await import('node:fs').then(f=>f.readFileSync('./src/modules/dd/lib/csv.js','utf8'));const esc=new Function('v', src.match(/function escapeCell[\s\S]*?\n}/)[0].replace('function escapeCell(v) {','').replace(/}$/,''));const a=(g,e,l)=>{if(g!==e)throw new Error('FAIL '+l+': got '+JSON.stringify(g)+' want '+JSON.stringify(e));console.log('ok  '+l)};a(esc('plain'),'plain','plain');a(esc(null),'','null');a(esc('a,b'),'\"a,b\"','comma quoted');a(esc('say \"hi\"'),'\"say \"\"hi\"\"\"','quote doubled');a(esc('line1\nline2'),'\"line1\nline2\"','newline quoted');console.log('ALL PASS')})"
```

Expected: five `ok` lines then `ALL PASS`.

- [ ] **Step 3: Add `exportCsv` to the composable**

In `src/modules/dd/composables/useAuditLog.js`:

Add to the imports:

```js
import { downloadCsv } from '../lib/csv.js'
import { tableLabel } from '../lib/schema.js'
```

Add before the `return` statement:

```js
  // Exports the current page, matching the DD app this replaces. The whole log
  // is deliberately not dumped — narrow it with the filters first.
  function exportCsv() {
    downloadCsv(rows.value, [
      { key: 'ts', label: 'When', format: v => (v ? new Date(v).toISOString() : '') },
      { key: 'actor', label: 'Who' },
      { key: 'action', label: 'Action' },
      { key: 'target_db', label: 'Database' },
      { key: 'table_id', label: 'Table', format: v => tableLabel(v) },
      { key: 'record_key', label: 'Record' },
      { key: 'column_name', label: 'Column' },
      { key: 'old_value', label: 'Old Value' },
      { key: 'new_value', label: 'New Value' },
      { key: 'detail', label: 'Detail' },
    ], `dd-audit-log-page-${currentPage.value}`)
  }
```

Add `exportCsv` to the returned object.

- [ ] **Step 4: Add the export button and cell formatting**

In `src/modules/dd/components/AuditLogTab.vue`:

Replace the whole `.audit__toolbar` block with:

```vue
    <div class="audit__toolbar">
      <p class="audit__count">
        {{ total }} {{ total === 1 ? 'entry' : 'entries' }}
      </p>
      <button
        class="audit__export"
        type="button"
        :disabled="!rows.length"
        @click="$emit('export')"
      >
        <span class="material-symbols-outlined">file_save</span>
        Export page
      </button>
    </div>
```

Replace the `<LiTable>` block with:

```vue
    <LiTable :data="rows" :columns="columns" row-key="audit_id" :loading="loading">
      <template #cell-ts="{ value }">{{ formatTs(value) }}</template>
      <template #cell-action="{ value }">
        <LiBadge :label="value" :variant="actionVariant(value)" size="sm" is-pill />
      </template>
      <template #cell-table_id="{ value }">{{ tableLabel(value) }}</template>
      <template #cell-column_name="{ value }">
        <code v-if="value" class="audit__col">{{ value }}</code>
        <span v-else class="audit__muted">—</span>
      </template>
      <template #cell-change="{ row }">
        <span v-if="!row.column_name" class="audit__muted">—</span>
        <span v-else class="audit__change">
          <span class="audit__old"><template v-if="row.old_value !== null">{{ row.old_value }}</template><i v-else class="audit__null">NULL</i></span>
          <span class="audit__arrow">→</span>
          <span class="audit__new"><template v-if="row.new_value !== null">{{ row.new_value }}</template><i v-else class="audit__null">NULL</i></span>
        </span>
      </template>
      <template #cell-detail="{ value }">
        <template v-if="value">{{ value }}</template>
        <span v-else class="audit__muted">—</span>
      </template>
    </LiTable>
```

Replace the `columns` array — `old_value` and `new_value` become one `change` column:

```js
const columns = [
  { key: 'ts', label: 'When' },
  { key: 'actor', label: 'Who' },
  { key: 'action', label: 'Action' },
  { key: 'table_id', label: 'Table' },
  { key: 'record_key', label: 'Record' },
  { key: 'column_name', label: 'Column' },
  { key: 'change', label: 'Old → New' },
  { key: 'detail', label: 'Detail' },
]
```

Add `LiBadge` to the imports and `actionVariant` after `formatTs`:

```js
import LiBadge from '@lib/components/LiBadge.vue'
```

```js
function actionVariant(action) {
  if (action === 'INSERT') return 'success'
  if (action === 'UPDATE') return 'warning'
  if (action === 'DELETE') return 'error'
  return 'neutral'
}
```

Add `'export'` to the `defineEmits` array.

Add to `<style scoped>`:

```css
.audit__export {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 8px 16px;
  border: 1px solid rgba(0,0,0,0.1);
  border-radius: var(--radius-pill, 999px);
  background: transparent;
  font-family: var(--font-body, 'Inter', sans-serif);
  font-size: 13px; font-weight: 600;
  color: var(--color-gray-700, #666);
  cursor: pointer; transition: all 200ms;
}
.audit__export:hover:not(:disabled) { background: rgba(0,0,0,0.04); }
.audit__export:disabled { opacity: 0.45; cursor: not-allowed; }
.audit__export .material-symbols-outlined { font-size: 17px; }

.audit__col {
  font-family: var(--font-mono, ui-monospace, monospace);
  font-size: 12px;
  background: rgba(0,0,0,0.04);
  border-radius: 5px; padding: 1px 6px;
}
.audit__muted { color: var(--color-gray-400, #aaa); }
.audit__change { display: inline-flex; align-items: center; gap: 6px; flex-wrap: wrap; font-size: 13px; }
/* Struck through so a removed value reads as removed at a glance. */
.audit__old { text-decoration: line-through; color: var(--color-gray-500, #8e8ea0); }
.audit__new { font-weight: 600; }
.audit__arrow { color: var(--color-gray-400, #aaa); }
/* A NULL must not look like an empty string — the difference matters here. */
.audit__null { font-style: normal; font-size: 11px; letter-spacing: 0.4px; color: var(--color-gray-400, #aaa); }
</style>
```

- [ ] **Step 5: Wire the export event in the shell**

In `src/modules/dd/views/DdView.vue`, add to the `<AuditLogTab>` element:

```vue
          @export="audit.exportCsv()"
```

- [ ] **Step 6: Verify formatting in the browser**

Seed one row of each action:

```sql
insert into public.dd_audit_log (actor, action, target_db, table_id, record_key, column_name, old_value, new_value, detail)
values
  ('FMT TEST', 'INSERT',  'ihybrid_order',    'bu_accounts', 'FMT|PRIME', null,         null,     null,      null),
  ('FMT TEST', 'UPDATE',  'ihybrid_order',    'bu_accounts', 'FMT|PRIME', 'acctname1',  'before', 'after',   null),
  ('FMT TEST', 'UPDATE',  'ihybrid_order',    'bu_accounts', 'FMT|PRIME', 'created_by', 'someone', null,     null),
  ('FMT TEST', 'DELETE',  'ihybrid_discount', 'merchants',   'FMT_M_001', null,         null,     null,      null),
  ('FMT TEST', 'REPLACE', 'ihybrid_discount', 'promos',      null,        null,         null,     null,      '42 row(s) rewritten');
```

Reload `/dd`, filter actor to `FMT TEST`, and confirm:

1. Action badges are colour-coded: INSERT green, UPDATE amber, DELETE red, REPLACE grey.
2. The `acctname1` row reads `before → after` with `before` struck through.
3. The `created_by` row reads `someone → NULL`, with `NULL` rendered as muted small caps — **visibly different from an empty cell**.
4. INSERT and DELETE rows show `—` in both Column and Old → New.
5. The REPLACE row shows its detail text and `—` elsewhere.
6. Timestamps read like `13 Aug 2026, 14:32`.

- [ ] **Step 7: Verify the CSV export**

Click **Export page**. Open the downloaded `dd-audit-log-page-1.csv`.

Confirm: a header row `When,Who,Action,Database,Table,Record,Column,Old Value,New Value,Detail`; one row per visible table row and no more (it exports the page, not the whole log); the Table column reads `BU Accounts`, not `bu_accounts`; the REPLACE row's detail `42 row(s) rewritten` sits in one cell — the comma inside it must not split the row.

- [ ] **Step 8: Verify the disabled state**

Set a filter that matches nothing (search `zzzznomatch`).

Expected: the table shows its empty state and **Export page** is disabled.

- [ ] **Step 9: Clean up**

```sql
delete from public.dd_audit_log where actor = 'FMT TEST';
```

- [ ] **Step 10: Verify the build**

```bash
npm run build
```

Expected: succeeds.

- [ ] **Step 11: Commit**

```bash
git add src/modules/dd/lib/csv.js src/modules/dd/components/AuditLogTab.vue src/modules/dd/composables/useAuditLog.js src/modules/dd/views/DdView.vue
git commit -m "feat(dd): audit log cell formatting and CSV export"
```

---

### Task 8: Access gating, end-to-end verification and docs

**Files:**
- Modify: `CLAUDE.md`

**Interfaces:**
- Consumes: everything from Tasks 1–7.
- Produces: nothing new — this task is the acceptance gate for Phase 1.

- [ ] **Step 1: Verify the audit log is append-only from the browser**

With the app open and signed in, run in the browser console via `mcp__Claude_Browser__javascript_tool`:

```js
const { supabase } = await import('/src/lib/supabase.js');
const one = await supabase.from('dd_audit_log').select('audit_id').limit(1).single();
const del = await supabase.from('dd_audit_log').delete().eq('audit_id', one.data.audit_id);
const upd = await supabase.from('dd_audit_log').update({ actor: 'HACKED' }).eq('audit_id', one.data.audit_id);
const ins = await supabase.from('dd_audit_log').insert({ action: 'INSERT', target_db: 'x', table_id: 'y' });
const still = await supabase.from('dd_audit_log').select('actor').eq('audit_id', one.data.audit_id).single();
JSON.stringify({ del: del.error?.code, upd: upd.error?.code, ins: ins.error?.code, actor: still.data.actor });
```

Expected: all three of `del`, `upd` and `ins` carry an error code (`42501`, or `PGRST116`/`PGRST301` depending on the client version) and `actor` is unchanged — **not** `HACKED`.

If any of the three succeeds, stop. The append-only guarantee is broken and Task 2's RLS must be fixed before Phase 1 can be called done.

- [ ] **Step 2: Verify access gating**

In `/admin` → Modules, create or pick a non-Admin role and remove the `audit.read` feature from the `dd` module. Sign in as a user with that role.

Expected: the Audit Log tab is not rendered at all in `/dd` (not merely disabled), and the shell opens on whichever tab is first granted.

Then remove the whole `dd` module from that role and reload `/dd`.

Expected: the router guard redirects away — to `/dashboard` if granted, otherwise the first granted module. `DD MPM` disappears from the sidebar.

Restore the role's access afterwards.

- [ ] **Step 3: Verify the end-to-end path named in the spec**

Sign back in as an Admin. In `/qrdd` → BU Accounts, edit an account's expense account name **and** its SOF value, and save. Then open `/dd` → Audit Log.

Expected: two `UPDATE` rows, one per changed column, both carrying your display name — not `SYSTEM`, and not the email address stored in `updated_by`. The record key reflects the values at write time.

This is the acceptance criterion for Phase 1: writes made through the still-live `qrdd` screens are audited without `qrdd` having been modified at all.

- [ ] **Step 4: Confirm no qrdd file was touched**

```bash
git diff --name-only main...HEAD -- src/modules/qrdd/
```

Expected: **empty output**. Any file listed here violates the plan's constraint that `qrdd` keeps working untouched — revert it.

- [ ] **Step 5: Confirm schema.sql is still idempotent end to end**

Run the whole of `supabase/schema.sql` a second time in the Supabase SQL editor.

Expected: `Success. No rows returned`. Errors here mean section 12 is not re-runnable — the likely culprits are the publication guard and the `create trigger` statements missing their `drop ... if exists`.

- [ ] **Step 6: Update CLAUDE.md**

In the **Modules** table, add a row after the `qrdd` row:

```markdown
| dd | `/dd` | Supabase: `dd_audit_log` (+ reads the `qrdd_*` tables) |
```

In the **Supabase schema** section, append this paragraph:

```markdown
`dd_audit_log` is **append-only**: `authenticated` holds `select` and nothing
else, and the only writer is the `dd_audit_row()` trigger (security definer) on
the three `qrdd_*` tables. It records one row per record for INSERT/DELETE and
one row per changed column for UPDATE, skipping `updated_at`/`updated_by`. The
actor comes from `dd_actor()` (`auth.uid()` → `profiles.full_name`), not from
the client-supplied `created_by`/`updated_by` columns.
```

In the **Docs** section, append:

```markdown
The DD module is a phased port of the `VIBE/DD` Apps Script app. Phase 1 (module,
schema mapping, audit log) is specced in
`docs/superpowers/specs/2026-08-13-dd-module-phase1-design.md` and planned in
`docs/superpowers/plans/2026-08-13-dd-module-phase1.md`; that spec's header
lists all six phases. `qrdd` is retired after Phase 2 — until then both modules
ship, and `qrdd` is the working surface for BU accounts, merchants and promos.
```

- [ ] **Step 7: Final build**

```bash
npm run build
```

Expected: succeeds.

- [ ] **Step 8: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: record the dd module and its append-only audit log"
```

---

## Out of scope for this plan

Named so a reviewer does not flag them as gaps. Each is scheduled, not dropped — see the spec header for the six-phase breakdown.

- BU / Merchant / Promo screens under `/dd` — **Phase 2**. `/qrdd` stays the working surface until then.
- Retiring the `qrdd` module and removing section 11 from `schema.sql` — one commit after Phase 2.
- Realtime subscriptions and stale-data banners — **Phase 2**. `dd_audit_log` joins the publication in Task 2, but nothing subscribes yet.
- The rich dashboard (expiring soon, needs attention, starting soon, BU coverage) — **Phase 3**. The Dashboard tab shows a placeholder.
- SQL export, Export Center, `app_instances` cache-reset statements — **Phase 4**. `schema.js` declares `targetTable`, `timestamps`, `textColumns`, `EXPORT_ORDER` and the cache-reset constants for it; nothing reads them in Phase 1, which is expected and not dead code to be removed.
- Table Explorer, SQL Editor, and any code writing `REPLACE` audit rows — **Phase 5**. The `REPLACE` action is already permitted by the CHECK constraint so Phase 5 needs no migration.
- Scheduled emails, `dd_email_settings`, the Edge Function, pg_cron — **Phase 6**, and blocked on confirming the Zimbra SMTP host is reachable from Supabase's Edge runtime.
- Renaming the three `qrdd_*` tables — explicitly rejected.
- Backfilling audit history for rows written before Task 2 — impossible; the old values were never recorded.
- Adding a JavaScript test framework — the repo has none and this plan does not introduce one.
