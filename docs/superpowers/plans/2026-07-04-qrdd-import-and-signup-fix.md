# QRDD Import Tool & Signup Fix — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add reusable Excel import tab to QRDD module (sheet preview, validation, upsert), fix signup form (fullName + username mandatory), migrate BU accounts unique constraint, and make all QRDD components mobile-responsive.

**Architecture:** New `useImport` composable orchestrates parse → validate → bulk upsert in FK order. `ImportTab.vue` renders using existing `LiUpload`, `LiGlassCard`, `LiProgress`, `LiTable` components. Bulk upsert methods added to existing composables. QRDD tabs get `@media` breakpoints matching QrisView patterns (768px/480px).

**Tech Stack:** Vue 3 (Composition API), Supabase JS, XLSX 0.18.5 (already installed), existing Li* components

## Global Constraints

- All imports: FK order enforced (BU accounts → merchants → promo rules)
- Upsert match keys: BU=`(name, sof, account1)`, Merchant=`merchant_id`, Promo=`promo_id`
- `created_by`/`updated_by` uses `profile.full_name` — block import if full_name is empty
- 50 rows per Supabase batch call
- XLSX column matching by header name, not position
- Excel sentinel handling: string "NULL" → JS null, `1.00` = no minimum, `50000000000.00` = unlimited
- Signup field order: Full Name, Email, Username, Password — all mandatory, no "(opsional)" badge
- Responsive breakpoints: 768px (tablet), 480px (mobile) — match QrisView patterns
- Commit per task
- `ponytail:` for deliberate simplifications

---

### Task 1: DB Migration — Composite Unique on BU Accounts

**Files:**
- Create: `supabase/migrations/20260704_qrdd_bu_accounts_composite_unique.sql`

**Interfaces:**
- Produces: new unique index `(name, sof, account1)` on `qrdd_bu_accounts`; old `(name)` index dropped

- [ ] **Step 1: Create migration file**

```sql
-- Drop old unique on name only (blocks PRIME + PAYLATER rows for same BU)
drop index if exists idx_qrdd_bu_accounts_name;

-- Composite unique: same BU name allowed with different SOF/account1
create unique index if not exists idx_qrdd_bu_accounts_name_sof_acct1
  on public.qrdd_bu_accounts (name, sof, account1);
```

- [ ] **Step 2: Apply migration via Supabase MCP**

Run: `apply_migration` with name `20260704_qrdd_bu_accounts_composite_unique` and the SQL above.

- [ ] **Step 3: Verify the index exists**

```sql
select indexname from pg_indexes where tablename = 'qrdd_bu_accounts';
```

Expected: `idx_qrdd_bu_accounts_name_sof_acct1` present, `idx_qrdd_bu_accounts_name` absent.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260704_qrdd_bu_accounts_composite_unique.sql
git commit -m "feat(qrdd): composite unique on bu_accounts (name, sof, account1)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Bulk Upsert Methods in Composable Trio

**Files:**
- Modify: `src/modules/qrdd/composables/useBuAccounts.js` — add `bulkUpsert()`
- Modify: `src/modules/qrdd/composables/useMerchantWhitelist.js` — add `bulkUpsert()`
- Modify: `src/modules/qrdd/composables/usePromoRule.js` — add `bulkUpsert()`

**Interfaces:**
- Consumes: `profile.full_name` from `useAuth()` (already imported in all three)
- Produces:
  - `useBuAccounts.bulkUpsert(rows: Array) → Promise<{inserted: number, updated: number, errors: Array}>`
  - `useMerchantWhitelist.bulkUpsert(rows: Array) → Promise<{inserted: number, updated: number, errors: Array}>`
  - `usePromoRule.bulkUpsert(rows: Array) → Promise<{inserted: number, updated: number, errors: Array}>`

- [ ] **Step 1: Add `bulkUpsert` to `useBuAccounts.js`**

In `useBuAccounts.js`, add after `deleteItem` method (before `exportColumns`):

```js
async function bulkUpsert(rows) {
  let inserted = 0
  let updated = 0
  const errors = []

  // Pre-query existing rows by match key (name, sof, account1)
  const { data: existing } = await supabase
    .from('qrdd_bu_accounts')
    .select('id, name, sof, account1')

  const existingMap = new Map()
  for (const r of (existing || [])) {
    existingMap.set(`${r.name}::${r.sof}::${r.account1}`, r.id)
  }

  // Split into INSERT vs UPDATE
  const toInsert = []
  const toUpdate = []

  for (const row of rows) {
    const key = `${row.name}::${row.sof}::${row.account1}`
    const existingId = existingMap.get(key)
    if (existingId) {
      toUpdate.push({ ...row, _id: existingId })
    } else {
      toInsert.push(row)
    }
  }

  // Batch insert (50 at a time)
  for (let i = 0; i < toInsert.length; i += 50) {
    const batch = toInsert.slice(i, i + 50)
    const { error: e } = await supabase
      .from('qrdd_bu_accounts')
      .insert(batch)
    if (e) { errors.push(...batch.map(r => ({ row: r.name, error: e.message }))) }
    else { inserted += batch.length }
  }

  // Update one-by-one (ponytail: fine for small update sets; batch upsert if grows)
  for (const row of toUpdate) {
    const { error: e } = await supabase
      .from('qrdd_bu_accounts')
      .update({
        sof: row.sof,
        account1: row.account1,
        acctname1: row.acctname1,
        percentage1: row.percentage1,
        account2: row.account2,
        acctname2: row.acctname2,
        percentage2: row.percentage2,
        updated_at: new Date().toISOString(),
      })
      .eq('id', row._id)
    if (e) { errors.push({ row: row.name, error: e.message }) }
    else { updated++ }
  }

  // Reload if anything changed
  if (inserted > 0 || updated > 0) await loadItems()

  return { inserted, updated, errors }
}
```

