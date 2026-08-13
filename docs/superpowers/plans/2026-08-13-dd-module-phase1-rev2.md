# DD Module Phase 1 Implementation Plan — rev 2

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give SP-lite a `dd` module that reproduces DD MPM's navigation and access model — a nested route tree behind its own grouped sidebar, with menu and database access granted on two independent axes — plus an append-only audit log and its browsing screen.

**Architecture:** `/dd` is a parent route rendering `DdLayout.vue` (DD-style secondary sidebar + `<RouterView>`) over eight children. Access runs on two axes encoded as feature ids under one module: menu scopes (`merchants.update`) and database scopes (`db.ihybrid_discount.update`). `useDdAccess()` applies DD's rule that a table is reachable through its menu **or** its database, keeping SP-lite's shared `computeAccess` untouched. Three database triggers write one audit row per record for INSERT/DELETE and one per changed column for UPDATE, into a table `authenticated` can only read.

**Tech Stack:** Vue 3 (`<script setup>`), Vue Router (hash history, nested routes), Supabase JS v2, Postgres (PL/pgSQL triggers, RLS), Vite. Design system: `src/lib/components/Li*.vue`.

**Supersedes:** `2026-08-13-dd-module-phase1.md`. Tasks 1-3 there are **already complete and unchanged** — see "Already done" below. Its Task 4 (an eight-tab pill strip) was built as `6d91b54`, rejected on review for not matching DD's navigation, and reverted in `e9bc758`. Tasks 4-10 here replace its Tasks 4-8.

**Spec:** `docs/superpowers/specs/2026-08-13-dd-module-phase1-design.md` (revised 2026-08-13 — read its "Revision" subsection first).

## Global Constraints

- **No test framework exists in this repo, and this plan does not add one.** `npm run test` does not exist. Verification is: SQL assertions against the live Supabase project, `node -e` assertions for pure modules, `npm run build`, and browser checks through the Browser pane against the `sp-lite-dev` launch config.
- **No linter is configured.** Match the surrounding code style by eye.
- **Path aliases:** `@` → `src/`, `@lib` → `src/lib/`. `src/router/index.js` uses relative `../modules/...` imports as its established local convention — follow it there.
- **The three existing tables keep their `qrdd_*` names.** Do not alter their columns, constraints or policies.
- **All new database objects use the `dd_` prefix.**
- **Downstream mapping is fixed:** `qrdd_bu_accounts` → `ihybrid_order.discount_bu_accounts`; `qrdd_merchant_whitelist` → `ihybrid_discount.merchant_whitelist`; `qrdd_promo_rules` → `ihybrid_discount.promo_info`.
- **`supabase/schema.sql` must stay idempotent and re-runnable.** Sections 12 and 12b are DD's. Section 11 (`QR DD Module`) is left exactly as-is.
- **The `qrdd` module must keep working untouched.** No file under `src/modules/qrdd/` is modified.
- **Do not modify `src/lib/access.js`, `src/composables/useAccess.js`, or `src/App.vue`.** `access.js` is a verbatim port of SO-Platform's and is shared by every module. The two-axis OR belongs in `useDdAccess()`.
- **Work on branch `feat/dd-module-phase1`.** Do not commit to `main` — pushing to `main` triggers a Pages deploy.
- **Migrations are applied to the live project** (24 BU accounts, 1 merchant, 0 promos, audit log currently empty). Any test rows must be prefixed `ZZ_` and cleaned up, with the cleanup verified.
- **A signed-in session already exists in the Browser pane** and `.env.local` holds the project URL and anon key. Do not create accounts, and do not enter passwords — if the session has expired, report it rather than attempting to sign in.
- **`app_config` is not ported.** DD's `user_access` and `role` sheets are already SP-lite's RBAC tables under `/admin`. Only Email Settings has no equivalent, and it is Phase 6.

## Already done — do not redo

| Task | Commit | Delivered |
|---|---|---|
| 1 | `e16183a` | `src/modules/dd/lib/schema.js` — `DD_TABLES`, `EXPORT_ORDER`, cache-reset constants, `byLocal`/`targetDbs`/`tableLabel` |
| 2 | `d176e32` | `dd_audit_log` + `dd_actor()`/`dd_record_key()`/`dd_audit_row()`/`dd_audit_actors()` + 3 triggers + append-only RLS + TRUNCATE revokes + realtime publication; mirrored into `schema.sql` §12 |
| 3 | `d147610` | `dd` module in `MODULE_REGISTRY` with 20 features, the `/dd` route, `20260813_dd_module_seed.sql`, `schema.sql` §12b |

Current live access state: Admin holds 20 `dd` features; all 7 roles have the `dd` module; the only non-Admin role with `dd` grants is "Digital Lending" with 9 CRUD features.

`src/modules/dd/views/DdView.vue` currently exists as the stub `<template><div /></template>`, left by the revert. Task 6 deletes it.

---

### Task 4: Database-axis features

DD grants raw-table and SQL-editor access **per database**, independently of the guided-screen menus. Those eight scopes do not exist yet.