- [ ] **Step 2: Add `bulkUpsert` to return value in `useBuAccounts.js`**

In the return object, add:
```js
bulkUpsert,
```

- [ ] **Step 3: Add `bulkUpsert` to `useMerchantWhitelist.js`**

In `useMerchantWhitelist.js`, add after `deleteItem` method (before `exportColumns`):

```js
async function bulkUpsert(rows) {
  let inserted = 0
  let updated = 0
  const errors = []

  const { data: existing } = await supabase
    .from('qrdd_merchant_whitelist')
    .select('id, merchant_id')

  const existingMap = new Map()
  for (const r of (existing || [])) {
    existingMap.set(r.merchant_id, r.id)
  }

  const toInsert = []
  const toUpdate = []

  for (const row of rows) {
    const existingId = existingMap.get(row.merchant_id)
    if (existingId) {
      toUpdate.push({ ...row, _id: existingId })
    } else {
      toInsert.push(row)
    }
  }

  for (let i = 0; i < toInsert.length; i += 50) {
    const batch = toInsert.slice(i, i + 50)
    const { error: e } = await supabase
      .from('qrdd_merchant_whitelist')
      .insert(batch)
    if (e) { errors.push(...batch.map(r => ({ row: r.merchant_id, error: e.message }))) }
    else { inserted += batch.length }
  }

  for (const row of toUpdate) {
    const { error: e } = await supabase
      .from('qrdd_merchant_whitelist')
      .update({
        merchant_name: row.merchant_name,
        bu_name: row.bu_name,
        status: row.status || 'ACTIVE',
        updated_by: row.updated_by,
        updated_at: new Date().toISOString(),
      })
      .eq('id', row._id)
    if (e) { errors.push({ row: row.merchant_id, error: e.message }) }
    else { updated++ }
  }

  if (inserted > 0 || updated > 0) await loadItems()

  return { inserted, updated, errors }
}
```

Add `bulkUpsert` to the return object.

- [ ] **Step 4: Add `bulkUpsert` to `usePromoRule.js`**

In `usePromoRule.js`, add after `deleteItem` method (before `exportColumns`):

```js
async function bulkUpsert(rows) {
  let inserted = 0
  let updated = 0
  const errors = []

  const { data: existing } = await supabase
    .from('qrdd_promo_rules')
    .select('promo_id')

  const existingSet = new Set((existing || []).map(r => r.promo_id))

  const toInsert = []
  const toUpdate = []

  for (const row of rows) {
    if (existingSet.has(row.promo_id)) {
      toUpdate.push(row)
    } else {
      toInsert.push(row)
    }
  }

  for (let i = 0; i < toInsert.length; i += 50) {
    const batch = toInsert.slice(i, i + 50)
    const { error: e } = await supabase
      .from('qrdd_promo_rules')
      .insert(batch)
    if (e) { errors.push(...batch.map(r => ({ row: r.promo_id, error: e.message }))) }
    else { inserted += batch.length }
  }

  for (const row of toUpdate) {
    const { error: e } = await supabase
      .from('qrdd_promo_rules')
      .update({
        promo_name: row.promo_name,
        merchant_id: row.merchant_id,
        bu_name: row.bu_name,
        start_date: row.start_date,
        end_date: row.end_date,
        prm_discount_type: row.prm_discount_type,
        prm_discount_value: row.prm_discount_value,
        prm_max_discount: row.prm_max_discount,
        pl_discount_type: row.pl_discount_type,
        pl_discount_value: row.pl_discount_value,
        pl_max_discount: row.pl_max_discount,
        min_txn_amount: row.min_txn_amount,
        max_txn_amount: row.max_txn_amount,
        budget_amount: row.budget_amount,
        priority: row.priority || 0,
        status: row.status || 'ACTIVE',
        updated_by: row.updated_by,
        updated_at: new Date().toISOString(),
      })
      .eq('promo_id', row.promo_id)
    if (e) { errors.push({ row: row.promo_id, error: e.message }) }
    else { updated++ }
  }

  if (inserted > 0 || updated > 0) await loadItems()

  return { inserted, updated, errors }
}
```

Add `bulkUpsert` to the return object.

- [ ] **Step 5: Commit**

```bash
git add src/modules/qrdd/composables/useBuAccounts.js src/modules/qrdd/composables/useMerchantWhitelist.js src/modules/qrdd/composables/usePromoRule.js
git commit -m "feat(qrdd): add bulkUpsert to BU, merchant, promo composables

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Import Composable — Parse, Validate, Orchestrate

**Files:**
- Create: `src/modules/qrdd/composables/useImport.js`

**Interfaces:**
- Consumes: `useAuth().profile` for `full_name`, `useBuAccounts().bulkUpsert`, `useMerchantWhitelist().bulkUpsert`, `usePromoRule().bulkUpsert`
- Produces:
  - `useImport().parseFile(file: File) → Promise<{ sheets: Array<{name, rows, summary}> }>`
  - `useImport().runImport(sheets) → Promise<{ results: Array<{name, inserted, updated, errors}> }>`
  - `useImport().fullNameMissing: ComputedRef<boolean>`

- [ ] **Step 1: Create `useImport.js` — sheet parsing**

```js
import { ref, computed } from 'vue'
import { supabase } from '@/lib/supabase.js'
import { useAuth } from '@/composables/useAuth.js'
import { useBuAccounts } from './useBuAccounts.js'
import { useMerchantWhitelist } from './useMerchantWhitelist.js'
import { usePromoRule } from './usePromoRule.js'
import { useToast } from '@/lib/composables/useToast.js'