**Files:**
- Create: `supabase/migrations/20260813_dd_module_seed_db_axis.sql`
- Modify: `src/lib/modules.js` (the `dd` entry's `features` array)
- Modify: `supabase/schema.sql` (§12b Admin seed list → all 28)

**Interfaces:**
- Consumes: the `dd` module and its 20 features from Task 3.
- Produces: eight new feature ids, consumed by Task 5's `canDatabase()` and Task 6's sidebar —
  `db.ihybrid_order.read`, `db.ihybrid_order.create`, `db.ihybrid_order.update`, `db.ihybrid_order.delete`,
  `db.ihybrid_discount.read`, `db.ihybrid_discount.create`, `db.ihybrid_discount.update`, `db.ihybrid_discount.delete`.

- [ ] **Step 1: Add the features to the registry**

In `src/lib/modules.js`, inside the `dd` entry's `features` array, after the `email.update` line:

```js
      // Database axis. DD grants raw-table and SQL-editor access per database,
      // independently of the menu features above, so someone can be given
      // ihybrid_order alone without ihybrid_discount.
      { id: 'db.ihybrid_order.read',   label: 'DB ihybrid_order — Read',   desc: 'Browse raw tables in ihybrid_order.' },
      { id: 'db.ihybrid_order.create', label: 'DB ihybrid_order — Create', desc: 'Insert rows into ihybrid_order tables.' },
      { id: 'db.ihybrid_order.update', label: 'DB ihybrid_order — Update', desc: 'Edit rows in ihybrid_order tables.' },
      { id: 'db.ihybrid_order.delete', label: 'DB ihybrid_order — Delete', desc: 'Delete rows from ihybrid_order tables.' },
      { id: 'db.ihybrid_discount.read',   label: 'DB ihybrid_discount — Read',   desc: 'Browse raw tables in ihybrid_discount.' },
      { id: 'db.ihybrid_discount.create', label: 'DB ihybrid_discount — Create', desc: 'Insert rows into ihybrid_discount tables.' },
      { id: 'db.ihybrid_discount.update', label: 'DB ihybrid_discount — Update', desc: 'Edit rows in ihybrid_discount tables.' },
      { id: 'db.ihybrid_discount.delete', label: 'DB ihybrid_discount — Delete', desc: 'Delete rows from ihybrid_discount tables.' },
```

- [ ] **Step 2: Write the migration**

Create `supabase/migrations/20260813_dd_module_seed_db_axis.sql`:

```sql
-- DD module — the database access axis.
--
-- DD grants raw-table and SQL-editor access per database, independently of the
-- guided-screen menus, so a role can be given ihybrid_order alone. These eight
-- features are the second axis; the twenty from 20260813_dd_module_seed.sql are
-- the first.
--
-- Admin only. Handing a database scope to a non-Admin role is a deliberate act
-- performed in the Admin UI, because it bypasses the guided forms' validation
-- affordances.

insert into public.feature_access (role, module_id, feature_id)
select 'Admin', 'dd', f.feature_id
from (values
  ('db.ihybrid_order.read'), ('db.ihybrid_order.create'),
  ('db.ihybrid_order.update'), ('db.ihybrid_order.delete'),
  ('db.ihybrid_discount.read'), ('db.ihybrid_discount.create'),
  ('db.ihybrid_discount.update'), ('db.ihybrid_discount.delete')
) as f(feature_id)
where not exists (
  select 1 from public.feature_access fa
  where fa.role = 'Admin' and fa.module_id = 'dd' and fa.feature_id = f.feature_id
);
```

- [ ] **Step 3: Apply it**

Load the Supabase MCP tools first: `ToolSearch` with query `select:mcp__supabase__apply_migration,mcp__supabase__execute_sql`.

Apply with `apply_migration`, name `dd_module_seed_db_axis`.

Expected: success, no error.

- [ ] **Step 4: Verify the counts**

```sql
select count(*) as admin_total from public.feature_access where role='Admin' and module_id='dd';
select count(*) as admin_db_axis from public.feature_access
  where role='Admin' and module_id='dd' and feature_id like 'db.%';
select count(*) as nonadmin_db_axis from public.feature_access
  where module_id='dd' and role<>'Admin' and feature_id like 'db.%';
```

Expected: `admin_total = 28`, `admin_db_axis = 8`, `nonadmin_db_axis = 0`.

The last one matters: a non-Admin role must not acquire a database scope by accident. If it is not zero, the carry-over statement from Task 3 has leaked and must be investigated before continuing.

- [ ] **Step 5: Verify idempotency**

Apply the migration a second time, then re-run the queries from Step 4.

Expected: identical numbers — `admin_total` is still 28, not 36.

- [ ] **Step 6: Mirror into schema.sql**

In `supabase/schema.sql`, find the §12b Admin `feature_access` seed's `values` list and extend it so a from-scratch run seeds all 28 in one pass. After the `('email.read'), ('email.update')` line add:

```sql
  ('db.ihybrid_order.read'), ('db.ihybrid_order.create'),
  ('db.ihybrid_order.update'), ('db.ihybrid_order.delete'),
  ('db.ihybrid_discount.read'), ('db.ihybrid_discount.create'),
  ('db.ihybrid_discount.update'), ('db.ihybrid_discount.delete')
```

Mind the comma on the previous line: `('email.update')` must become `('email.update'),`.

- [ ] **Step 7: Verify the mirrored section still runs clean**

Re-run just §12b in the SQL editor, then re-run Step 4's first query.

Expected: no error, `admin_total` still 28.

- [ ] **Step 8: Build and commit**

```bash
npm run build
```

Expected: succeeds.

```bash
git add src/lib/modules.js supabase/migrations/20260813_dd_module_seed_db_axis.sql supabase/schema.sql
git commit -m "feat(dd): add the database access axis (8 features)"
```

---

### Task 5: Two-axis access composable

DD's rule, in one file: *a table is reachable through its menu or through its database.*

> **Amended during execution.** Review of the first attempt found this task's
> code as written below to be wrong in three ways, all of them defects in this
> plan rather than in the implementation:
>
> 1. `canMenu('dashboard')` builds `dashboard.read`, which is **not** one of the
>    28 seeded features — the dashboard would have been permanently unreachable.
>    Resolved by the human: the DD dashboard follows module access. `'dashboard'`
>    leaves `DD_MENUS`, a `canDashboard() => canModule('dd')` predicate replaces
>    it, and the `/dd` index route carries no `ddMenu` gate.
> 2. `isReadOnly`'s scope enumeration cannot see `tables.update` or `sql.write`.
>    Replaced by deriving it from the granted feature list with the regex
>    `/\.(create|update|delete|write)$/`, which closes the failure class rather
>    than patching two instances.
> 3. Argument order was inconsistent across the predicates and failed silently
>    on misuse. **All public predicates are now scope-first with the action
>    defaulting to `'read'`:** `canMenu(menu, action = 'read')`,
>    `canDatabase(db, action = 'read')`, `canTable(idOrName, action = 'read')`.
>    `canTable` also accepts a downstream table name via `byTargetTable`.
>
> Task 6's code below already calls the amended signatures. The code block in
> Step 3 of this task, and its verification script in Step 4, are the superseded
> originals — kept for the record, not to be re-applied.

**Files:**
- Modify: `src/modules/dd/lib/schema.js` (replace `readGate` with `menu`, add `byTargetTable`)
- Create: `src/modules/dd/composables/useDdAccess.js`

**Interfaces:**
- Consumes: `useAccess()` from `@/composables/useAccess.js` — `canFeature(moduleId, featureId)` and `canModule(moduleId)`; the 28 feature ids from Tasks 3-4.
- Produces:
  - `schema.js` gains `menu` on each `DD_TABLES` entry (`'bu-accounts' | 'merchants' | 'promos'`) and `byTargetTable(name)`; `readGate` is removed.
  - `useDdAccess()` returning `{ can, canMenu, canDatabase, canTable, visibleDatabases, isReadOnly, firstAllowedDdRoute }`.
  - `DD_MENUS` — the eight menu scope strings.
  - Consumed by Task 6's sidebar and router guard.

- [ ] **Step 1: Add `menu` and `byTargetTable` to schema.js**

The `DD_TABLES` keys use underscores (`bu_accounts`) but the seeded feature ids use hyphens (`bu-accounts.read`), so the menu scope cannot be derived from the key. Make it explicit.

In `src/modules/dd/lib/schema.js`, in each of the three entries, replace the `readGate:` line with a `menu:` line:

- `bu_accounts`: `readGate: 'bu-accounts.read',` → `menu: 'bu-accounts',`
- `merchants`: `readGate: 'merchants.read',` → `menu: 'merchants',`
- `promos`: `readGate: 'promos.read',` → `menu: 'promos',`

Add this comment above the `bu_accounts` entry's `menu` line:

```js
    // Menu scope name for the access axis. Spelled with hyphens to match the
    // seeded feature ids (`bu-accounts.read`), which differ from this object's
    // underscored key — so it cannot be derived and is stated instead.
```

Then append this helper next to `byLocal`:

```js
export function byTargetTable(name) {
  return Object.values(DD_TABLES).find(t => t.targetTable === name)
}
```

`byTargetTable` looks up by the **downstream** name (`discount_bu_accounts`, `merchant_whitelist`, `promo_info`) because that is what the sidebar displays and what the `/dd/table/:name` route carries, matching DD's own `/table/:name`.

- [ ] **Step 2: Verify schema.js still loads and the new fields are right**

```bash
node -e "import('./src/modules/dd/lib/schema.js').then(m=>{const a=(c,l)=>{if(!c)throw new Error('FAIL: '+l);console.log('ok  '+l)};a(m.DD_TABLES.bu_accounts.menu==='bu-accounts','bu menu is hyphenated');a(m.DD_TABLES.merchants.menu==='merchants','merchants menu');a(m.DD_TABLES.promos.menu==='promos','promos menu');a(!('readGate' in m.DD_TABLES.bu_accounts),'readGate removed');a(m.byTargetTable('promo_info').id==='promos','byTargetTable promo_info');a(m.byTargetTable('discount_bu_accounts').targetDb==='ihybrid_order','byTargetTable db');a(m.byTargetTable('qrdd_promo_rules')===undefined,'byTargetTable does not match local names');a(m.byLocal('qrdd_promo_rules').id==='promos','byLocal still works');console.log('ALL PASS')})"
```

Expected: eight `ok` lines then `ALL PASS`.

- [ ] **Step 3: Write the composable**

Create `src/modules/dd/composables/useDdAccess.js`:

```js
import { computed } from 'vue'
import { useAccess } from '@/composables/useAccess.js'
import { DD_TABLES, targetDbs } from '../lib/schema.js'

// DD's access model has two independent axes, both granted per action:
//
//   menu      dashboard, bu-accounts, merchants, promos, export, audit, sql, email
//   database  ihybrid_order, ihybrid_discount
//
// SP-lite's computeAccess resolves one flat feature list per module, so both
// axes live under the `dd` module as feature ids and the OR between them is
// applied here rather than in src/lib/access.js — which is a verbatim port of
// SO-Platform's and shared by every other module.

export const DD_MENUS = [
  'dashboard', 'bu-accounts', 'merchants', 'promos',
  'export', 'audit', 'sql', 'email',
]

const WRITE_ACTIONS = ['create', 'update', 'delete']

// Menu -> DD route name, in DD's own precedence order for "first screen this
// person may open" (src/stores/access.js firstAllowedRoute).
const MENU_ROUTES = [
  ['dashboard',   'dd'],
  ['promos',      'dd-promos'],
  ['merchants',   'dd-merchants'],
  ['bu-accounts', 'dd-business-units'],
  ['export',      'dd-export'],
  ['audit',       'dd-audit'],
  ['sql',         'dd-sql'],
]

export function useDdAccess() {
  const { canFeature, canModule } = useAccess()

  const can = (action, scope) => canFeature('dd', `${scope}.${action}`)

  const canMenu = (menu, action = 'read') => can(action, menu)

  const canDatabase = (action, db) => can(action, `db.${db}`)

  // DD's rule verbatim: "A sheet is reachable through its menu or through its
  // database." Granting ihybrid_order alone therefore opens
  // discount_bu_accounts as a raw table without opening ihybrid_discount.
  const canTable = (action, tableId) => {
    const t = DD_TABLES[tableId]
    if (!t) return false
    return can(action, t.menu) || canDatabase(action, t.targetDb)
  }

  const visibleDatabases = computed(() =>
    targetDbs().filter(db => canDatabase('read', db)),
  )

  // No write scope on either axis. DD uses this to render whole screens
  // read-only rather than offering buttons that would fail.
  const isReadOnly = computed(() =>
    !WRITE_ACTIONS.some(action =>
      DD_MENUS.some(m => can(action, m)) ||
      targetDbs().some(db => canDatabase(action, db)),
    ),
  )

  const firstAllowedDdRoute = computed(() => {
    const hit = MENU_ROUTES.find(([menu]) => canMenu(menu))
    return hit ? { name: hit[1] } : null
  })

  return {
    can, canMenu, canDatabase, canTable,
    visibleDatabases, isReadOnly, firstAllowedDdRoute,
    canModule,
  }
}
```

- [ ] **Step 4: Verify the OR logic with a stubbed access layer**

`useDdAccess` depends on `useAccess`, which reads the session singleton, so test the logic against a stub rather than a live session. Create a throwaway file `/tmp/dd-access-check.mjs`:

```js
// Re-implements only the composable's pure logic against a fake grant set, to
// prove the two-axis OR behaves like DD's canWriteSheet in all combinations.
const DD_TABLES = {
  bu_accounts: { menu: 'bu-accounts', targetDb: 'ihybrid_order' },
  merchants:   { menu: 'merchants',   targetDb: 'ihybrid_discount' },
  promos:      { menu: 'promos',      targetDb: 'ihybrid_discount' },
}
const make = (granted) => {
  const can = (action, scope) => granted.includes(`${scope}.${action}`)
  const canDatabase = (action, db) => can(action, `db.${db}`)
  const canTable = (action, id) => {
    const t = DD_TABLES[id]
    return t ? (can(action, t.menu) || canDatabase(action, t.targetDb)) : false
  }
  return { can, canDatabase, canTable }
}
const a = (c, l) => { if (!c) throw new Error('FAIL: ' + l); console.log('ok  ' + l) }

// menu only
let x = make(['merchants.update'])
a(x.canTable('update', 'merchants') === true, 'menu alone grants the table')
a(x.canDatabase('update', 'ihybrid_discount') === false, 'menu alone does not grant the database')

// database only
x = make(['db.ihybrid_discount.update'])
a(x.canTable('update', 'merchants') === true, 'database alone grants the table')
a(x.canTable('update', 'bu_accounts') === false, 'other database is unaffected')

// neither
x = make(['merchants.read'])
a(x.canTable('update', 'merchants') === false, 'read does not imply update')

// both
x = make(['merchants.update', 'db.ihybrid_discount.update'])
a(x.canTable('update', 'merchants') === true, 'both grants still true')

// database isolation — the property that proves the port is faithful
x = make(['db.ihybrid_order.read'])
a(x.canDatabase('read', 'ihybrid_order') === true,  'ihybrid_order granted')
a(x.canDatabase('read', 'ihybrid_discount') === false, 'ihybrid_discount NOT granted')
a(x.canTable('read', 'bu_accounts') === true,  'bu_accounts readable via its database')
a(x.canTable('read', 'merchants') === false, 'merchants not readable')

// unknown table
a(make(['x.read']).canTable('read', 'nope') === false, 'unknown table id is denied')
console.log('ALL PASS')
```

Run:

```bash
node /tmp/dd-access-check.mjs
```

Expected: eleven `ok` lines then `ALL PASS`.

This is a logic check on a re-implementation, not on the composable itself — say so plainly in your report. The composable is exercised for real in Task 10's browser gating checks.

- [ ] **Step 5: Build and commit**

```bash
npm run build
```

Expected: succeeds. Nothing imports the composable yet, so this only proves it parses.

```bash
git add src/modules/dd/lib/schema.js src/modules/dd/composables/useDdAccess.js
git commit -m "feat(dd): two-axis access composable mirroring DD's canWriteSheet"
```

---

### Task 6: Nested routes, DD layout and sidebar

The shape change. `/dd` becomes a parent route with eight children behind DD's own grouped sidebar.

**Files:**
- Delete: `src/modules/dd/views/DdView.vue`
- Modify: `src/router/index.js`
- Create: `src/modules/dd/views/DdLayout.vue`
- Create: `src/modules/dd/components/DdSidebar.vue`
- Create: `src/modules/dd/components/DdPlaceholder.vue`
- Create: `src/modules/dd/composables/useDdTableCounts.js`
- Create: `src/modules/dd/views/DdDashboard.vue`
- Create: `src/modules/dd/views/DdBuAccounts.vue`, `DdMerchants.vue`, `DdPromos.vue`, `DdTableExplorer.vue`, `DdExport.vue`, `DdSqlEditor.vue`

**Interfaces:**
- Consumes: `useDdAccess()` and `DD_TABLES`/`byTargetTable`/`targetDbs` from Task 5; `supabase` from `@/lib/supabase.js`.
- Produces: route names `dd`, `dd-business-units`, `dd-merchants`, `dd-promos`, `dd-table`, `dd-export`, `dd-audit`, `dd-sql`. Task 7 replaces `DdAudit.vue`'s placeholder body with the real screen. `DdPlaceholder.vue` props: `{ title: String, phase: String, icon: String, note: String }`.

- [ ] **Step 1: Replace the route with a nested tree**

In `src/router/index.js`, replace the entire existing `/dd` route object with:

```js
  {
    path: '/dd',
    meta: { module: 'dd', label: 'DD MPM', icon: 'inventory' },
    component: () => import('../modules/dd/views/DdLayout.vue'),
    children: [
      // `name: 'dd'` must stay on the index child: SP-lite's sidebar and
      // firstAccessibleRoute() resolve a module to { name: moduleId }.
      // No ddMenu gate on the index child: the dashboard follows module access,
      // so /dd always has a valid landing screen. `dashboard.read` is not a
      // seeded feature — gating on it would refuse everyone, Admin included.
      { path: '',               name: 'dd',                                                   component: () => import('../modules/dd/views/DdDashboard.vue') },
      { path: 'business-units', name: 'dd-business-units', meta: { ddMenu: 'bu-accounts' },   component: () => import('../modules/dd/views/DdBuAccounts.vue') },
      { path: 'merchants',      name: 'dd-merchants',      meta: { ddMenu: 'merchants' },     component: () => import('../modules/dd/views/DdMerchants.vue') },
      { path: 'promos',         name: 'dd-promos',         meta: { ddMenu: 'promos' },        component: () => import('../modules/dd/views/DdPromos.vue') },
      { path: 'table/:name',    name: 'dd-table',          meta: { ddTableParam: 'name' },    component: () => import('../modules/dd/views/DdTableExplorer.vue') },
      { path: 'export',         name: 'dd-export',         meta: { ddMenu: 'export' },        component: () => import('../modules/dd/views/DdExport.vue') },
      { path: 'audit',          name: 'dd-audit',          meta: { ddMenu: 'audit' },         component: () => import('../modules/dd/views/DdAudit.vue') },
      { path: 'sql',            name: 'dd-sql',            meta: { ddMenu: 'sql' },           component: () => import('../modules/dd/views/DdSqlEditor.vue') },
    ],
  },
```

- [ ] **Step 2: Add the DD guard clause**

Still in `src/router/index.js`, add this import at the top:

```js
import { useDdAccess } from '../modules/dd/composables/useDdAccess.js'
import { byTargetTable } from '../modules/dd/lib/schema.js'
```

Then inside `router.beforeEach`, immediately **after** the existing
`if (to.meta.module && !canModule(to.meta.module))` block and **before** the final `return true`:

```js
  // DD's second access axis. A guided screen is gated by its menu; a raw table
  // is gated by the database that owns it. Mirrors the DD app's own guard,
  // which special-cases the table route for exactly this reason.
  if (to.matched.some(r => r.meta.module === 'dd')) {
    const { canMenu, canDatabase, firstAllowedDdRoute } = useDdAccess()

    if (to.meta.ddMenu && !canMenu(to.meta.ddMenu)) {
      return firstAllowedDdRoute.value ?? firstAccessibleRoute()
    }

    if (to.meta.ddTableParam) {
      const t = byTargetTable(String(to.params[to.meta.ddTableParam] || ''))
      if (!t || !canDatabase(t.targetDb)) {
        return firstAllowedDdRoute.value ?? firstAccessibleRoute()
      }
    }
  }
```

`to.matched.some(...)` rather than `to.meta.module` because `meta.module` lives on the parent and Vue Router only merges parent meta into `to.meta` for keys the child does not define — checking `matched` is unambiguous.

- [ ] **Step 3: Write the placeholder component**

Create `src/modules/dd/components/DdPlaceholder.vue`:

```vue
<template>
  <div class="ddph">
    <span class="material-symbols-outlined ddph__icon">{{ icon }}</span>
    <h2 class="ddph__title">{{ title }}</h2>
    <p class="ddph__body">Not built yet — arriving in {{ phase }}.</p>
    <p v-if="note" class="ddph__note">{{ note }}</p>
  </div>
</template>

<script setup>
defineProps({
  title: { type: String, required: true },
  phase: { type: String, required: true },
  icon: { type: String, default: 'construction' },
  note: { type: String, default: '' },
})
</script>

<style scoped>
.ddph {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 6px; padding: 72px 24px; text-align: center;
  background: rgba(255, 255, 255, 0.5);
  border: 1px dashed rgba(0, 0, 0, 0.12);
  border-radius: var(--radius-md, 16px);
}
.ddph__icon { font-size: 40px; color: var(--color-gray-400, #aaa); }
.ddph__title { font-size: 18px; font-weight: 700; margin: 4px 0 0; }
.ddph__body { font-size: 14px; color: var(--color-gray-500, #8e8ea0); margin: 0; }
.ddph__note { font-size: 13px; color: var(--color-gray-400, #aaa); margin: 8px 0 0; max-width: 42ch; }
</style>
```

- [ ] **Step 4: Write the six placeholder views**

Each is a thin wrapper so the route tree is complete and every screen names its phase. Create all six.

`src/modules/dd/views/DdBuAccounts.vue`:

```vue
<template>
  <DdPlaceholder
    title="Business Units"
    phase="Phase 2"
    icon="account_balance"
    note="Until then, manage BU accounts in QR DD."
  />
</template>

<script setup>
import DdPlaceholder from '../components/DdPlaceholder.vue'
</script>
```

`src/modules/dd/views/DdMerchants.vue`:

```vue
<template>
  <DdPlaceholder
    title="Merchants"
    phase="Phase 2"
    icon="storefront"
    note="Until then, manage the merchant whitelist in QR DD."
  />
</template>

<script setup>
import DdPlaceholder from '../components/DdPlaceholder.vue'
</script>
```

`src/modules/dd/views/DdPromos.vue`:

```vue
<template>
  <DdPlaceholder
    title="Promos"
    phase="Phase 2"
    icon="sell"
    note="Until then, manage promo rules in QR DD."
  />
</template>

<script setup>
import DdPlaceholder from '../components/DdPlaceholder.vue'
</script>
```

`src/modules/dd/views/DdTableExplorer.vue`:

```vue
<template>
  <DdPlaceholder
    :title="label"
    phase="Phase 5"
    icon="table_rows"
    note="The raw table browser with inline editing arrives with the SQL editor."
  />
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import DdPlaceholder from '../components/DdPlaceholder.vue'
import { byTargetTable } from '../lib/schema.js'

const route = useRoute()
// The route carries the downstream table name, so show that rather than the
// local qrdd_* name — it is what the sidebar listed and what the person clicked.
const label = computed(() => {
  const name = String(route.params.name || '')
  return byTargetTable(name)?.targetTable ?? name
})
</script>
```

`src/modules/dd/views/DdExport.vue`:

```vue
<template>
  <DdPlaceholder
    title="Export"
    phase="Phase 4"
    icon="ios_share"
    note="SQL and XLSX export, scoped per table or across a date window."
  />
</template>

<script setup>
import DdPlaceholder from '../components/DdPlaceholder.vue'
</script>
```

`src/modules/dd/views/DdSqlEditor.vue`:

```vue
<template>
  <DdPlaceholder
    title="SQL Editor"
    phase="Phase 5"
    icon="terminal"
    note="Only databases you are granted will be mounted into the query engine."
  />
</template>

<script setup>
import DdPlaceholder from '../components/DdPlaceholder.vue'
</script>
```

- [ ] **Step 5: Write the row-count composable**

Create `src/modules/dd/composables/useDdTableCounts.js`:

```js
import { ref } from 'vue'
import { supabase } from '@/lib/supabase.js'
import { DD_TABLES } from '../lib/schema.js'

// Row counts for the sidebar's Databases group, keyed by DD_TABLES id.
// head: true sends no rows back — only the count header — so listing the
// sidebar never pulls table data into the browser.
export function useDdTableCounts() {
  const counts = ref({})
  const loading = ref(false)

  async function load(tableIds) {
    loading.value = true
    const out = { ...counts.value }
    await Promise.all(tableIds.map(async (id) => {
      const t = DD_TABLES[id]
      if (!t) return
      const { count, error } = await supabase
        .from(t.local)
        .select('*', { count: 'exact', head: true })
      // A count failure must not blank the sidebar; the entry just shows no
      // badge until the next reload.
      out[id] = error ? null : (count ?? 0)
    }))
    counts.value = out
    loading.value = false
  }

  return { counts, loading, load }
}
```

- [ ] **Step 6: Write the sidebar**

Create `src/modules/dd/components/DdSidebar.vue`:

```vue
<template>
  <nav class="ddnav">
    <header class="ddnav__brand">
      <div class="ddnav__mark">
        <span class="material-symbols-outlined">inventory</span>
      </div>
      <div class="ddnav__id">
        <span class="ddnav__name">DD MPM</span>
        <span class="ddnav__sub">Discount data management</span>
      </div>
    </header>

    <div class="ddnav__scroll">
      <template v-if="canDashboard()">
        <p class="ddnav__label">Overview</p>
        <RouterLink :to="{ name: 'dd' }" custom v-slot="{ isActive, navigate }">
          <button class="ddnav__item" :class="{ 'ddnav__item--active': isActive }" @click="navigate">
            <span class="material-symbols-outlined">dashboard</span>
            <span class="ddnav__text">Dashboard</span>
          </button>
        </RouterLink>
      </template>

      <template v-if="visibleManage.length">
        <p class="ddnav__label">Manage</p>
        <RouterLink
          v-for="item in visibleManage" :key="item.name"
          :to="{ name: item.name }" custom v-slot="{ isActive, navigate }"
        >
          <button class="ddnav__item" :class="{ 'ddnav__item--active': isActive }" @click="navigate">
            <span class="material-symbols-outlined">{{ item.icon }}</span>
            <span class="ddnav__text">{{ item.label }}</span>
          </button>
        </RouterLink>
      </template>

      <template v-if="visibleDatabases.length">
        <div class="ddnav__labelrow">
          <p class="ddnav__label">Databases</p>
          <button
            class="ddnav__icobtn" :class="{ 'ddnav__icobtn--spin': reloading }"
            aria-label="Reload row counts" @click="reload"
          >
            <span class="material-symbols-outlined">refresh</span>
          </button>
        </div>
        <div v-for="db in visibleDatabases" :key="db" class="ddnav__dbgroup">
          <p class="ddnav__dbname">
            <span class="material-symbols-outlined">dns</span>
            {{ db }}
          </p>
          <RouterLink
            v-for="t in tablesOf(db)" :key="t.id"
            :to="{ name: 'dd-table', params: { name: t.targetTable } }"
            custom v-slot="{ isActive, navigate }"
          >
            <button
              class="ddnav__item ddnav__item--nested"
              :class="{ 'ddnav__item--active': isActive }" @click="navigate"
            >
              <span class="material-symbols-outlined">table_rows</span>
              <span class="ddnav__text ddnav__text--mono">{{ t.targetTable }}</span>
              <span v-if="counts[t.id] != null" class="ddnav__count">{{ counts[t.id] }}</span>
            </button>
          </RouterLink>
        </div>
      </template>

      <template v-if="visibleTools.length">
        <p class="ddnav__label">Tools</p>
        <RouterLink
          v-for="item in visibleTools" :key="item.name"
          :to="{ name: item.name }" custom v-slot="{ isActive, navigate }"
        >
          <button class="ddnav__item" :class="{ 'ddnav__item--active': isActive }" @click="navigate">
            <span class="material-symbols-outlined">{{ item.icon }}</span>
            <span class="ddnav__text">{{ item.label }}</span>
          </button>
        </RouterLink>
      </template>
    </div>

    <footer class="ddnav__foot">
      <span v-if="role" class="ddnav__role">{{ role }}</span>
      <span v-if="isReadOnly" class="ddnav__ro">read only</span>
    </footer>
  </nav>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import { useAuth } from '@/composables/useAuth.js'
import { useDdAccess } from '../composables/useDdAccess.js'
import { useDdTableCounts } from '../composables/useDdTableCounts.js'
import { DD_TABLES } from '../lib/schema.js'

const { profile } = useAuth()
const { canMenu, canDashboard, visibleDatabases, isReadOnly } = useDdAccess()
const { counts, load } = useDdTableCounts()

const role = computed(() => profile.value?.role || '')
const reloading = ref(false)

// Group order matches the DD app's sidebar.
const manageNav = [
  { name: 'dd-business-units', label: 'Business Units', icon: 'account_balance', menu: 'bu-accounts' },
  { name: 'dd-merchants',      label: 'Merchants',      icon: 'storefront',      menu: 'merchants' },
  { name: 'dd-promos',         label: 'Promos',         icon: 'sell',            menu: 'promos' },
]

const toolsNav = [
  { name: 'dd-export', label: 'Export',     icon: 'ios_share', menu: 'export' },
  { name: 'dd-audit',  label: 'Audit Log',  icon: 'history',   menu: 'audit' },
  { name: 'dd-sql',    label: 'SQL Editor', icon: 'terminal',  menu: 'sql' },
]

const visibleManage = computed(() => manageNav.filter(i => canMenu(i.menu)))
const visibleTools = computed(() => toolsNav.filter(i => canMenu(i.menu)))

// Tables shown under a database use their downstream name — the sidebar is a
// view of the target schema, which is what the reader is reasoning about.
function tablesOf(db) {
  return Object.values(DD_TABLES).filter(t => t.targetDb === db)
}

const grantedTableIds = computed(() =>
  visibleDatabases.value.flatMap(db => tablesOf(db).map(t => t.id)),
)

async function reload() {
  reloading.value = true
  try {
    await load(grantedTableIds.value)
  } finally {
    setTimeout(() => { reloading.value = false }, 600)
  }
}

onMounted(() => {
  if (grantedTableIds.value.length) load(grantedTableIds.value)
})
</script>

<style scoped>
.ddnav {
  display: flex; flex-direction: column;
  width: 240px; flex-shrink: 0;
  background: rgba(255, 255, 255, 0.55);
  backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(0, 0, 0, 0.06);
  border-radius: var(--radius-md, 16px);
  padding: 14px 10px 10px;
  align-self: flex-start;
  max-height: calc(100vh - 96px);
}

.ddnav__brand { display: flex; align-items: center; gap: 10px; padding: 0 6px 12px; }
.ddnav__mark {
  width: 34px; height: 34px; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  background: linear-gradient(135deg, #6366F1, #8B5CF6);
  border-radius: var(--radius-sm, 10px);
}
.ddnav__mark .material-symbols-outlined { font-size: 19px; color: #fff; }
.ddnav__id { display: flex; flex-direction: column; min-width: 0; }
.ddnav__name { font-size: 14px; font-weight: 800; letter-spacing: -0.2px; }
.ddnav__sub { font-size: 11px; color: var(--color-gray-400, #aaa); }

.ddnav__scroll { overflow-y: auto; flex: 1; min-height: 0; }

.ddnav__label {
  font-size: 10px; font-weight: 700; letter-spacing: 0.7px; text-transform: uppercase;
  color: var(--color-gray-400, #aaa); margin: 14px 0 5px; padding: 0 6px;
}
.ddnav__labelrow { display: flex; align-items: center; justify-content: space-between; }
.ddnav__labelrow .ddnav__label { margin-bottom: 5px; }
.ddnav__icobtn {
  border: none; background: transparent; cursor: pointer; padding: 2px 6px;
  color: var(--color-gray-400, #aaa); display: flex; align-items: center;
}
.ddnav__icobtn .material-symbols-outlined { font-size: 16px; }
.ddnav__icobtn:hover { color: var(--color-gray-700, #555); }
.ddnav__icobtn--spin .material-symbols-outlined { animation: ddspin 600ms linear infinite; }
@keyframes ddspin { to { transform: rotate(360deg); } }

.ddnav__item {
  width: 100%; display: flex; align-items: center; gap: 9px;
  padding: 8px 8px; border: none; background: transparent;
  border-radius: var(--radius-sm, 10px); cursor: pointer;
  font-family: var(--font-body, 'Inter', sans-serif); text-align: left;
  color: var(--color-gray-700, #555); transition: background 160ms, color 160ms;
}
.ddnav__item .material-symbols-outlined { font-size: 18px; flex-shrink: 0; }
.ddnav__item:hover { background: rgba(0, 0, 0, 0.04); }
.ddnav__item--active { background: #fff; color: var(--color-on-surface, #1a1a2e); font-weight: 600; }
.ddnav__item--active .material-symbols-outlined { color: #6366F1; }
.ddnav__item--nested { padding-left: 16px; }

.ddnav__text {
  font-size: 13px; flex: 1; min-width: 0;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.ddnav__text--mono { font-family: var(--font-mono, ui-monospace, monospace); font-size: 12px; }
.ddnav__count {
  font-size: 10px; font-variant-numeric: tabular-nums;
  background: rgba(0, 0, 0, 0.06); color: var(--color-gray-700, #555);
  border-radius: 999px; padding: 1px 6px; flex-shrink: 0;
}

.ddnav__dbgroup { margin-bottom: 6px; }
.ddnav__dbname {
  display: flex; align-items: center; gap: 6px; margin: 4px 0 2px; padding: 0 6px;
  font-family: var(--font-mono, ui-monospace, monospace);
  font-size: 11px; color: var(--color-gray-500, #8e8ea0);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.ddnav__dbname .material-symbols-outlined { font-size: 14px; }

.ddnav__foot {
  display: flex; align-items: center; gap: 6px;
  padding: 10px 6px 0; margin-top: 6px;
  border-top: 1px solid rgba(0, 0, 0, 0.06);
}
.ddnav__role, .ddnav__ro {
  font-size: 10px; letter-spacing: 0.3px; border-radius: 999px; padding: 2px 8px;
}
.ddnav__role { background: rgba(99, 102, 241, 0.1); color: #6366F1; font-weight: 600; }
.ddnav__ro { background: rgba(0, 0, 0, 0.05); color: var(--color-gray-500, #8e8ea0); }

@media (max-width: 900px) {
  .ddnav { width: 100%; max-height: none; align-self: stretch; }
  .ddnav__scroll { max-height: 320px; }
}
</style>
```

- [ ] **Step 7: Write the layout**

Create `src/modules/dd/views/DdLayout.vue`:

```vue
<template>
  <div class="ddlayout">
    <DdSidebar />
    <main class="ddlayout__main">
      <RouterView v-slot="{ Component }">
        <Transition name="dd-fade" mode="out-in">
          <component :is="Component" />
        </Transition>
      </RouterView>
    </main>
  </div>
</template>

<script setup>
import { RouterView } from 'vue-router'
import DdSidebar from '../components/DdSidebar.vue'
</script>

<style scoped>
.ddlayout {
  max-width: 1440px; margin: 0 auto;
  padding: var(--space-lg, 24px) var(--space-xl, 32px);
  display: flex; align-items: flex-start; gap: var(--space-lg, 24px);
}
.ddlayout__main { flex: 1; min-width: 0; }

.dd-fade-enter-active { transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1); }
.dd-fade-leave-active { transition: all 0.15s ease-in; }
.dd-fade-enter-from { opacity: 0; transform: translateY(8px); }
.dd-fade-leave-to { opacity: 0; }

@media (max-width: 900px) {
  .ddlayout { flex-direction: column; padding: var(--space-md, 16px); gap: var(--space-md, 16px); }
  .ddlayout__main { width: 100%; }
}
@media (prefers-reduced-motion: reduce) {
  .dd-fade-enter-active, .dd-fade-leave-active { transition-duration: 0.01ms; }
}
</style>
```

- [ ] **Step 8: Write the minimal dashboard**

`/dd` is the index route, so it must render something real rather than a placeholder. The rich version is Phase 3.

Create `src/modules/dd/views/DdDashboard.vue`:

```vue
<template>
  <section class="dddash">
    <header class="dddash__head">
      <h1 class="dddash__title">Dashboard</h1>
      <p class="dddash__sub">Discount data across {{ dbCount }} database(s).</p>
    </header>

    <div class="dddash__grid">
      <article v-for="t in tables" :key="t.id" class="dddash__card">
        <p class="dddash__card-label">{{ t.label }}</p>
        <p class="dddash__card-value">
          <template v-if="counts[t.id] != null">{{ counts[t.id] }}</template>
          <span v-else class="dddash__dash">—</span>
        </p>
        <p class="dddash__card-meta">{{ t.targetDb }}.{{ t.targetTable }}</p>
      </article>
    </div>

    <p class="dddash__note">
      Reminders, expiring promos, rows needing attention and per-BU coverage
      arrive in Phase 3.
    </p>
  </section>
</template>

<script setup>
import { computed, onMounted } from 'vue'
import { useDdAccess } from '../composables/useDdAccess.js'
import { useDdTableCounts } from '../composables/useDdTableCounts.js'
import { DD_TABLES } from '../lib/schema.js'

const { canTable, visibleDatabases } = useDdAccess()
const { counts, load } = useDdTableCounts()

// Only count what this person may read, on either axis.
const tables = computed(() =>
  Object.values(DD_TABLES).filter(t => canTable(t.id)),
)
const dbCount = computed(() =>
  new Set(tables.value.map(t => t.targetDb)).size || visibleDatabases.value.length,
)

onMounted(() => {
  if (tables.value.length) load(tables.value.map(t => t.id))
})
</script>

<style scoped>
.dddash { display: flex; flex-direction: column; gap: var(--space-lg, 24px); }
.dddash__title { font-size: 24px; font-weight: 800; margin: 0; letter-spacing: -0.4px; }
.dddash__sub { font-size: 14px; color: var(--color-gray-500, #8e8ea0); margin: 2px 0 0; }
.dddash__grid {
  display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: var(--space-md, 16px);
}
.dddash__card {
  background: rgba(255, 255, 255, 0.6);
  border: 1px solid rgba(0, 0, 0, 0.06);
  border-radius: var(--radius-md, 16px);
  padding: 18px 20px;
}
.dddash__card-label { font-size: 12px; font-weight: 600; color: var(--color-gray-500, #8e8ea0); margin: 0; }
.dddash__card-value {
  font-size: 30px; font-weight: 800; margin: 6px 0 0;
  font-variant-numeric: tabular-nums; letter-spacing: -1px;
}
.dddash__dash { color: var(--color-gray-400, #aaa); font-weight: 400; }
.dddash__card-meta {
  font-family: var(--font-mono, ui-monospace, monospace);
  font-size: 11px; color: var(--color-gray-400, #aaa); margin: 4px 0 0;
}
.dddash__note { font-size: 13px; color: var(--color-gray-400, #aaa); margin: 0; }
</style>
```

- [ ] **Step 9: Create a temporary DdAudit placeholder and delete DdView**

`src/router/index.js` now references `DdAudit.vue`, which Task 7 builds. Create it as a placeholder so this task's build passes:

`src/modules/dd/views/DdAudit.vue`:

```vue
<template>
  <DdPlaceholder title="Audit Log" phase="the next task" icon="history" />
</template>

<script setup>
import DdPlaceholder from '../components/DdPlaceholder.vue'
</script>
```

Then delete the obsolete shell:

```bash
git rm src/modules/dd/views/DdView.vue
```

- [ ] **Step 10: Build**

```bash
npm run build
```

Expected: succeeds. If it fails on a missing import, a route child's component path is wrong — fix the path, do not stub out the route.

- [ ] **Step 11: Verify in the browser**

Load the browser tools: `ToolSearch` with query `select:mcp__Claude_Browser__preview_start,mcp__Claude_Browser__navigate,mcp__Claude_Browser__read_page,mcp__Claude_Browser__computer,mcp__Claude_Browser__read_console_messages,mcp__Claude_Browser__resize_window`

`preview_start` with `{ name: "sp-lite-dev" }` (never start a dev server with Bash), then `navigate` to `http://localhost:5173/#/dd`. A signed-in Admin session already exists; if you land on the login screen, report it and stop rather than attempting to sign in.

Confirm with `read_page`:

1. The sidebar renders five group headings in order: **Overview**, **Manage**, **Databases**, **Tools** — and no **Admin** heading, because Email Settings is Phase 6 and has no route yet.
2. **Manage** lists Business Units, Merchants, Promos.
3. **Databases** lists `ihybrid_order` with `discount_bu_accounts` under it, and `ihybrid_discount` with `merchant_whitelist` and `promo_info` under it. The downstream names, not `qrdd_*`.
4. Row-count badges show **24** on `discount_bu_accounts`, **1** on `merchant_whitelist`, **0** on `promo_info`.
5. **Tools** lists Export, Audit Log, SQL Editor.
6. The main pane shows the Dashboard with three cards and correct counts.
7. The footer shows the role chip (`Admin`) and no `read only` chip.
8. `read_console_messages` with `{ onlyErrors: true }` returns nothing.

- [ ] **Step 12: Verify navigation**

Click Merchants, then `read_page`: the main pane shows the Phase 2 placeholder, the URL is `#/dd/merchants`, and the Merchants sidebar item is the active one.

Click `promo_info` under Databases: URL is `#/dd/table/promo_info` and the placeholder titles itself `promo_info` (proving `byTargetTable` resolved the param).

Navigate directly to `http://localhost:5173/#/dd/audit` — the temporary Audit Log placeholder renders, confirming the guard permits a granted menu.

- [ ] **Step 13: Verify the responsive layout**

`resize_window` with `{ preset: "mobile" }`, then reload and `read_page`.

Expected: the sidebar stacks above the main pane at full width rather than sitting beside it.

Restore with `resize_window` `{ preset: "desktop" }`.

- [ ] **Step 14: Screenshot and commit**

`computer` with `{ action: "screenshot" }` — confirm the sidebar groups and the dashboard cards are both visible.

```bash
git add src/router/index.js src/modules/dd/
git commit -m "feat(dd): nested routes behind DD's grouped sidebar"
```

---

### Task 7: Audit Log screen — list and paging

**Files:**
- Create: `src/modules/dd/composables/useAuditLog.js`
- Modify: `src/modules/dd/views/DdAudit.vue` (replace the placeholder)

**Interfaces:**
- Consumes: `supabase` from `@/lib/supabase.js`; `tableLabel` from `../lib/schema.js`; table `public.dd_audit_log`.
- Produces: `useAuditLog()` returning `{ rows, loading, error, total, currentPage, pageSize, totalPages, load }` — `pageSize` is the constant 25. Tasks 8 and 9 extend the same object.

Because each screen is its own route, `DdAudit.vue` owns the composable directly. There is no prop-drilling from the layout.

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

- [ ] **Step 2: Write the screen**

Replace `src/modules/dd/views/DdAudit.vue` entirely:

```vue
<template>
  <section class="ddaudit">
    <header class="ddaudit__head">
      <div>
        <h1 class="ddaudit__title">Audit Log</h1>
        <p class="ddaudit__sub">Who changed what, and when.</p>
      </div>
      <p class="ddaudit__count">{{ total }} {{ total === 1 ? 'entry' : 'entries' }}</p>
    </header>

    <p v-if="error" class="ddaudit__error">{{ error }}</p>

    <LiTable :data="rows" :columns="columns" row-key="audit_id" :loading="loading">
      <template #cell-ts="{ value }">{{ formatTs(value) }}</template>
      <template #cell-table_id="{ value }">{{ tableLabel(value) }}</template>
      <template #cell-column_name="{ value }">{{ value || '—' }}</template>
      <template #cell-detail="{ value }">{{ value || '—' }}</template>
    </LiTable>

    <div v-if="totalPages > 1" class="ddaudit__pagination">
      <LiPagination v-model="currentPage" :total-pages="totalPages" />
    </div>
  </section>
</template>

<script setup>
import { onMounted } from 'vue'
import LiTable from '@lib/components/LiTable.vue'
import LiPagination from '@lib/components/LiPagination.vue'
import { tableLabel } from '../lib/schema.js'
import { useAuditLog } from '../composables/useAuditLog.js'

const { rows, loading, error, total, currentPage, totalPages, load } = useAuditLog()

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

onMounted(load)
</script>

<style scoped>
.ddaudit { display: flex; flex-direction: column; gap: var(--space-md, 16px); }
.ddaudit__head { display: flex; align-items: flex-end; justify-content: space-between; gap: 12px; }
.ddaudit__title { font-size: 24px; font-weight: 800; margin: 0; letter-spacing: -0.4px; }
.ddaudit__sub { font-size: 14px; color: var(--color-gray-500, #8e8ea0); margin: 2px 0 0; }
.ddaudit__count { font-size: 13px; color: var(--color-gray-500, #8e8ea0); margin: 0; white-space: nowrap; }
.ddaudit__error {
  font-size: 13px; color: var(--color-red-400, #C83E3B);
  background: rgba(200, 62, 59, 0.08);
  border-radius: var(--radius-sm, 12px); padding: 10px 14px; margin: 0;
}
.ddaudit__pagination { display: flex; justify-content: center; }
</style>
```

`LiPagination` supports `v-model` (`modelValue` + `update:modelValue`), so the page ref binds directly and the composable's `watch(currentPage)` triggers the reload.

- [ ] **Step 3: Generate a row to look at**

The log is empty. In the running app, go to `/qrdd` → BU Accounts, edit any account's expense account name, and save.

- [ ] **Step 4: Verify in the browser**

Navigate to `http://localhost:5173/#/dd/audit` and confirm with `read_page`:

1. The table renders, not the placeholder.
2. There is an `UPDATE` row for the field you changed, `Table` reads **BU Accounts** (the label, not `bu_accounts`), with the old and new values.
3. `Who` is **your display name**, not `SYSTEM` — this proves `dd_actor()` resolves a live session, unlike the SQL-editor path.
4. The entry count in the header matches the visible rows.
5. `read_console_messages` `{ onlyErrors: true }` returns nothing.

- [ ] **Step 5: Verify paging**

In the Supabase SQL editor:

```sql
insert into public.dd_audit_log (actor, action, target_db, table_id, record_key, detail)
select 'ZZ_PAGING', 'INSERT', 'ihybrid_discount', 'merchants', 'ZZ_PAGE_' || g, 'paging fixture'
from generate_series(1, 30) g;
```

Reload `/dd/audit`. Confirm: 25 rows on page 1, pagination visible, page 2 shows the remainder, newest first.

Clean up:

```sql
delete from public.dd_audit_log where actor = 'ZZ_PAGING';
select count(*) as leftover from public.dd_audit_log where actor = 'ZZ_PAGING';
```

Expected: `leftover = 0`.

- [ ] **Step 6: Build and commit**

```bash
npm run build
```

```bash
git add src/modules/dd/composables/useAuditLog.js src/modules/dd/views/DdAudit.vue
git commit -m "feat(dd): audit log screen with server-side paging"
```

---

### Task 8: Audit Log — filters, debounced search, race guard

**Files:**
- Modify: `src/modules/dd/composables/useAuditLog.js`
- Modify: `src/modules/dd/views/DdAudit.vue`

**Interfaces:**
- Consumes: Task 7's `useAuditLog()`; RPC `public.dd_audit_actors()`; `TABLE_IDS`/`tableLabel` from `../lib/schema.js`.
- Produces: `useAuditLog()` additionally returns `{ filterTable, filterAction, filterActor, search, actors, loadActors, resetFilters }` — the first four `Ref<string>` where `''` means no filter, `actors: Ref<string[]>`, `loadActors: () => Promise<void>`, `resetFilters: () => void`.

- [ ] **Step 1: Rewrite the composable**

Replace `src/modules/dd/composables/useAuditLog.js` entirely:

```js
import { ref, computed, watch } from 'vue'
import { supabase } from '@/lib/supabase.js'

const SEARCH_DEBOUNCE_MS = 250

// Columns the free-text box searches. Enum and numeric columns are excluded —
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

  // A filter change invalidates the current page number.
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

`resetFilters()` sets four refs at once, firing the watchers. The redundant loads are harmless — the race guard means only the last response is applied.

- [ ] **Step 2: Add the filter bar to the screen**

In `src/modules/dd/views/DdAudit.vue`, insert immediately after the `</header>` line:

```vue
    <div class="ddaudit__filters">
      <LiSelect v-model="filterTable" :options="tableOptions" placeholder="All tables" />
      <LiSelect v-model="filterAction" :options="actionOptions" placeholder="All actions" />
      <LiSelect v-model="filterActor" :options="actorOptions" placeholder="All people" />
      <LiTextField v-model="search" placeholder="Search record, column or value…" />
      <button class="ddaudit__reset" type="button" @click="resetFilters">Reset</button>
    </div>
```

Update the `<script setup>` imports and destructuring:

```js
import { computed, onMounted } from 'vue'
import LiTable from '@lib/components/LiTable.vue'
import LiPagination from '@lib/components/LiPagination.vue'
import LiSelect from '@lib/components/LiSelect.vue'
import LiTextField from '@lib/components/LiTextField.vue'
import { TABLE_IDS, tableLabel } from '../lib/schema.js'
import { useAuditLog } from '../composables/useAuditLog.js'

const {
  rows, loading, error, total, currentPage, totalPages,
  filterTable, filterAction, filterActor, search, actors,
  load, loadActors, resetFilters,
} = useAuditLog()
```

Add the option lists after `columns`:

```js
// '' is the "no filter" sentinel the composable expects.
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
  ...actors.value.map(a => ({ label: a, value: a })),
])
```

Replace `onMounted(load)` with:

```js
onMounted(() => { load(); loadActors() })
```

Add to `<style scoped>`:

```css
.ddaudit__filters {
  display: grid; grid-template-columns: 1fr 1fr 1fr 2fr auto;
  gap: var(--space-sm, 12px); align-items: end;
}
.ddaudit__reset {
  padding: 10px 18px; border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: var(--radius-pill, 999px); background: transparent;
  font-family: var(--font-body, 'Inter', sans-serif);
  font-size: 13px; font-weight: 600; color: var(--color-gray-700, #666);
  cursor: pointer; transition: all 200ms;
}
.ddaudit__reset:hover { background: rgba(0, 0, 0, 0.04); }

@media (max-width: 1100px) {
  .ddaudit__filters { grid-template-columns: 1fr 1fr; }
}
</style>
```

- [ ] **Step 3: Seed varied fixture rows**

```sql
insert into public.dd_audit_log (actor, action, target_db, table_id, record_key, column_name, old_value, new_value)
values
  ('ZZ_FILTER_A', 'INSERT', 'ihybrid_order',    'bu_accounts', 'ZZ_BU|PRIME',  null,        null,      null),
  ('ZZ_FILTER_A', 'UPDATE', 'ihybrid_order',    'bu_accounts', 'ZZ_BU|PRIME',  'acctname1', 'alpha',   'bravo'),
  ('ZZ_FILTER_B', 'UPDATE', 'ihybrid_discount', 'merchants',   'ZZ_MERCH_001', 'status',    'ACTIVE',  'INACTIVE'),
  ('ZZ_FILTER_B', 'DELETE', 'ihybrid_discount', 'promos',      'ZZ_PROMO_01',  null,        null,      null);
```

- [ ] **Step 4: Verify each filter**

Reload `/dd/audit` and check with `read_page` after each:

1. **Table** → "Merchants": only the `ZZ_MERCH_001` row.
2. **Action** → "Update": only UPDATE rows; the INSERT and DELETE fixtures gone.
3. **Actor** dropdown lists `ZZ_FILTER_A` and `ZZ_FILTER_B` (proving `dd_audit_actors()` works). Selecting `ZZ_FILTER_B` leaves that person's two rows.
4. **Combined**: actor `ZZ_FILTER_A` **and** action `UPDATE` → exactly one row (`acctname1`, alpha → bravo). Filters AND, not OR.
5. **Search** `bravo` → only the `acctname1` row. `ZZ_PROMO` → only the promos DELETE row.
6. **Reset** clears all four controls and restores the full count.
7. With a filter active and >25 matches, page 2 stays filtered.

- [ ] **Step 5: Verify the race guard**

Type `abcdefgh` into search one character at a time quickly, then clear it.

Expected: the table settles on the unfiltered result, never on a prefix's result. `read_network_requests` with `urlPattern: "dd_audit_log"` should show far fewer requests than keystrokes.

- [ ] **Step 6: Verify a comma in search does not break the query**

Type `alpha, bravo`.

Expected: a result or an empty state — **not** the error banner, and no console error. A raw comma reaching PostgREST's `or` parser produces a 400.

- [ ] **Step 7: Clean up, build, commit**

```sql
delete from public.dd_audit_log where actor in ('ZZ_FILTER_A', 'ZZ_FILTER_B');
select count(*) as leftover from public.dd_audit_log where actor like 'ZZ\_%';
```

Expected: `leftover = 0`.

```bash
npm run build
```

```bash
git add src/modules/dd/composables/useAuditLog.js src/modules/dd/views/DdAudit.vue
git commit -m "feat(dd): audit log filters with debounced search and race guard"
```

---

### Task 9: Audit Log — cell formatting and CSV export

**Files:**
- Create: `src/modules/dd/lib/csv.js`
- Modify: `src/modules/dd/composables/useAuditLog.js`
- Modify: `src/modules/dd/views/DdAudit.vue`

**Interfaces:**
- Consumes: Task 8's `useAuditLog()`.
- Produces: `csv.js` exports `downloadCsv(rows, columns, filename)` where `columns: Array<{ key, label, format? }>`; `useAuditLog()` additionally returns `exportCsv: () => void`.

- [ ] **Step 1: Write the CSV helper**

Create `src/modules/dd/lib/csv.js`:

```js
// Minimal CSV writer for the DD module. XLSX export lives in
// @/lib/export-xlsx.js and is for data tables; the audit log is a text log, so
// CSV is the right shape and needs no dependency.

function escapeCell(v) {
  if (v == null) return ''
  const s = String(v)
  // Quote when the value contains a delimiter, a quote or a newline; double any
  // embedded quote. That is the whole of RFC 4180 that matters here.
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

Create `/tmp/dd-csv-check.mjs`:

```js
import { downloadCsv } from '../Users/22002420/Desktop/Allo/VIBE/SP-lite/src/modules/dd/lib/csv.js'
// downloadCsv touches Blob/document, so only escaping is exercised here, via a
// captured Blob shim.
let captured = ''
globalThis.Blob = class { constructor(parts) { captured = parts.join('') } }
globalThis.URL = { createObjectURL: () => 'blob:x', revokeObjectURL() {} }
globalThis.document = {
  createElement: () => ({ click() {}, set href(_) {}, set download(_) {} }),
  body: { appendChild() {}, removeChild() {} },
}

downloadCsv(
  [
    { a: 'plain', b: null },
    { a: 'has,comma', b: 'say "hi"' },
    { a: 'line1\nline2', b: '42 row(s) rewritten' },
  ],
  [{ key: 'a', label: 'A' }, { key: 'b', label: 'B' }],
  'x',
)

const a = (c, l) => { if (!c) throw new Error('FAIL: ' + l + '\n--- got ---\n' + captured); console.log('ok  ' + l) }
a(captured.startsWith('﻿'), 'BOM present')
a(captured.includes('A,B'), 'header')
a(captured.includes('plain,'), 'plain unquoted')
a(captured.includes('"has,comma"'), 'comma quoted')
a(captured.includes('"say ""hi"""'), 'quote doubled')
a(captured.includes('"line1\nline2"'), 'newline quoted')
a(captured.includes('"42 row(s) rewritten"') === false, 'parens alone need no quoting')
a(captured.split('\r\n').length === 4, 'CRLF row separator, 4 lines')
console.log('ALL PASS')
```

Run:

```bash
node /tmp/dd-csv-check.mjs
```

Expected: eight `ok` lines then `ALL PASS`. Adjust the import path if your working directory differs — use an absolute `file://` URL if the relative one fails.

- [ ] **Step 3: Add `exportCsv` to the composable**

In `src/modules/dd/composables/useAuditLog.js`, add imports:

```js
import { downloadCsv } from '../lib/csv.js'
import { tableLabel } from '../lib/schema.js'
```

Add before the `return`:

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

In `src/modules/dd/views/DdAudit.vue`, replace the `<p class="ddaudit__count">` line with:

```vue
      <div class="ddaudit__actions">
        <p class="ddaudit__count">{{ total }} {{ total === 1 ? 'entry' : 'entries' }}</p>
        <button class="ddaudit__export" type="button" :disabled="!rows.length" @click="exportCsv">
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
        <code v-if="value" class="ddaudit__col">{{ value }}</code>
        <span v-else class="ddaudit__muted">—</span>
      </template>
      <template #cell-change="{ row }">
        <span v-if="!row.column_name" class="ddaudit__muted">—</span>
        <span v-else class="ddaudit__change">
          <span class="ddaudit__old">
            <template v-if="row.old_value !== null">{{ row.old_value }}</template>
            <i v-else class="ddaudit__null">NULL</i>
          </span>
          <span class="ddaudit__arrow">→</span>
          <span class="ddaudit__new">
            <template v-if="row.new_value !== null">{{ row.new_value }}</template>
            <i v-else class="ddaudit__null">NULL</i>
          </span>
        </span>
      </template>
      <template #cell-detail="{ value }">
        <template v-if="value">{{ value }}</template>
        <span v-else class="ddaudit__muted">—</span>
      </template>
    </LiTable>
```

Replace the `columns` array — `old_value` and `new_value` merge into one `change` column:

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

Add `LiBadge` to the imports, `exportCsv` to the destructuring from `useAuditLog()`, and this function after `formatTs`:

```js
function actionVariant(action) {
  if (action === 'INSERT') return 'success'
  if (action === 'UPDATE') return 'warning'
  if (action === 'DELETE') return 'error'
  return 'neutral'
}
```

Add to `<style scoped>`:

```css
.ddaudit__actions { display: flex; align-items: center; gap: 12px; }
.ddaudit__export {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 8px 16px; border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: var(--radius-pill, 999px); background: transparent;
  font-family: var(--font-body, 'Inter', sans-serif);
  font-size: 13px; font-weight: 600; color: var(--color-gray-700, #666);
  cursor: pointer; transition: all 200ms; white-space: nowrap;
}
.ddaudit__export:hover:not(:disabled) { background: rgba(0, 0, 0, 0.04); }
.ddaudit__export:disabled { opacity: 0.45; cursor: not-allowed; }
.ddaudit__export .material-symbols-outlined { font-size: 17px; }

.ddaudit__col {
  font-family: var(--font-mono, ui-monospace, monospace); font-size: 12px;
  background: rgba(0, 0, 0, 0.04); border-radius: 5px; padding: 1px 6px;
}
.ddaudit__muted { color: var(--color-gray-400, #aaa); }
.ddaudit__change { display: inline-flex; align-items: center; gap: 6px; flex-wrap: wrap; font-size: 13px; }
/* Struck through so a removed value reads as removed at a glance. */
.ddaudit__old { text-decoration: line-through; color: var(--color-gray-500, #8e8ea0); }
.ddaudit__new { font-weight: 600; }
.ddaudit__arrow { color: var(--color-gray-400, #aaa); }
/* A NULL must not look like an empty string — the difference matters here. */
.ddaudit__null {
  font-style: normal; font-size: 11px; letter-spacing: 0.4px;
  color: var(--color-gray-400, #aaa);
}
```

- [ ] **Step 5: Verify formatting in the browser**

```sql
insert into public.dd_audit_log (actor, action, target_db, table_id, record_key, column_name, old_value, new_value, detail)
values
  ('ZZ_FMT', 'INSERT',  'ihybrid_order',    'bu_accounts', 'ZZ_FMT|PRIME', null,         null,      null,  null),
  ('ZZ_FMT', 'UPDATE',  'ihybrid_order',    'bu_accounts', 'ZZ_FMT|PRIME', 'acctname1',  'before',  'after', null),
  ('ZZ_FMT', 'UPDATE',  'ihybrid_order',    'bu_accounts', 'ZZ_FMT|PRIME', 'created_by', 'someone', null,  null),
  ('ZZ_FMT', 'DELETE',  'ihybrid_discount', 'merchants',   'ZZ_FMT_M_001', null,         null,      null,  null),
  ('ZZ_FMT', 'REPLACE', 'ihybrid_discount', 'promos',      null,           null,         null,      null,  '42 row(s) rewritten');
```

Reload `/dd/audit`, filter actor to `ZZ_FMT`, confirm:

1. Action badges colour-coded: INSERT green, UPDATE amber, DELETE red, REPLACE grey.
2. The `acctname1` row reads `before → after`, `before` struck through.
3. The `created_by` row reads `someone → NULL`, with `NULL` muted and small — **visibly different from an empty cell**.
4. INSERT and DELETE rows show `—` in both Column and Old → New.
5. The REPLACE row shows its detail and `—` elsewhere.
6. Timestamps read like `13 Aug 2026, 14:32`.

- [ ] **Step 6: Verify the CSV export**

Click **Export page**, open `dd-audit-log-page-1.csv`.

Confirm: header `When,Who,Action,Database,Table,Record,Column,Old Value,New Value,Detail`; one row per visible table row and no more (it exports the page, not the log); Table reads `BU Accounts` not `bu_accounts`; and the REPLACE row's `42 row(s) rewritten` sits in one cell — the comma inside must not split the row.

- [ ] **Step 7: Verify the disabled state**

Search `zzzznomatch`. Expected: empty state and **Export page** disabled.

- [ ] **Step 8: Clean up, build, commit**

```sql
delete from public.dd_audit_log where actor = 'ZZ_FMT';
select count(*) as leftover from public.dd_audit_log where actor like 'ZZ\_%';
```

Expected: `leftover = 0`.

```bash
npm run build
```

```bash
git add src/modules/dd/lib/csv.js src/modules/dd/composables/useAuditLog.js src/modules/dd/views/DdAudit.vue
git commit -m "feat(dd): audit log cell formatting and CSV export"
```

---

### Task 10: Two-axis gating proof, end-to-end verification and docs

The acceptance gate. This is where the two-axis access model is proven against the real app rather than a logic stub.

**Files:**
- Modify: `CLAUDE.md`

**Interfaces:**
- Consumes: everything from Tasks 1-9.
- Produces: nothing new.

- [ ] **Step 1: Prove the audit log is append-only from the browser**

With the app open and signed in, via `mcp__Claude_Browser__javascript_tool`:

```js
const { supabase } = await import('/src/lib/supabase.js');
const one = await supabase.from('dd_audit_log').select('audit_id,actor').limit(1).single();
const del = await supabase.from('dd_audit_log').delete().eq('audit_id', one.data.audit_id);
const upd = await supabase.from('dd_audit_log').update({ actor: 'HACKED' }).eq('audit_id', one.data.audit_id);
const ins = await supabase.from('dd_audit_log').insert({ action: 'INSERT', target_db: 'x', table_id: 'y' });
const still = await supabase.from('dd_audit_log').select('actor').eq('audit_id', one.data.audit_id).single();
JSON.stringify({ del: del.error?.code, upd: upd.error?.code, ins: ins.error?.code, actor: still.data.actor, wasActor: one.data.actor });
```

Expected: all three of `del`, `upd`, `ins` carry an error code, and `actor === wasActor` — **not** `HACKED`.

If any of the three succeeds, **stop**. The append-only guarantee is broken and Task 2's RLS must be fixed before Phase 1 can be called done.

- [ ] **Step 2: Prove TRUNCATE is still denied**

Run in the Supabase SQL editor:

```sql
select t.tablename,
       has_table_privilege('authenticated','public.'||t.tablename,'TRUNCATE') as auth_truncate,
       has_table_privilege('anon',         'public.'||t.tablename,'TRUNCATE') as anon_truncate
from (values ('dd_audit_log'),('qrdd_bu_accounts'),('qrdd_merchant_whitelist'),('qrdd_promo_rules')) as t(tablename);
```

Expected: all eight booleans false. TRUNCATE bypasses both RLS and row triggers, so this is the other half of the append-only guarantee.

- [ ] **Step 3: Prove the database axis — the faithfulness test**

Pick a non-Admin role you can safely modify (e.g. create a scratch role in `/admin` → Roles, or use "Digital Lending"). Record its current `dd` grants first so you can restore them:

```sql
select feature_id from public.feature_access where module_id='dd' and role='<ROLE>' order by 1;
```

Grant it the `dd` module plus **only** these, and nothing else:

```sql
insert into public.feature_access (role, module_id, feature_id)
values ('<ROLE>','dd','dashboard.read'), ('<ROLE>','dd','db.ihybrid_order.read')
on conflict do nothing;
```

Sign in as a user holding that role (or temporarily set your own profile's role — recording the original so you can restore it). On `/dd`, confirm with `read_page`:

1. The **Databases** group lists `ihybrid_order` with `discount_bu_accounts` under it.
2. It does **not** mention `ihybrid_discount`, `merchant_whitelist` or `promo_info` anywhere.
3. The **Manage** group heading does not render at all — no menu grants.
4. The **Tools** group heading does not render at all.
5. The footer shows a `read only` chip, because no create/update/delete scope is held on either axis.
6. Navigating directly to `http://localhost:5173/#/dd/table/merchant_whitelist` is refused and lands elsewhere.
7. Navigating directly to `http://localhost:5173/#/dd/audit` is refused — `audit.read` is not granted.
8. Navigating to `http://localhost:5173/#/dd/table/discount_bu_accounts` **is** permitted.

This is the property the whole revision exists for: one database granted, the other invisible, with the menu axis untouched.

- [ ] **Step 4: Prove the axes are independent in the other direction**

Remove the database grant and give a menu grant instead:

```sql
delete from public.feature_access where role='<ROLE>' and module_id='dd' and feature_id='db.ihybrid_order.read';
insert into public.feature_access (role, module_id, feature_id)
values ('<ROLE>','dd','merchants.read') on conflict do nothing;
```

Reload `/dd`. Expected: the **Databases** group and its heading are gone entirely; **Manage** appears listing only Merchants; Business Units and Promos are absent. The two axes do not leak into each other.

- [ ] **Step 5: Restore the role's grants**

Delete the grants you added and re-insert whatever Step 3's first query recorded. Then verify:

```sql
select role, count(*) from public.feature_access where module_id='dd' group by role order by role;
```

Expected: Admin 28, and every other role back to the count you recorded. If you changed your own profile's role, restore it and confirm you are Admin again.

- [ ] **Step 6: Prove the end-to-end audit path**

Signed in as Admin, in `/qrdd` → BU Accounts, edit an account's expense account name **and** its SOF value, and save. Open `/dd/audit`.

Expected: two `UPDATE` rows, one per changed column, both carrying your display name — not `SYSTEM`, and not the email stored in `updated_by`.

This is Phase 1's headline criterion: writes made through the still-live `qrdd` screens are audited without `qrdd` having been modified at all.

- [ ] **Step 7: Confirm no forbidden file was touched**

```bash
git diff --name-only main...HEAD -- src/modules/qrdd/ src/lib/access.js src/composables/useAccess.js src/App.vue
```

Expected: **empty output**. Anything listed violates a Global Constraint — revert it.

- [ ] **Step 8: Confirm schema.sql is idempotent end to end**

Run the whole of `supabase/schema.sql` a second time in the SQL editor, then:

```sql
select count(*) as admin_dd from public.feature_access where role='Admin' and module_id='dd';
```

Expected: the run succeeds and `admin_dd = 28`, not 56.

- [ ] **Step 9: Update CLAUDE.md**

In the **Modules** table, add after the `qrdd` row:

```markdown
| dd | `/dd` (nested) | Supabase: `dd_audit_log` (+ reads the `qrdd_*` tables) |
```

In the **Architecture** section, after the Module registry paragraph, add:

```markdown
**DD module shape:** `dd` is the only module with its own nested router and a
second-level sidebar (`src/modules/dd/views/DdLayout.vue` +
`components/DdSidebar.vue`), because it ports DD MPM — a twelve-screen app with
grouped navigation. Its index child keeps `name: 'dd'` so SP-lite's sidebar and
`firstAccessibleRoute()`, which resolve a module to `{ name: moduleId }`, keep
working unchanged.

**DD access has two axes.** Menu scopes (`merchants.update`) and database scopes
(`db.ihybrid_discount.update`) are granted independently, and a table is
reachable through either — DD's `canWriteSheet` rule. Both are stored as
`feature_access` rows under the single `dd` module; the OR lives in
`src/modules/dd/composables/useDdAccess.js`, never in `src/lib/access.js`, which
is a verbatim port of SO-Platform's and shared by every module.
```

In the **Supabase schema** section, append:

```markdown
`dd_audit_log` is **append-only**: `authenticated` holds `select` and nothing
else, TRUNCATE is explicitly revoked from `anon` and `authenticated` (it would
otherwise bypass both RLS and row triggers), and the only writer is the
`dd_audit_row()` trigger (security definer) on the three `qrdd_*` tables. It
records one row per record for INSERT/DELETE and one row per changed column for
UPDATE, skipping `updated_at`/`updated_by`. When a key column is itself renamed
the old key is stamped into `detail` so the history stays linkable. The actor
comes from `dd_actor()` (`auth.uid()` → `profiles.full_name`), not from the
client-supplied `created_by`/`updated_by` columns.
```

In the **Docs** section, append:

```markdown
The DD module is a phased port of the `VIBE/DD` Apps Script app. Phase 1 is
specced in `docs/superpowers/specs/2026-08-13-dd-module-phase1-design.md` — read
its "Revision" subsection, which records why the first pill-tab shell was
replaced by DD's real sidebar — and planned in
`docs/superpowers/plans/2026-08-13-dd-module-phase1-rev2.md`. That spec's header
lists all six phases. `qrdd` is retired after Phase 2; until then both modules
ship and `qrdd` is the working surface for BU accounts, merchants and promos.
```

- [ ] **Step 10: Final build and commit**

```bash
npm run build
```

```bash
git add CLAUDE.md
git commit -m "docs: record the dd module's nested shape and two-axis access"
```

---

## Out of scope for this plan

Named so a reviewer does not flag them as gaps. Each is scheduled, not dropped.

- BU / Merchant / Promo **screen content** — Phase 2. Their routes, sidebar entries and gates exist now; the screens are placeholders and `/qrdd` stays the working surface.
- Retiring the `qrdd` module and removing `schema.sql` §11 — one commit after Phase 2.
- Realtime subscriptions, stale-data banners, and the sidebar footer's stale dot — Phase 2. The publication is added in Task 2 but nothing subscribes.
- The Export item's pending-changes badge — Phase 4, which introduces the session changelog it counts. Rendering an always-zero badge would be worse than none.
- `isReadOnly` has exactly one consumer in Phase 1 (the sidebar's chip); Phase 2's managers are the ones that switch whole screens on it.
- The rich dashboard — Phase 3. `/dd` renders three count cards because it is the index route.
- SQL export, Export Center, `app_instances` cache-reset statements — Phase 4. `schema.js` declares `targetTable`, `timestamps`, `textColumns`, `EXPORT_ORDER` and the cache-reset constants for it. **Approved as intentional:** these are unread in Phase 1 by design, so the exporter and the UI cannot drift apart later. Not dead code to remove.
- Table Explorer and SQL Editor screen content, and any code writing `REPLACE` audit rows — Phase 5. The `REPLACE` action is already permitted by the CHECK constraint, so Phase 5 needs no migration.
- DD's Admin group (Email Settings) — Phase 6, blocked on confirming the Zimbra SMTP host is reachable from Supabase's Edge runtime. DD's other two admin screens are not ported: `user_access` and `role` are already SP-lite's RBAC tables under `/admin`.
- Renaming the three `qrdd_*` tables — explicitly rejected.
- TRUNCATE remains granted to `anon`/`authenticated` on `public.profiles` and `public.qris_history` — pre-existing, out of this plan's scope by explicit decision, logged in the ledger.
- Backfilling audit history for rows written before Task 2 — impossible; the old values were never recorded.
- Adding a JavaScript test framework — the repo has none and this plan does not introduce one.