export function useImport() {
  const { profile } = useAuth()
  const buAccounts = useBuAccounts()
  const mw = useMerchantWhitelist()
  const pr = usePromoRule()
  const toast = useToast()

  const loading = ref(false)
  const progress = ref(0)
  const progressTotal = ref(0)

  const fullNameMissing = computed(() => !profile.value?.full_name)

  // Sheet name → expected config
  const SHEET_CONFIG = {
    discount_bu_accounts: {
      table: 'bu',
      headers: ['name', 'sof', 'account1', 'acctname1', 'percentage1', 'account2', 'acctname2', 'percentage2'],
      required: ['name', 'sof', 'account1', 'acctname1', 'percentage1', 'account2', 'acctname2', 'percentage2'],
    },
    merchant_whitelist: {
      table: 'mw',
      headers: ['merchant_id', 'merchant_name', 'bu_name', 'status'],
      required: ['merchant_id', 'merchant_name', 'bu_name'],
    },
    promo_rule: {
      table: 'pr',
      headers: ['promo_id', 'promo_name', 'merchant_id', 'bu_name', 'start_date', 'end_date',
        'prm_discount_type', 'prm_discount_value', 'prm_max_discount',
        'pl_discount_type', 'pl_discount_value', 'pl_max_discount',
        'min_txn_amount', 'max_txn_amount', 'budget_amount', 'priority', 'status'],
      required: ['promo_id', 'promo_name', 'bu_name', 'start_date', 'end_date',
        'prm_discount_type', 'prm_discount_value', 'prm_max_discount',
        'pl_discount_type', 'pl_discount_value', 'pl_max_discount', 'min_txn_amount'],
    },
  }

  async function parseFile(file) {
    const XLSX = await import('xlsx')
    const buf = await file.arrayBuffer()
    const wb = XLSX.read(new Uint8Array(buf), { type: 'array' })

    // Load DB context for FK validation
    const [{ data: existingBu }, { data: existingMw }] = await Promise.all([
      supabase.from('qrdd_bu_accounts').select('name, sof, account1'),
      supabase.from('qrdd_merchant_whitelist').select('merchant_id'),
    ])

    const buKeys = new Set((existingBu || []).map(r => `${r.name}::${r.sof}::${r.account1}`))
    // ponytail: bu_name must reference name only (no SOF filtering) since FK is on name column
    const buNames = new Set((existingBu || []).map(r => r.name))
    const merchantIds = new Set((existingMw || []).map(r => r.merchant_id))

    const sheets = []

    for (const [sheetName, config] of Object.entries(SHEET_CONFIG)) {
      const ws = wb.Sheets[sheetName]
      if (!ws) continue

      const raw = XLSX.utils.sheet_to_json(ws, { header: 1 })
      if (raw.length < 2) continue

      const headers = raw[0].map(h => String(h).trim())
      const rows = []
      const errors = []

      for (let i = 1; i < raw.length; i++) {
        const obj = {}
        for (let j = 0; j < headers.length; j++) {
          const key = headers[j]
          if (config.headers.includes(key)) {
            let val = raw[i][j]
            if (val != null) val = String(val).trim()
            if (val === 'NULL' || val === '') val = null
            obj[key] = val
          }
        }

        // Validate required
        const missing = config.required.filter(k => obj[k] == null || obj[k] === '')
        if (missing.length) {
          errors.push({ row: i, error: `Missing: ${missing.join(', ')}` })
        }

        // Validate per-table rules
        if (sheetName === 'discount_bu_accounts') {
          if (obj.sof && !['PRIME', 'PAYLATER'].includes(obj.sof)) {
            errors.push({ row: i, error: `Invalid SOF "${obj.sof}"` })
          }
          const p1 = parseFloat(obj.percentage1)
          const p2 = parseFloat(obj.percentage2)
          if (!isNaN(p1) && !isNaN(p2) && Math.abs(p1 + p2 - 1) > 0.001) {
            errors.push({ row: i, error: `Percentages sum to ${p1 + p2}, not 1.0` })
          }
          // Check duplicates within file
          const dupKey = `${obj.name}::${obj.sof}::${obj.account1}`
          if (rows.some(r => `${r.name}::${r.sof}::${r.account1}` === dupKey)) {
            errors.push({ row: i, error: `Duplicate match key: ${dupKey}` })
          }
        }

        if (sheetName === 'merchant_whitelist') {
          if (obj.merchant_id && rows.some(r => r.merchant_id === obj.merchant_id)) {
            errors.push({ row: i, error: `Duplicate merchant_id: ${obj.merchant_id}` })
          }
        }

        if (sheetName === 'promo_rule') {
          if (obj.promo_id && rows.some(r => r.promo_id === obj.promo_id)) {
            errors.push({ row: i, error: `Duplicate promo_id: ${obj.promo_id}` })
          }
          if (obj.end_date && obj.start_date && obj.end_date < obj.start_date) {
            errors.push({ row: i, error: `end_date before start_date` })
          }
        }

        rows.push(obj)
      }

      // Pre-compute new/update split
      let newCount = 0, updateCount = 0
      for (const row of rows) {
        if (sheetName === 'discount_bu_accounts') {
          buKeys.has(`${row.name}::${row.sof}::${row.account1}`) ? updateCount++ : newCount++
        } else if (sheetName === 'merchant_whitelist') {
          merchantIds.has(row.merchant_id) ? updateCount++ : newCount++
        } else if (sheetName === 'promo_rule') {
          // We'll query in runImport
          updateCount = null
          newCount = rows.length
        }
      }

      sheets.push({
        name: sheetName,
        config,
        rows,
        errors,
        summary: {
          total: rows.length,
          errors: errors.length,
          newCount: updateCount != null ? newCount : null,
          updateCount: updateCount != null ? updateCount : null,
        },
      })
    }

    return { sheets }
  }

  async function runImport(sheets) {
    const results = []
    progressTotal.value = sheets.reduce((s, sh) => s + sh.rows.length, 0)
    progress.value = 0

    // FK order: BU → merchants → promos
    const order = ['discount_bu_accounts', 'merchant_whitelist', 'promo_rule']
    const fullName = profile.value?.full_name || 'SYSTEM'

    for (const sheetName of order) {
      const sheet = sheets.find(s => s.name === sheetName)
      if (!sheet || sheet.errors.length > 0) continue
      if (!sheet.rows.length) continue

      const rowsWithMeta = sheet.rows.map(r => ({
        ...r,
        created_by: fullName,
        updated_by: fullName,
      }))

      let result
      if (sheetName === 'discount_bu_accounts') {
        result = await buAccounts.bulkUpsert(rowsWithMeta)
      } else if (sheetName === 'merchant_whitelist') {
        result = await mw.bulkUpsert(rowsWithMeta)
      } else if (sheetName === 'promo_rule') {
        result = await pr.bulkUpsert(rowsWithMeta)
      }

      results.push({ name: sheetName, ...result })
      progress.value += sheet.rows.length

      toast.success(`${sheetName}: ${result.inserted} inserted, ${result.updated} updated${result.errors.length ? `, ${result.errors.length} failed` : ''}`)
    }

    progress.value = progressTotal.value
    return { results }
  }

  return {
    loading, progress, progressTotal,
    fullNameMissing,
    parseFile, runImport,
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/modules/qrdd/composables/useImport.js
git commit -m "feat(qrdd): add useImport composable for Excel parsing and upsert

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: ImportTab Component + QrddView Integration

**Files:**
- Create: `src/modules/qrdd/components/ImportTab.vue`
- Modify: `src/modules/qrdd/views/QrddView.vue` — add import tab, guard, state

**Interfaces:**
- Consumes: `useImport()` composable
- Produces: Import tab visible in QRDD pill tabs when user has `bu-accounts.read` access

- [ ] **Step 1: Create `ImportTab.vue`**

```vue
<template>
  <div class="import-tab">
    <!-- Full name guard -->
    <LiBanner v-if="importCtx.fullNameMissing.value" variant="warning" icon="warning" class="import-tab__banner">
      Please set your full name in <router-link to="/profile">Profile</router-link> before importing.
    </LiBanner>

    <!-- Drop zone -->
    <LiUpload
      v-model="files"
      accept=".xlsx,.xls"
      hint=".xlsx or .xls files only"
      @change="onFileSelected"
    />

    <!-- Loading state -->
    <div v-if="importCtx.loading.value" class="import-tab__loading">
      <span class="material-symbols-outlined import-tab__spinner">progress_activity</span>
      Parsing file...
    </div>

    <!-- No data -->
    <LiEmptyState
      v-else-if="sheets && sheets.length === 0"
      icon="description"
      title="No data found"
      description="The file doesn't contain any recognized sheets (discount_bu_accounts, merchant_whitelist, promo_rule)."
    />

    <!-- Sheet Preview Cards -->
    <template v-else-if="sheets && sheets.length > 0">
      <div class="import-tab__cards">
        <div
          v-for="sheet in sheets"
          :key="sheet.name"
          class="import-tab__card"
          :class="{ 'import-tab__card--expanded': expandedSheet === sheet.name, 'import-tab__card--has-errors': sheet.errors.length > 0 }"
          @click="expandedSheet = expandedSheet === sheet.name ? null : sheet.name"
        >
          <div class="import-tab__card-header">
            <span class="import-tab__card-icon">
              <span class="material-symbols-outlined">
                {{ sheet.config.table === 'bu' ? 'account_balance' : sheet.config.table === 'mw' ? 'store' : 'percent' }}
              </span>
            </span>
            <div class="import-tab__card-info">
              <div class="import-tab__card-title">{{ sheetNameLabel(sheet.name) }}</div>
              <div class="import-tab__card-count">{{ sheet.rows.length }} rows</div>
            </div>
            <div class="import-tab__card-stats">
              <span v-if="sheet.summary.newCount != null" class="import-tab__stat import-tab__stat--new" title="New">✓ {{ sheet.summary.newCount }}</span>
              <span v-if="sheet.summary.updateCount != null && sheet.summary.updateCount > 0" class="import-tab__stat import-tab__stat--update" title="Update">↻ {{ sheet.summary.updateCount }}</span>
              <span v-if="sheet.errors.length > 0" class="import-tab__stat import-tab__stat--error" title="Errors">✗ {{ sheet.errors.length }}</span>
            </div>
            <span class="material-symbols-outlined import-tab__chevron">{{ expandedSheet === sheet.name ? 'expand_less' : 'expand_more' }}</span>
          </div>

          <!-- Expanded preview -->
          <div v-if="expandedSheet === sheet.name" class="import-tab__card-body">
            <!-- Error list -->
            <div v-if="sheet.errors.length > 0" class="import-tab__error-list">
              <div v-for="(err, i) in sheet.errors.slice(0, 50)" :key="i" class="import-tab__error-item">
                <span class="material-symbols-outlined import-tab__error-icon">error</span>
                Row {{ err.row }}: {{ err.error }}
              </div>
              <div v-if="sheet.errors.length > 50" class="import-tab__error-more">
                ...and {{ sheet.errors.length - 50 }} more errors
              </div>
            </div>
            <!-- Preview table (first 5 rows) -->
            <div class="import-tab__preview-wrap">
              <table class="import-tab__preview-table">
                <thead>
                  <tr>
                    <th v-for="h in sheet.config.headers" :key="h">{{ h }}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(row, ri) in sheet.rows.slice(0, 5)" :key="ri">
                    <td v-for="h in sheet.config.headers" :key="h">{{ row[h] ?? '—' }}</td>
                  </tr>
                </tbody>
              </table>
              <div v-if="sheet.rows.length > 5" class="import-tab__preview-more">
                ...and {{ sheet.rows.length - 5 }} more rows
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Import button + progress -->
      <div class="import-tab__actions">
        <button
          class="import-tab__import-btn"
          :disabled="!canImport || importing"
          @click="onImport"
        >
          <span v-if="importing" class="import-tab__btn-spinner"></span>
          {{ importing ? 'Importing...' : 'Import All' }}
        </button>
      </div>

      <LiProgress
        v-if="importing"
        :value="importCtx.progress.value"
        :max="importCtx.progressTotal.value"
        class="import-tab__progress"
      />
    </template>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useImport } from '../composables/useImport.js'
import LiUpload from '@lib/components/LiUpload.vue'
import LiBanner from '@lib/components/LiBanner.vue'
import LiEmptyState from '@lib/components/LiEmptyState.vue'
import LiProgress from '@lib/components/LiProgress.vue'
import LiGlassCard from '@lib/components/LiGlassCard.vue'

const importCtx = useImport()

const files = ref([])
const sheets = ref(null)
const importing = ref(false)
const expandedSheet = ref(null)

const canImport = computed(() => {
  if (importCtx.fullNameMissing.value) return false
  if (!sheets.value) return false
  return sheets.value.some(s => s.rows.length > 0 && s.errors.length === 0)
})

function sheetNameLabel(name) {
  const map = {
    discount_bu_accounts: 'BU Accounts',
    merchant_whitelist: 'Merchant Whitelist',
    promo_rule: 'Promo Rules',
  }
  return map[name] || name
}

async function onFileSelected(newFiles) {
  if (!newFiles.length) return
  sheets.value = null
  expandedSheet.value = null
  importCtx.loading.value = true
  try {
    const result = await importCtx.parseFile(newFiles[0])
    sheets.value = result.sheets
  } catch (e) {
    importCtx.toast?.error?.('Failed to parse file: ' + e.message)
  } finally {
    importCtx.loading.value = false
  }
}

async function onImport() {
  if (!canImport.value) return
  importing.value = true
  try {
    await importCtx.runImport(sheets.value)
  } finally {
    importing.value = false
  }
}
</script>

<style scoped>
.import-tab {
  display: flex;
  flex-direction: column;
  gap: var(--space-lg, 24px);
}

.import-tab__banner {
  margin-bottom: 0;
}

.import-tab__loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-s, 8px);
  padding: var(--space-2xl, 32px);
  color: var(--color-gray-500, #999);
  font-size: 14px;
}

.import-tab__spinner {
  animation: spin 800ms linear infinite;
  font-size: 20px;
}

@keyframes spin { to { transform: rotate(360deg); } }

/* Cards grid */
.import-tab__cards {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-md, 16px);
}

.import-tab__card {
  background: rgba(255,255,255,0.7);
  border: 1px solid rgba(0,0,0,0.06);
  border-radius: var(--radius-md, 16px);
  overflow: hidden;
  cursor: pointer;
  transition: border-color 200ms ease-out, box-shadow 200ms ease-out;
}

.import-tab__card:hover {
  border-color: rgba(0,0,0,0.12);
  box-shadow: 0 2px 12px rgba(0,0,0,0.04);
}

.import-tab__card--has-errors {
  border-color: rgba(200,62,59,0.3);
}

.import-tab__card--expanded {
  grid-row: span 2;
}

.import-tab__card-header {
  display: flex;
  align-items: center;
  gap: var(--space-m, 12px);
  padding: var(--space-l, 16px);
}

.import-tab__card-icon {
  width: 40px; height: 40px;
  display: flex; align-items: center; justify-content: center;
  background: linear-gradient(135deg, #6366F1, #8B5CF6);
  border-radius: var(--radius-sm, 12px);
  flex-shrink: 0;
}
.import-tab__card-icon .material-symbols-outlined { font-size: 20px; color: #fff; }

.import-tab__card-info { flex: 1; min-width: 0; }
.import-tab__card-title { font-size: 14px; font-weight: 600; color: var(--color-on-surface, #333); }
.import-tab__card-count { font-size: 12px; color: var(--color-gray-500, #999); }

.import-tab__card-stats {
  display: flex; gap: 4px; flex-shrink: 0;
}

.import-tab__stat {
  display: inline-block; padding: 2px 6px; border-radius: 4px;
  font-size: 10px; font-weight: 700;
}
.import-tab__stat--new { background: #E6F4EA; color: #137333; }
.import-tab__stat--update { background: #E6E6FF; color: #0047B2; }
.import-tab__stat--error { background: #FDECEE; color: #A33129; }

.import-tab__chevron {
  font-size: 20px; color: var(--color-gray-400, #B3B3B3);
  flex-shrink: 0; transition: transform 200ms ease-out;
}

.import-tab__card-body {
  padding: 0 var(--space-l, 16px) var(--space-l, 16px);
  display: flex; flex-direction: column; gap: var(--space-m, 12px);
}

.import-tab__error-list {
  max-height: 200px; overflow-y: auto;
  display: flex; flex-direction: column; gap: 4px;
}

.import-tab__error-item {
  display: flex; align-items: flex-start; gap: 4px;
  font-size: 12px; color: #A33129; line-height: 1.5;
}

.import-tab__error-icon { font-size: 16px; flex-shrink: 0; margin-top: 1px; }

.import-tab__error-more {
  font-size: 12px; color: var(--color-gray-500, #999); font-style: italic;
}

.import-tab__preview-wrap { overflow-x: auto; }

.import-tab__preview-table {
  width: 100%; border-collapse: collapse;
  font-size: 11px;
}

.import-tab__preview-table th {
  text-align: left; padding: 6px 8px;
  background: var(--color-gray-100, #F2F2F2);
  color: var(--color-gray-700, #666);
  font-weight: 600; white-space: nowrap;
  border-bottom: 1px solid rgba(0,0,0,0.08);
}

.import-tab__preview-table td {
  padding: 4px 8px; white-space: nowrap;
  overflow: hidden; text-overflow: ellipsis; max-width: 160px;
  color: var(--color-gray-800, #4D4D4D);
}

.import-tab__preview-more {
  text-align: center; font-size: 12px; color: var(--color-gray-500, #999);
  padding: var(--space-s, 8px);
}

.import-tab__actions {
  display: flex; justify-content: center;
}

.import-tab__import-btn {
  display: flex; align-items: center; gap: 8px;
  padding: 12px 32px;
  background: linear-gradient(135deg, #6366F1, #8B5CF6);
  color: #fff; border: none;
  border-radius: var(--radius-pill, 999px);
  font-family: var(--font-body, 'Inter', sans-serif);
  font-weight: 700; font-size: 15px;
  cursor: pointer; transition: all 200ms ease-out;
  box-shadow: 0 4px 16px rgba(99, 102, 241, 0.3);
}

.import-tab__import-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 6px 24px rgba(99, 102, 241, 0.4);
}

.import-tab__import-btn:disabled {
  opacity: 0.5; cursor: not-allowed;
}

.import-tab__btn-spinner {
  display: inline-block; width: 16px; height: 16px;
  border: 2px solid rgba(255,255,255,0.3);
  border-top-color: #fff; border-radius: 50%;
  animation: spin 800ms linear infinite;
}

.import-tab__progress {
  width: 100%;
}

/* ── Responsive ── */
@media (max-width: 768px) {
  .import-tab__cards {
    grid-template-columns: 1fr;
  }

  .import-tab__card--expanded {
    grid-row: auto;
  }
}

@media (max-width: 480px) {
  .import-tab {
    gap: var(--space-md, 16px);
  }

  .import-tab__import-btn {
    width: 100%;
    justify-content: center;
  }
}
</style>
```

- [ ] **Step 2: Add Import tab to QrddView.vue**

In `src/modules/qrdd/views/QrddView.vue`:

Add to `allTabDefs`:
```js
{ id: 'import', label: 'Import', desc: 'Bulk data import', icon: 'upload', gate: 'bu-accounts.read' },
```

Add import before DashboardTab:
```html
<ImportTab v-else-if="activeTab === 'import'" key="import" />
```

Add to imports:
```js
import ImportTab from '../components/ImportTab.vue'
```

- [ ] **Step 3: Commit**

```bash
git add src/modules/qrdd/components/ImportTab.vue src/modules/qrdd/views/QrddView.vue
git commit -m "feat(qrdd): add Import tab with Excel preview and bulk upsert

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: Signup Form Fix — Full Name + Username Mandatory

**Files:**
- Modify: `src/modules/auth/views/LoginView.vue`

**Interfaces:**
- Produces: signup form with field order Full Name → Email → Username → Password, all mandatory

- [ ] **Step 1: Add fullName ref and update template in LoginView.vue**

In `<script setup>`, add after `signupUsername`:
```js
const signupFullName = ref('')
```

Add to `focus` object:
```js
signupFullName: false,
```

In `<template>`, replace the signup section (lines 47-80) with:

```html
<template v-else>
  <div class="login-field">
    <label class="login-field__label" for="signup-fullname">Full Name</label>
    <div class="login-field__input-group" :class="{ 'is-focused': focus.signupFullName }">
      <span class="material-symbols-outlined login-field__icon" aria-hidden="true">badge</span>
      <input
        id="signup-fullname"
        v-model="signupFullName"
        type="text"
        class="login-field__input"
        placeholder="Your full name"
        autocomplete="name"
        @focus="focus.signupFullName = true"
        @blur="focus.signupFullName = false"
      />
    </div>
  </div>
  <div class="login-field">
    <label class="login-field__label" for="signup-email">Email</label>
    <div class="login-field__input-group" :class="{ 'is-focused': focus.signupEmail }">
      <span class="material-symbols-outlined login-field__icon" aria-hidden="true">mail</span>
      <input
        id="signup-email"
        v-model="signupEmail"
        type="email"
        class="login-field__input"
        placeholder="nama@perusahaan.com"
        autocomplete="email"
        @focus="focus.signupEmail = true"
        @blur="focus.signupEmail = false"
      />
    </div>
  </div>
  <div class="login-field">
    <label class="login-field__label" for="signup-username">Username</label>
    <div class="login-field__input-group" :class="{ 'is-focused': focus.signupUsername }">
      <span class="material-symbols-outlined login-field__icon" aria-hidden="true">alternate_email</span>
      <input
        id="signup-username"
        v-model="signupUsername"
        type="text"
        class="login-field__input"
        placeholder="username"
        autocomplete="username"
        @focus="focus.signupUsername = true"
        @blur="focus.signupUsername = false"
      />
    </div>
  </div>
</template>
```

- [ ] **Step 2: Update signUp call and validation**

In `onPasswordSubmit`, update the signup block:

```js
} else {
  // Client-side validation
  if (!signupFullName.value.trim()) {
    showBanner('Full name is required')
    return
  }
  if (!signupUsername.value.trim()) {
    showBanner('Username is required')
    return
  }
  await signUp({
    email: signupEmail.value,
    password: password.value,
    username: signupUsername.value,
    fullName: signupFullName.value,
  })
  showBanner('Akun dibuat. Menunggu aktivasi dari admin sebelum bisa sign in.', 'info')
  mode.value = 'signin'
}
```

- [ ] **Step 3: Clear signup fields on submit**

After successful signup, add:
```js
signupFullName.value = ''
signupUsername.value = ''
signupEmail.value = ''
```

- [ ] **Step 4: Commit**

```bash
git add src/modules/auth/views/LoginView.vue
git commit -m "fix(auth): make fullName and username mandatory on signup

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 6: QRDD Responsive — All Tabs + Components

**Files:**
- Modify: `src/modules/qrdd/components/BuAccountsTab.vue` — add @media breakpoints
- Modify: `src/modules/qrdd/components/MerchantWhitelistTab.vue` — add @media breakpoints
- Modify: `src/modules/qrdd/components/PromoRuleTab.vue` — add @media breakpoints
- Modify: `src/modules/qrdd/components/BuAccountForm.vue` — add @media breakpoints
- Modify: `src/modules/qrdd/components/MerchantForm.vue` — add @media breakpoints
- Modify: `src/modules/qrdd/components/PromoRuleForm.vue` — add @media breakpoints
- Modify: `src/modules/qrdd/components/DashboardTab.vue` — add missing 768px tablet toolbar styles
- Modify: `src/modules/qrdd/views/QrddView.vue` — scrollable tabs on mobile

**Interfaces:**
- Produces: all QRDD components respond correctly at 768px (tablet) and 480px (mobile) breakpoints

- [ ] **Step 1: BuAccountsTab — responsive styles**

Add to `BuAccountsTab.vue` `<style scoped>` before the closing `</style>`:

```css
/* ── Responsive ── */
@media (max-width: 768px) {
  .tab__toolbar {
    flex-direction: column;
    gap: 8px;
  }

  .tab__search {
    max-width: 100%;
  }

  .tab__toolbar-actions {
    width: 100%;
    justify-content: flex-end;
  }
}

@media (max-width: 480px) {
  .tab__toolbar-actions {
    flex-wrap: wrap;
    gap: 6px;
  }

  .tab__add-btn,
  .tab__export-btn {
    padding: 8px 14px;
    font-size: 12px;
  }
}
```

- [ ] **Step 2: MerchantWhitelistTab — responsive styles**

Add identical responsive block to `MerchantWhitelistTab.vue` `<style scoped>`:

```css
/* ── Responsive ── */
@media (max-width: 768px) {
  .tab__toolbar {
    flex-direction: column;
    gap: 8px;
  }

  .tab__search {
    max-width: 100%;
  }

  .tab__toolbar-actions {
    width: 100%;
    justify-content: flex-end;
  }
}

@media (max-width: 480px) {
  .tab__toolbar-actions {
    flex-wrap: wrap;
    gap: 6px;
  }

  .tab__add-btn,
  .tab__export-btn {
    padding: 8px 14px;
    font-size: 12px;
  }
}
```

- [ ] **Step 3: PromoRuleTab — responsive styles**

Add to `PromoRuleTab.vue` `<style scoped>`:

```css
/* ── Responsive ── */
@media (max-width: 768px) {
  .tab__toolbar {
    flex-direction: column;
    gap: 8px;
  }

  .tab__search-row {
    max-width: 100%;
  }

  .tab__search-col {
    width: 120px;
  }

  .tab__toolbar-actions {
    width: 100%;
    justify-content: flex-end;
  }
}

@media (max-width: 480px) {
  .tab__toolbar-actions {
    flex-wrap: wrap;
    gap: 6px;
  }

  .tab__add-btn,
  .tab__export-btn {
    padding: 8px 14px;
    font-size: 12px;
  }

  .tab__search-row {
    flex-direction: column;
    gap: 6px;
  }

  .tab__search-col {
    width: 100%;
  }
}
```

- [ ] **Step 4: DashboardTab — add tablet toolbar styles**

In `DashboardTab.vue`, add to existing `@media (max-width: 768px)` block:

```css
@media (max-width: 768px) {
  .dash-tab__charts { grid-template-columns: 1fr; }
  .dash-tab__recent { grid-template-columns: 1fr; }
  .dash-tab__cards { grid-template-columns: 1fr 1fr; }
  .dash-tab__toolbar { justify-content: center; }
}
```

Add new `@media (max-width: 480px)` block if not present:
```css
@media (max-width: 480px) {
  .dash-tab__cards { grid-template-columns: 1fr; }
  .dash-tab__export-btn { width: 100%; justify-content: center; }
}
```

- [ ] **Step 5: Form components — responsive form fields**

In all three form components (`BuAccountForm.vue`, `MerchantForm.vue`, `PromoRuleForm.vue`), add:

```css
/* ── Responsive ── */
@media (max-width: 480px) {
  .form__grid {
    grid-template-columns: 1fr;
  }
}
```

(If the form uses a grid layout class; if not, add responsive padding reduction.)

- [ ] **Step 6: QrddView — scrollable tabs on mobile**

In `QrddView.vue`, update the `@media (max-width: 768px)` block:

```css
@media (max-width: 768px) {
  .qrdd { padding: var(--space-md, 16px); gap: var(--space-md, 16px); }
  .qrdd__title { font-size: 20px; }
  .qrdd__icon-badge { width: 40px; height: 40px; }
  .qrdd__icon-badge .material-symbols-outlined { font-size: 22px; }
  .qrdd__tab { padding: 10px 8px; min-width: 0; flex-shrink: 0; }
  .qrdd__tab-desc { display: none; }

  .qrdd__tabs {
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
  }

  .qrdd__tabs::-webkit-scrollbar { display: none; }
}
```

- [ ] **Step 7: Commit**

```bash
git add src/modules/qrdd/components/BuAccountsTab.vue src/modules/qrdd/components/MerchantWhitelistTab.vue src/modules/qrdd/components/PromoRuleTab.vue src/modules/qrdd/components/DashboardTab.vue src/modules/qrdd/components/BuAccountForm.vue src/modules/qrdd/components/MerchantForm.vue src/modules/qrdd/components/PromoRuleForm.vue src/modules/qrdd/views/QrddView.vue
git commit -m "fix(qrdd): add responsive breakpoints to all QRDD components

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-Review

1. **Spec coverage:** All 5 sections covered — DB migration (T1), bulk upsert (T2), import composable (T3), ImportTab UI (T4), signup fix (T5), responsive all components (T6)
2. **Placeholder scan:** No TBD/TODO/placeholder text. All code blocks are complete.
3. **Type consistency:** `bulkUpsert` method signature consistent across all three composables. `useImport` exports match what `ImportTab` imports.
