# QR DD — Dashboard, Export, Pill Tabs — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Dashboard tab + homepage summary, XLSX export on every feature, and migrate QR DD + Admin tabs to QRIS-style animated pill tabs.

**Architecture:** New `useQrddDashboard` composable aggregates counts/grouping from existing 3 tables. `exportToXlsx` shared helper in `src/lib/`. Pill tab pattern copied from `QrisView.vue` — `<nav>` with animated indicator. `DashboardView` gains QR DD summary section. Existing composables extended with `exportFiltered()` methods.

**Tech Stack:** Vue 3 (Composition API), Supabase JS, xlsx (SheetJS), CSS-only charts

## Global Constraints

- All data shared across users (RLS `authenticated using (true)`)
- Export uses current filtered data (respects search query)
- Pill tab indicator animation: `0.35s cubic-bezier(0.34, 1.56, 0.64, 1)`
- Merchant ID in Excel: prefix `="..."` for IDs ≥10 digits to prevent scientific notation
- BU Accounts percentage in export: display as % (0.5000 → "50%")
- Promo sentinel values in export: unlimited→"Unlimited", ≤1→"No Minimum", null→"Unlimited"
- Dashboard tab: always visible (no feature gate), differs from CRUD tabs
- Homepage summary: only visible when `canModule('qrdd')` is true
- No chart library — CSS-only bars + conic-gradient donut
- Page size: 10 everywhere (unchanged)
- Toast on all export actions
- Commit per task

---

### Task 1: Install xlsx + Create export-xlsx helper

**Files:**
- Modify: `package.json`
- Create: `src/lib/export-xlsx.js`

**Interfaces:**
- Produces: `exportToXlsx(rows, columns, filename)` — writes XLSX file via SheetJS
  - `rows`: Array of data objects (raw DB row or filtered subset)
  - `columns`: Array of `{ key, label, format?, textFormula? }` — key maps to row property, label is Excel header
  - `format`: Optional `(value, row) => string` formatter
  - `textFormula`: Boolean, if true wraps value in `="..."` for Excel text coercion
  - `filename`: String without extension (`.xlsx` appended)

- [ ] **Step 1: Add xlsx dependency**

In `package.json`, add `"xlsx": "^0.18.5"` to dependencies:

```json
"xlsx": "^0.18.5",
```

Place after `"vue-router"` line.

Run: `npm install`

- [ ] **Step 2: Create src/lib/export-xlsx.js**

```js
import * as XLSX from 'xlsx'

// Prefix numeric IDs ≥10 digits with ="" so Excel treats them as text
function textFormula(v) {
  if (v == null) return ''
  const s = String(v)
  if (/^\d{10,}$/.test(s)) return `="${s}"`
  return s
}

export function exportToXlsx(rows, columns, filename) {
  const data = rows.map(row => {
    const obj = {}
    for (const col of columns) {
      const raw = row[col.key]
      const v = col.format ? col.format(raw, row) : raw
      obj[col.label] = col.textFormula ? textFormula(v) : (v ?? '')
    }
    return obj
  })
  const ws = XLSX.utils.json_to_sheet(data)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1')
  XLSX.writeFile(wb, `${filename}.xlsx`)
}

// Multi-sheet export for dashboard
export function exportMultiSheetXlsx(sheets, filename) {
  const wb = XLSX.utils.book_new()
  for (const sh of sheets) {
    const data = sh.rows.map(row => {
      const obj = {}
      for (const col of sh.columns) {
        const raw = row[col.key]
        const v = col.format ? col.format(raw, row) : raw
        obj[col.label] = col.textFormula ? textFormula(v) : (v ?? '')
      }
      return obj
    })
    const ws = XLSX.utils.json_to_sheet(data)
    XLSX.utils.book_append_sheet(wb, ws, sh.name)
  }
  XLSX.writeFile(wb, `${filename}.xlsx`)
}
```

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json src/lib/export-xlsx.js
git commit -m "feat: add xlsx dependency and export-xlsx shared helper

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Add export to useBuAccounts composable

**Files:**
- Modify: `src/modules/qrdd/composables/useBuAccounts.js`

**Interfaces:**
- Produces: `exportFiltered()` — exports current filtered data as XLSX
- Consumes: `exportToXlsx` from `@/lib/export-xlsx.js`

- [ ] **Step 1: Add export function**

After the `deleteItem` function in `useBuAccounts.js`, add:

```js
import { exportToXlsx } from '@/lib/export-xlsx.js'

// inside useBuAccounts(), add:

const exportColumns = [
  { key: 'name', label: 'Name' },
  { key: 'sof', label: 'SOF' },
  { key: 'account1', label: 'Expense Account', textFormula: true },
  { key: 'acctname1', label: 'Expense Name' },
  { key: 'percentage1', label: 'Expense %', format: v => Math.round(Number(v) * 100) + '%' },
  { key: 'account2', label: 'Receivable Account', textFormula: true },
  { key: 'acctname2', label: 'Receivable Name' },
  { key: 'percentage2', label: 'Receivable %', format: v => Math.round(Number(v) * 100) + '%' },
  { key: 'updated_at', label: 'Updated', format: v => v ? new Date(v).toISOString().slice(0, 10) : '' },
]

function exportFiltered() {
  const rows = filtered.value.length ? filtered.value : items.value
  if (!rows.length) {
    toast.error('No data to export')
    return
  }
  try {
    exportToXlsx(rows, exportColumns, 'qrdd_bu_accounts')
    toast.success(`Exported ${rows.length} BU accounts`)
  } catch (e) {
    toast.error('Export failed: ' + e.message)
  }
}
```

Add `exportFiltered` to the return object:

```js
return {
  // ... existing keys ...
  exportFiltered,
}
```

- [ ] **Step 2: Commit**

```bash
git add src/modules/qrdd/composables/useBuAccounts.js
git commit -m "feat(qrdd): add XLSX export to useBuAccounts composable

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Add export to useMerchantWhitelist composable

**Files:**
- Modify: `src/modules/qrdd/composables/useMerchantWhitelist.js`

**Interfaces:**
- Produces: `exportFiltered()`
- Consumes: `exportToXlsx` from `@/lib/export-xlsx.js`

- [ ] **Step 1: Add export function**

After `deleteItem`, add:

```js
import { exportToXlsx } from '@/lib/export-xlsx.js'

// inside useMerchantWhitelist(), add:

const exportColumns = [
  { key: 'merchant_id', label: 'Merchant ID', textFormula: true },
  { key: 'merchant_name', label: 'Merchant Name' },
  { key: 'bu_name', label: 'BU Name' },
  { key: 'status', label: 'Status' },
  { key: 'created_by', label: 'Created By' },
  { key: 'created_at', label: 'Created At', format: v => v ? new Date(v).toISOString().slice(0, 10) : '' },
  { key: 'updated_by', label: 'Updated By' },
  { key: 'updated_at', label: 'Updated At', format: v => v ? new Date(v).toISOString().slice(0, 10) : '' },
]

function exportFiltered() {
  const rows = filtered.value.length ? filtered.value : items.value
  if (!rows.length) {
    toast.error('No data to export')
    return
  }
  try {
    exportToXlsx(rows, exportColumns, 'qrdd_merchant_whitelist')
    toast.success(`Exported ${rows.length} merchants`)
  } catch (e) {
    toast.error('Export failed: ' + e.message)
  }
}
```

Add `exportFiltered` to the return object.

- [ ] **Step 2: Commit**

```bash
git add src/modules/qrdd/composables/useMerchantWhitelist.js
git commit -m "feat(qrdd): add XLSX export to useMerchantWhitelist composable

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: Add export to usePromoRule composable

**Files:**
- Modify: `src/modules/qrdd/composables/usePromoRule.js`

**Interfaces:**
- Produces: `exportFiltered()`
- Consumes: `exportToXlsx`, `UNLIMITED_AMOUNT`, `NO_MINIMUM` from existing constants

- [ ] **Step 1: Add export function**

```js
import { exportToXlsx } from '@/lib/export-xlsx.js'

// inside usePromoRule(), after deleteItem:

const exportColumns = [
  { key: 'promo_id', label: 'Promo ID' },
  { key: 'promo_name', label: 'Promo Name' },
  { key: 'merchant_id', label: 'Merchant ID', textFormula: true, format: v => v || 'All Merchants' },
  { key: 'bu_name', label: 'BU Name' },
  { key: 'start_date', label: 'Start Date' },
  { key: 'end_date', label: 'End Date' },
  { key: 'prm_discount_type', label: 'PRM Discount Type' },
  { key: 'prm_discount_value', label: 'PRM Discount Value', format: (v, row) => row.prm_discount_type === 'PERCENTAGE' ? v + '%' : v },
  { key: 'prm_max_discount', label: 'PRM Max Discount', format: v => Number(v) >= 49999999999 ? 'Unlimited' : v },
  { key: 'pl_discount_type', label: 'PL Discount Type' },
  { key: 'pl_discount_value', label: 'PL Discount Value', format: (v, row) => row.pl_discount_type === 'PERCENTAGE' ? v + '%' : v },
  { key: 'pl_max_discount', label: 'PL Max Discount', format: v => Number(v) >= 49999999999 ? 'Unlimited' : v },
  { key: 'min_txn_amount', label: 'Min Txn Amount', format: v => Number(v) <= 1 ? 'No Minimum' : v },
  { key: 'max_txn_amount', label: 'Max Txn Amount', format: v => v == null ? 'Unlimited' : v },
  { key: 'budget_amount', label: 'Budget Amount', format: v => v == null ? 'Unlimited' : v },
  { key: 'priority', label: 'Priority' },
  { key: 'status', label: 'Status' },
  { key: 'created_by', label: 'Created By' },
  { key: 'updated_by', label: 'Updated By' },
  { key: 'updated_at', label: 'Updated At', format: v => v ? new Date(v).toISOString().slice(0, 10) : '' },
]

function exportFiltered() {
  const rows = filtered.value.length ? filtered.value : items.value
  if (!rows.length) {
    toast.error('No data to export')
    return
  }
  try {
    exportToXlsx(rows, exportColumns, 'qrdd_promo_rules')
    toast.success(`Exported ${rows.length} promo rules`)
  } catch (e) {
    toast.error('Export failed: ' + e.message)
  }
}
```

Add `exportFiltered` to return object.

- [ ] **Step 2: Commit**

```bash
git add src/modules/qrdd/composables/usePromoRule.js
git commit -m "feat(qrdd): add XLSX export to usePromoRule composable

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: Add Export buttons to BuAccountsTab

**Files:**
- Modify: `src/modules/qrdd/components/BuAccountsTab.vue`

**Interfaces:**
- New prop: `canExport: Boolean` (default true)
- New emit: `export`

- [ ] **Step 1: Add Export button in toolbar**

Replace the toolbar div in `BuAccountsTab.vue` template:

```html
<div class="tab__toolbar">
  <LiTextField v-model="searchQueryProxy" placeholder="Search BU accounts..." iconLeft="search" class="tab__search" />
  <div class="tab__toolbar-actions">
    <button class="tab__export-btn" @click="$emit('export')">
      <span class="material-symbols-outlined">file_save</span>
      Export
    </button>
    <button v-if="canCreate" class="tab__add-btn" @click="$emit('add')">
      <span class="material-symbols-outlined">add</span>
      Add BU Account
    </button>
  </div>
</div>
```

Add emit:

```js
const emit = defineEmits(['update:searchQuery', 'update:currentPage', 'add', 'edit', 'delete', 'export'])
```

Add styles after `.tab__add-btn:hover`:

```css
.tab__toolbar-actions { display: flex; align-items: center; gap: 8px; }
.tab__export-btn {
  display: flex; align-items: center; gap: 6px;
  padding: 10px 16px;
  background: transparent;
  color: var(--color-gray-600, #666);
  border: 1px solid rgba(0,0,0,0.1);
  border-radius: var(--radius-pill, 999px);
  font-weight: 600; font-size: 13px;
  font-family: var(--font-body, 'Inter', sans-serif);
  cursor: pointer; transition: all 200ms; white-space: nowrap;
}
.tab__export-btn:hover { background: rgba(0,0,0,0.04); border-color: rgba(0,0,0,0.2); }
.tab__export-btn .material-symbols-outlined { font-size: 18px; }
```

- [ ] **Step 2: Commit**

```bash
git add src/modules/qrdd/components/BuAccountsTab.vue
git commit -m "feat(qrdd): add Export button to BuAccountsTab

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 6: Add Export buttons to MerchantWhitelistTab

**Files:**
- Modify: `src/modules/qrdd/components/MerchantWhitelistTab.vue`

- [ ] **Step 1: Add Export button — same pattern as Task 5**

Replace toolbar:

```html
<div class="tab__toolbar">
  <LiTextField v-model="searchQueryProxy" placeholder="Search merchants..." iconLeft="search" class="tab__search" />
  <div class="tab__toolbar-actions">
    <button class="tab__export-btn" @click="$emit('export')">
      <span class="material-symbols-outlined">file_save</span>
      Export
    </button>
    <button v-if="canCreate" class="tab__add-btn" @click="$emit('add')">
      <span class="material-symbols-outlined">add</span>
      Add Merchant
    </button>
  </div>
</div>
```

Add `'export'` to emit array.

Add same CSS as Task 5 for `.tab__toolbar-actions` and `.tab__export-btn`.

- [ ] **Step 2: Commit**

```bash
git add src/modules/qrdd/components/MerchantWhitelistTab.vue
git commit -m "feat(qrdd): add Export button to MerchantWhitelistTab

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 7: Add Export buttons to PromoRuleTab

**Files:**
- Modify: `src/modules/qrdd/components/PromoRuleTab.vue`

- [ ] **Step 1: Add Export button — same pattern as Task 5**

Replace toolbar:

```html
<div class="tab__toolbar">
  <div class="tab__search-row">
    <LiSelect v-model="searchColumnProxy" :options="searchColumns" class="tab__search-col" />
    <LiTextField v-model="searchQueryProxy" :placeholder="'Search ' + searchColumnLabel + '...'" iconLeft="search" class="tab__search" />
  </div>
  <div class="tab__toolbar-actions">
    <button class="tab__export-btn" @click="$emit('export')">
      <span class="material-symbols-outlined">file_save</span>
      Export
    </button>
    <button v-if="canCreate" class="tab__add-btn" @click="$emit('add')">
      <span class="material-symbols-outlined">add</span>
      Add Promo
    </button>
  </div>
</div>
```

Add `'export'` to emit array.

Add same CSS as Task 5 for `.tab__toolbar-actions` and `.tab__export-btn`.

- [ ] **Step 2: Commit**

```bash
git add src/modules/qrdd/components/PromoRuleTab.vue
git commit -m "feat(qrdd): add Export button to PromoRuleTab

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 8: Create useQrddDashboard composable

**Files:**
- Create: `src/modules/qrdd/composables/useQrddDashboard.js`

**Interfaces:**
- Consumes: `supabase` from `@/lib/supabase.js`
- Produces:
  - `stats: Ref<{ buCount, buPrimeCount, buPaylaterCount, merchantCount, merchantActive, merchantInactive, promoCount, promoActive, promoInactive, activeBudget, hasUnlimitedBudget }>`
  - `merchantsPerBu: Ref<[{ bu_name, count }]>`
  - `promosPerBu: Ref<[{ bu_name, count }]>`
  - `discountTypes: Ref<{ prmPct, prmFixed, plPct, plFixed }>`
  - `recentPromos: Ref<[5 promo rows]>`
  - `recentMerchants: Ref<[5 merchant rows]>`
  - `loading: Ref<boolean>`
  - `loadAll(): Promise<void>`
  - `exportDashboard(): void`

- [ ] **Step 1: Create composable**

```js
import { ref } from 'vue'
import { supabase } from '@/lib/supabase.js'
import { useToast } from '@/lib/composables/useToast.js'
import { exportMultiSheetXlsx } from '@/lib/export-xlsx.js'

export function useQrddDashboard() {
  const toast = useToast()
  const loading = ref(true)

  const stats = ref({
    buCount: 0, buPrimeCount: 0, buPaylaterCount: 0,
    merchantCount: 0, merchantActive: 0, merchantInactive: 0,
    promoCount: 0, promoActive: 0, promoInactive: 0,
    activeBudget: 0, hasUnlimitedBudget: false,
  })

  const merchantsPerBu = ref([])
  const promosPerBu = ref([])
  const discountTypes = ref({ prmPct: 0, prmFixed: 0, plPct: 0, plFixed: 0 })
  const recentPromos = ref([])
  const recentMerchants = ref([])
  const expiringPromos = ref([])

  async function loadAll() {
    loading.value = true
    try {
      // Fetch all data in parallel
      const [
        { data: buAll, error: buErr },
        { data: mwAll, error: mwErr },
        { data: prAll, error: prErr },
        { data: recentPr, error: rpErr },
        { data: recentMw, error: rmErr },
      ] = await Promise.all([
        supabase.from('qrdd_bu_accounts').select('sof'),
        supabase.from('qrdd_merchant_whitelist').select('status'),
        supabase.from('qrdd_promo_rules').select('status,budget_amount,prm_discount_type,pl_discount_type,bu_name'),
        supabase.from('qrdd_promo_rules').select('promo_id,promo_name,start_date,end_date,status').order('created_at', { ascending: false }).limit(5),
        supabase.from('qrdd_merchant_whitelist').select('merchant_id,merchant_name,bu_name,created_at').order('created_at', { ascending: false }).limit(5),
      ])

      if (buErr) throw buErr; if (mwErr) throw mwErr; if (prErr) throw prErr
      if (rpErr) throw rpErr; if (rmErr) throw rmErr

      const bu = buAll || []
      const mw = mwAll || []
      const pr = prAll || []

      // Stats
      stats.value = {
        buCount: bu.length,
        buPrimeCount: bu.filter(r => r.sof === 'PRIME').length,
        buPaylaterCount: bu.filter(r => r.sof === 'PAYLATER').length,
        merchantCount: mw.length,
        merchantActive: mw.filter(r => r.status === 'ACTIVE').length,
        merchantInactive: mw.filter(r => r.status === 'INACTIVE').length,
        promoCount: pr.length,
        promoActive: pr.filter(r => r.status === 'ACTIVE').length,
        promoInactive: pr.filter(r => r.status === 'INACTIVE').length,
        activeBudget: pr.filter(r => r.status === 'ACTIVE' && r.budget_amount != null).reduce((s, r) => s + Number(r.budget_amount), 0),
        hasUnlimitedBudget: pr.some(r => r.status === 'ACTIVE' && r.budget_amount == null),
      }

      // Group by BU — client-side (ponytail: fine for <1000 rows; upgrade to DB view when data grows)
      merchantsPerBu.value = groupBy(mw, 'bu_name')
      promosPerBu.value = groupBy(pr, 'bu_name')

      // Discount type distribution
      discountTypes.value = {
        prmPct: pr.filter(r => r.prm_discount_type === 'PERCENTAGE').length,
        prmFixed: pr.filter(r => r.prm_discount_type === 'FIXED').length,
        plPct: pr.filter(r => r.pl_discount_type === 'PERCENTAGE').length,
        plFixed: pr.filter(r => r.pl_discount_type === 'FIXED').length,
      }

      recentPromos.value = recentPr || []
      recentMerchants.value = recentMw || []

      // Expiring within 30 days
      const now = new Date()
      const d30 = new Date(now.getTime() + 30 * 86400000)
      expiringPromos.value = pr.filter(r => {
        if (r.status !== 'ACTIVE' || !r.end_date) return false
        const ed = new Date(r.end_date)
        return ed >= now && ed <= d30
      })
    } catch (e) {
      toast.error('Failed to load dashboard: ' + e.message)
    } finally {
      loading.value = false
    }
  }

  function groupBy(arr, key) {
    const map = {}
    for (const r of arr) {
      const k = r[key] || '—'
      map[k] = (map[k] || 0) + 1
    }
    return Object.entries(map).map(([bu_name, count]) => ({ bu_name, count }))
  }

  function exportDashboard() {
    const summaryRows = [
      { metric: 'BU Accounts', value: stats.value.buCount, extra: `PRIME: ${stats.value.buPrimeCount} / PAYLATER: ${stats.value.buPaylaterCount}` },
      { metric: 'Merchants', value: stats.value.merchantCount, extra: `Active: ${stats.value.merchantActive} / Inactive: ${stats.value.merchantInactive}` },
      { metric: 'Promo Rules', value: stats.value.promoCount, extra: `Active: ${stats.value.promoActive} / Inactive: ${stats.value.promoInactive}` },
      { metric: 'Active Budget', value: stats.value.hasUnlimitedBudget ? 'Unlimited' : stats.value.activeBudget, extra: '' },
    ]
    const summaryCols = [
      { key: 'metric', label: 'Metric' },
      { key: 'value', label: 'Value' },
      { key: 'extra', label: 'Breakdown' },
    ]
    const buCols = [
      { key: 'bu_name', label: 'BU Name' },
      { key: 'count', label: 'Count' },
    ]
    try {
      exportMultiSheetXlsx([
        { name: 'Summary', rows: summaryRows, columns: summaryCols },
        { name: 'Merchants per BU', rows: merchantsPerBu.value, columns: buCols },
        { name: 'Promos per BU', rows: promosPerBu.value, columns: buCols },
      ], 'qrdd_dashboard')
      toast.success('Dashboard exported')
    } catch (e) {
      toast.error('Export failed: ' + e.message)
    }
  }

  return {
    stats, merchantsPerBu, promosPerBu, discountTypes,
    recentPromos, recentMerchants, expiringPromos,
    loading, loadAll, exportDashboard,
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/modules/qrdd/composables/useQrddDashboard.js
git commit -m "feat(qrdd): add useQrddDashboard composable with aggregations

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 9: Create DashboardTab component

**Files:**
- Create: `src/modules/qrdd/components/DashboardTab.vue`

**Interfaces:**
- Consumes: `useQrddDashboard` composable (called internally)
- Produces: Self-contained dashboard UI with summary cards, CSS charts, recent activity tables, export button

- [ ] **Step 1: Create DashboardTab.vue**

```html
<template>
  <div class="dash-tab">
    <!-- Export -->
    <div class="dash-tab__toolbar">
      <button class="dash-tab__export-btn" @click="dash.exportDashboard()">
        <span class="material-symbols-outlined">file_save</span>
        Export Dashboard
      </button>
    </div>

    <div v-if="dash.loading.value" class="dash-tab__loading">
      <span class="material-symbols-outlined dash-tab__spinner">progress_activity</span>
      Loading dashboard...
    </div>

    <template v-else>
      <!-- Summary Cards -->
      <div class="dash-tab__cards">
        <div class="dash-tab__card">
          <div class="dash-tab__card-icon dash-tab__card-icon--bu">
            <span class="material-symbols-outlined">account_balance</span>
          </div>
          <div class="dash-tab__card-body">
            <div class="dash-tab__card-value">{{ dash.stats.value.buCount }}</div>
            <div class="dash-tab__card-label">BU Accounts</div>
            <div class="dash-tab__card-badges">
              <span class="dash-tab__badge dash-tab__badge--prime">PRIME {{ dash.stats.value.buPrimeCount }}</span>
              <span class="dash-tab__badge dash-tab__badge--paylater">PL {{ dash.stats.value.buPaylaterCount }}</span>
            </div>
          </div>
        </div>

        <div class="dash-tab__card">
          <div class="dash-tab__card-icon dash-tab__card-icon--mw">
            <span class="material-symbols-outlined">store</span>
          </div>
          <div class="dash-tab__card-body">
            <div class="dash-tab__card-value">{{ dash.stats.value.merchantCount }}</div>
            <div class="dash-tab__card-label">Merchants</div>
            <div class="dash-tab__card-badges">
              <span class="dash-tab__badge dash-tab__badge--active">Active {{ dash.stats.value.merchantActive }}</span>
              <span class="dash-tab__badge dash-tab__badge--inactive">Inactive {{ dash.stats.value.merchantInactive }}</span>
            </div>
          </div>
        </div>

        <div class="dash-tab__card">
          <div class="dash-tab__card-icon dash-tab__card-icon--pr">
            <span class="material-symbols-outlined">discount</span>
          </div>
          <div class="dash-tab__card-body">
            <div class="dash-tab__card-value">{{ dash.stats.value.promoCount }}</div>
            <div class="dash-tab__card-label">Promo Rules</div>
            <div class="dash-tab__card-badges">
              <span class="dash-tab__badge dash-tab__badge--active">Active {{ dash.stats.value.promoActive }}</span>
              <span class="dash-tab__badge dash-tab__badge--inactive">Inactive {{ dash.stats.value.promoInactive }}</span>
            </div>
          </div>
        </div>

        <div class="dash-tab__card">
          <div class="dash-tab__card-icon dash-tab__card-icon--budget">
            <span class="material-symbols-outlined">payments</span>
          </div>
          <div class="dash-tab__card-body">
            <div class="dash-tab__card-value">
              <template v-if="dash.stats.value.hasUnlimitedBudget">Unlimited</template>
              <template v-else>{{ fmtNum(dash.stats.value.activeBudget) }}</template>
            </div>
            <div class="dash-tab__card-label">Active Budget</div>
          </div>
        </div>
      </div>

      <!-- Charts Row -->
      <div class="dash-tab__charts">
        <!-- Bar: Merchants per BU -->
        <div class="dash-tab__chart-card">
          <h3 class="dash-tab__chart-title">Merchants per BU</h3>
          <div v-if="dash.merchantsPerBu.value.length" class="dash-tab__bars">
            <div v-for="m in sorted(dash.merchantsPerBu.value)" :key="m.bu_name" class="dash-tab__bar-row">
              <span class="dash-tab__bar-label">{{ m.bu_name }}</span>
              <div class="dash-tab__bar-track">
                <div class="dash-tab__bar-fill" :style="{ width: pct(m.count, maxMerchantCount) }"></div>
              </div>
              <span class="dash-tab__bar-val">{{ m.count }}</span>
            </div>
          </div>
          <div v-else class="dash-tab__empty">No data</div>
        </div>

        <!-- Bar: Promos per BU -->
        <div class="dash-tab__chart-card">
          <h3 class="dash-tab__chart-title">Promos per BU</h3>
          <div v-if="dash.promosPerBu.value.length" class="dash-tab__bars">
            <div v-for="p in sorted(dash.promosPerBu.value)" :key="p.bu_name" class="dash-tab__bar-row">
              <span class="dash-tab__bar-label">{{ p.bu_name }}</span>
              <div class="dash-tab__bar-track">
                <div class="dash-tab__bar-fill dash-tab__bar-fill--pr" :style="{ width: pct(p.count, maxPromoCount) }"></div>
              </div>
              <span class="dash-tab__bar-val">{{ p.count }}</span>
            </div>
          </div>
          <div v-else class="dash-tab__empty">No data</div>
        </div>

        <!-- Donut: Discount Types -->
        <div class="dash-tab__chart-card">
          <h3 class="dash-tab__chart-title">Discount Types</h3>
          <div class="dash-tab__donut-wrap">
            <div class="dash-tab__donut" :style="donutStyle"></div>
            <div class="dash-tab__legend">
              <div class="dash-tab__legend-item"><span class="dash-tab__legend-dot" style="background:#6366F1"></span> PRM % ({{ dash.discountTypes.value.prmPct }})</div>
              <div class="dash-tab__legend-item"><span class="dash-tab__legend-dot" style="background:#8B5CF6"></span> PRM Fixed ({{ dash.discountTypes.value.prmFixed }})</div>
              <div class="dash-tab__legend-item"><span class="dash-tab__legend-dot" style="background:#F59E0B"></span> PL % ({{ dash.discountTypes.value.plPct }})</div>
              <div class="dash-tab__legend-item"><span class="dash-tab__legend-dot" style="background:#EF4444"></span> PL Fixed ({{ dash.discountTypes.value.plFixed }})</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Recent Activity -->
      <div class="dash-tab__recent">
        <div class="dash-tab__recent-card">
          <h3 class="dash-tab__chart-title">Recent Promos</h3>
          <table v-if="dash.recentPromos.value.length" class="dash-tab__mini-table">
            <thead><tr><th>Promo ID</th><th>Name</th><th>Period</th><th>Status</th></tr></thead>
            <tbody>
              <tr v-for="p in dash.recentPromos.value" :key="p.promo_id">
                <td class="dash-tab__code">{{ p.promo_id }}</td>
                <td>{{ p.promo_name }}</td>
                <td class="dash-tab__date">{{ p.start_date }} – {{ p.end_date }}</td>
                <td><span class="dash-tab__status" :class="'dash-tab__status--' + (p.status || '').toLowerCase()">{{ p.status }}</span></td>
              </tr>
            </tbody>
          </table>
          <div v-else class="dash-tab__empty">No promos yet</div>
        </div>

        <div class="dash-tab__recent-card">
          <h3 class="dash-tab__chart-title">Recent Merchants</h3>
          <table v-if="dash.recentMerchants.value.length" class="dash-tab__mini-table">
            <thead><tr><th>ID</th><th>Name</th><th>BU</th><th>Added</th></tr></thead>
            <tbody>
              <tr v-for="m in dash.recentMerchants.value" :key="m.merchant_id">
                <td class="dash-tab__code">{{ m.merchant_id }}</td>
                <td>{{ m.merchant_name }}</td>
                <td>{{ m.bu_name }}</td>
                <td class="dash-tab__date">{{ fmtDate(m.created_at) }}</td>
              </tr>
            </tbody>
          </table>
          <div v-else class="dash-tab__empty">No merchants yet</div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed, onMounted } from 'vue'
import { useQrddDashboard } from '../composables/useQrddDashboard.js'

const dash = useQrddDashboard()

const maxMerchantCount = computed(() =>
  Math.max(1, ...dash.merchantsPerBu.value.map(m => m.count))
)
const maxPromoCount = computed(() =>
  Math.max(1, ...dash.promosPerBu.value.map(p => p.count))
)

const donutStyle = computed(() => {
  const dt = dash.discountTypes.value
  const total = dt.prmPct + dt.prmFixed + dt.plPct + dt.plFixed || 1
  const p1 = (dt.prmPct / total) * 100
  const p2 = (dt.prmFixed / total) * 100
  const p3 = (dt.plPct / total) * 100
  const p4 = (dt.plFixed / total) * 100
  return {
    background: `conic-gradient(#6366F1 0% ${p1}%, #8B5CF6 ${p1}% ${p1 + p2}%, #F59E0B ${p1 + p2}% ${p1 + p2 + p3}%, #EF4444 ${p1 + p2 + p3}% 100%)`,
  }
})

function sorted(arr) { return [...arr].sort((a, b) => b.count - a.count) }
function pct(v, max) { return (v / max * 100) + '%' }
function fmtNum(v) { return Number(v).toLocaleString() }
function fmtDate(d) { return d ? new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '—' }

onMounted(() => dash.loadAll())
</script>

<style scoped>
.dash-tab { display: flex; flex-direction: column; gap: 20px; animation: dash-in 0.4s ease-out both; }
@keyframes dash-in { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }

.dash-tab__toolbar { display: flex; justify-content: flex-end; }
.dash-tab__export-btn {
  display: flex; align-items: center; gap: 6px;
  padding: 8px 16px;
  background: transparent; color: var(--color-gray-600, #666);
  border: 1px solid rgba(0,0,0,0.1); border-radius: var(--radius-pill, 999px);
  font-weight: 600; font-size: 13px; font-family: var(--font-body, 'Inter', sans-serif);
  cursor: pointer; transition: all 200ms;
}
.dash-tab__export-btn:hover { background: rgba(0,0,0,0.04); border-color: rgba(0,0,0,0.2); }
.dash-tab__export-btn .material-symbols-outlined { font-size: 18px; }

.dash-tab__loading { display: flex; align-items: center; gap: 8px; justify-content: center; padding: 48px; color: var(--color-gray-400); font-size: 14px; }
.dash-tab__spinner { animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

/* Cards */
.dash-tab__cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; }
.dash-tab__card {
  display: flex; gap: 14px; padding: 20px;
  background: rgba(255,255,255,0.7); backdrop-filter: blur(8px);
  border: 1px solid rgba(0,0,0,0.06); border-radius: var(--radius-md, 16px);
  box-shadow: var(--shadow-sm, 0 2px 8px rgba(0,0,0,0.04));
}
.dash-tab__card-icon {
  width: 44px; height: 44px; display: flex; align-items: center; justify-content: center;
  border-radius: var(--radius-sm, 12px); flex-shrink: 0;
}
.dash-tab__card-icon .material-symbols-outlined { font-size: 22px; color: #fff; }
.dash-tab__card-icon--bu { background: linear-gradient(135deg, #6366F1, #8B5CF6); }
.dash-tab__card-icon--mw { background: linear-gradient(135deg, #10B981, #34D399); }
.dash-tab__card-icon--pr { background: linear-gradient(135deg, #F59E0B, #FBBF24); }
.dash-tab__card-icon--budget { background: linear-gradient(135deg, #EF4444, #F87171); }
.dash-tab__card-body { display: flex; flex-direction: column; gap: 2px; }
.dash-tab__card-value { font-size: 24px; font-weight: 800; color: var(--color-on-surface, #333); letter-spacing: -0.5px; }
.dash-tab__card-label { font-size: 12px; color: var(--color-gray-400); font-weight: 600; text-transform: uppercase; }
.dash-tab__card-badges { display: flex; gap: 6px; margin-top: 4px; }
.dash-tab__badge { font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 999px; }
.dash-tab__badge--prime { background: #E6E6FF; color: #0047B2; }
.dash-tab__badge--paylater { background: #FFF3D6; color: #CC7000; }
.dash-tab__badge--active { background: #E6F4EA; color: #137333; }
.dash-tab__badge--inactive { background: #F1F3F4; color: #5F6368; }

/* Charts */
.dash-tab__charts { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; }
.dash-tab__chart-card {
  padding: 16px;
  background: rgba(255,255,255,0.7); backdrop-filter: blur(8px);
  border: 1px solid rgba(0,0,0,0.06); border-radius: var(--radius-md, 16px);
}
.dash-tab__chart-title { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: var(--color-gray-400); margin: 0 0 12px; }
.dash-tab__bars { display: flex; flex-direction: column; gap: 8px; }
.dash-tab__bar-row { display: flex; align-items: center; gap: 8px; }
.dash-tab__bar-label { width: 80px; font-size: 11px; font-weight: 600; color: var(--color-gray-600); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex-shrink: 0; }
.dash-tab__bar-track { flex: 1; height: 8px; background: rgba(0,0,0,0.06); border-radius: 4px; overflow: hidden; }
.dash-tab__bar-fill { height: 100%; background: #6366F1; border-radius: 4px; transition: width 0.6s ease-out; }
.dash-tab__bar-fill--pr { background: #F59E0B; }
.dash-tab__bar-val { width: 32px; text-align: right; font-size: 11px; font-weight: 700; color: var(--color-gray-700); }
.dash-tab__empty { color: var(--color-gray-400); font-size: 12px; text-align: center; padding: 24px; }

/* Donut */
.dash-tab__donut-wrap { display: flex; align-items: center; gap: 16px; justify-content: center; flex-wrap: wrap; }
.dash-tab__donut { width: 80px; height: 80px; border-radius: 50%; position: relative; }
.dash-tab__donut::after {
  content: ''; position: absolute; inset: 16px; border-radius: 50%; background: #fff;
}
.dash-tab__legend { font-size: 10px; display: flex; flex-direction: column; gap: 4px; }
.dash-tab__legend-item { display: flex; align-items: center; gap: 6px; color: var(--color-gray-600); font-weight: 600; }
.dash-tab__legend-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }

/* Recent */
.dash-tab__recent { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.dash-tab__recent-card {
  padding: 16px;
  background: rgba(255,255,255,0.7); backdrop-filter: blur(8px);
  border: 1px solid rgba(0,0,0,0.06); border-radius: var(--radius-md, 16px);
}
.dash-tab__mini-table { width: 100%; border-collapse: collapse; font-size: 12px; }
.dash-tab__mini-table th { text-align: left; font-size: 10px; font-weight: 700; text-transform: uppercase; color: var(--color-gray-400); padding: 4px 6px; border-bottom: 1px solid rgba(0,0,0,0.06); }
.dash-tab__mini-table td { padding: 4px 6px; color: var(--color-gray-700); }
.dash-tab__code { font-family: 'SF Mono','Fira Code',monospace; font-size: 11px; color: var(--color-gray-600); }
.dash-tab__date { font-size: 11px; color: var(--color-gray-400); }
.dash-tab__status { display: inline-block; padding: 1px 6px; border-radius: 999px; font-size: 10px; font-weight: 700; }
.dash-tab__status--active { background: #E6F4EA; color: #137333; }
.dash-tab__status--inactive { background: #F1F3F4; color: #5F6368; }

@media (max-width: 768px) {
  .dash-tab__charts { grid-template-columns: 1fr; }
  .dash-tab__recent { grid-template-columns: 1fr; }
  .dash-tab__cards { grid-template-columns: 1fr 1fr; }
}
@media (max-width: 480px) {
  .dash-tab__cards { grid-template-columns: 1fr; }
}
</style>
```

- [ ] **Step 2: Commit**

```bash
git add src/modules/qrdd/components/DashboardTab.vue
git commit -m "feat(qrdd): add DashboardTab with summary cards, CSS charts, and recent activity

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 10: Migrate QrddView to pill tabs + add Dashboard + wire export

**Files:**
- Modify: `src/modules/qrdd/views/QrddView.vue`

**Interfaces:**
- Replaces `LiTabs` with custom pill tab nav (QRIS pattern)
- Adds 4th Dashboard tab
- Wires `@export` events from each tab to composable export functions
- Adds BuAccountForm, MerchantForm, PromoRuleForm modals (existing pattern, now at view level)

- [ ] **Step 1: Rewrite QrddView.vue — full replacement**

This is a large rewrite. The file changes from `LiTabs` to pill tabs, adds a 4th dashboard tab, wires export, and moves form modals to the view level.

Replace the entire `QrddView.vue` content:

```html
<template>
  <div class="qrdd">
    <!-- Header -->
    <header class="qrdd__header">
      <div class="qrdd__header-content">
        <div class="qrdd__title-group">
          <div class="qrdd__icon-badge">
            <span class="material-symbols-outlined">database</span>
          </div>
          <div>
            <h1 class="qrdd__title">QR DD</h1>
            <p class="qrdd__subtitle">Manage BU accounts, merchant whitelist, and promo rules</p>
          </div>
        </div>
      </div>
    </header>

    <!-- Pill Tabs -->
    <nav class="qrdd__tabs-wrapper">
      <div class="qrdd__tabs">
        <button
          v-for="(tab, index) in visibleTabs"
          :key="tab.id"
          class="qrdd__tab"
          :class="{ 'qrdd__tab--active': activeTab === tab.id }"
          @click="switchTab(tab.id, index)"
        >
          <span class="material-symbols-outlined qrdd__tab-icon">{{ tab.icon }}</span>
          <span class="qrdd__tab-label">{{ tab.label }}</span>
          <span class="qrdd__tab-desc">{{ tab.desc }}</span>
        </button>
        <div class="qrdd__tab-indicator" :style="indicatorStyle" />
      </div>
    </nav>

    <!-- Tab Content -->
    <Transition name="panel-slide" mode="out-in">
      <div :key="activeTab" class="qrdd__panel-wrap">
        <BuAccountsTab
          v-if="activeTab === 'bu-accounts' && can('bu-accounts.read')"
          key="bu"
          :items="buAccounts.paginatedItems.value"
          :loading="buAccounts.loading.value"
          :searchQuery="buAccounts.searchQuery.value"
          :currentPage="buAccounts.currentPage.value"
          :totalPages="buAccounts.totalPages.value"
          :canCreate="can('bu-accounts.create')"
          :canUpdate="can('bu-accounts.update')"
          :canDelete="can('bu-accounts.delete')"
          @update:searchQuery="buAccounts.searchQuery.value = $event"
          @update:currentPage="buAccounts.currentPage.value = $event"
          @add="onAddBuAccount"
          @edit="onEditBuAccount"
          @delete="onDeleteBuAccount"
          @export="buAccounts.exportFiltered()"
        />

        <MerchantWhitelistTab
          v-else-if="activeTab === 'merchant-whitelist' && can('merchant-whitelist.read')"
          key="mw"
          :items="mw.paginatedItems.value"
          :loading="mw.loading.value"
          :searchQuery="mw.searchQuery.value"
          :currentPage="mw.currentPage.value"
          :totalPages="mw.totalPages.value"
          :buNameOptions="buAccounts.nameOptions.value"
          :canCreate="can('merchant-whitelist.create')"
          :canUpdate="can('merchant-whitelist.update')"
          :canDelete="can('merchant-whitelist.delete')"
          @update:searchQuery="mw.searchQuery.value = $event"
          @update:currentPage="mw.currentPage.value = $event"
          @add="onAddMerchant"
          @edit="onEditMerchant"
          @delete="onDeleteMerchant"
          @export="mw.exportFiltered()"
        />

        <PromoRuleTab
          v-else-if="activeTab === 'promo-rule' && can('promo-rule.read')"
          key="pr"
          :items="pr.paginatedItems.value"
          :loading="pr.loading.value"
          :searchQuery="pr.searchQuery.value"
          :searchColumn="pr.searchColumn.value"
          :currentPage="pr.currentPage.value"
          :totalPages="pr.totalPages.value"
          :merchantOptions="merchantOptions"
          :buNameOptions="buAccounts.nameOptions.value"
          :canCreate="can('promo-rule.create')"
          :canUpdate="can('promo-rule.update')"
          :canDelete="can('promo-rule.delete')"
          @update:searchQuery="pr.searchQuery.value = $event"
          @update:searchColumn="pr.searchColumn.value = $event"
          @update:currentPage="pr.currentPage.value = $event"
          @add="onAddPromo"
          @edit="onEditPromo"
          @delete="onDeletePromo"
          @export="pr.exportFiltered()"
        />

        <DashboardTab v-else-if="activeTab === 'dashboard'" key="dash" />
      </div>
    </Transition>

    <!-- BU Account Form Modal -->
    <BuAccountForm
      v-if="showBuForm"
      :editing="editingBu"
      @save="onSaveBuAccount"
      @close="closeBuForm"
    />

    <!-- Merchant Form Modal -->
    <MerchantForm
      v-if="showMwForm"
      :editing="editingMw"
      :buNameOptions="buAccounts.nameOptions.value"
      @save="onSaveMerchant"
      @close="closeMwForm"
    />

    <!-- Promo Rule Form Modal -->
    <PromoRuleForm
      v-if="showPrForm"
      :editing="editingPr"
      :merchantOptions="merchantOptions"
      :buNameOptions="buAccounts.nameOptions.value"
      @save="onSavePromo"
      @close="closePrForm"
    />

    <!-- Delete Confirm Modal -->
    <LiModal
      v-if="deleteTarget"
      :modelValue="true"
      title="Confirm Delete"
      size="sm"
      @update:modelValue="deleteTarget = null"
    >
      <p class="qrdd__delete-text">
        Are you sure you want to delete <strong>{{ deleteTarget.label }}</strong>?
        This action cannot be undone.
      </p>
      <template #footer>
        <button class="qrdd__btn qrdd__btn--cancel" @click="deleteTarget = null">Cancel</button>
        <button class="qrdd__btn qrdd__btn--danger" @click="confirmDelete">
          <span class="material-symbols-outlined">delete</span>
          Delete
        </button>
      </template>
    </LiModal>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { useAccess } from '@/composables/useAccess.js'
import { useBuAccounts } from '../composables/useBuAccounts.js'
import { useMerchantWhitelist } from '../composables/useMerchantWhitelist.js'
import { usePromoRule } from '../composables/usePromoRule.js'
import BuAccountsTab from '../components/BuAccountsTab.vue'
import BuAccountForm from '../components/BuAccountForm.vue'
import MerchantWhitelistTab from '../components/MerchantWhitelistTab.vue'
import MerchantForm from '../components/MerchantForm.vue'
import PromoRuleTab from '../components/PromoRuleTab.vue'
import PromoRuleForm from '../components/PromoRuleForm.vue'
import DashboardTab from '../components/DashboardTab.vue'
import LiModal from '@lib/components/LiModal.vue'

const { canFeature } = useAccess()
const buAccounts = useBuAccounts()
const mw = useMerchantWhitelist()
const pr = usePromoRule()

function can(feature) { return canFeature('qrdd', feature) }

// ── Pill Tabs ──

const allTabDefs = [
  { id: 'bu-accounts', label: 'BU Accounts', desc: 'Manage accounts', icon: 'account_balance', gate: 'bu-accounts.read' },
  { id: 'merchant-whitelist', label: 'Merchants', desc: 'Whitelist management', icon: 'store', gate: 'merchant-whitelist.read' },
  { id: 'promo-rule', label: 'Promo Rules', desc: 'Discount rules', icon: 'discount', gate: 'promo-rule.read' },
  { id: 'dashboard', label: 'Dashboard', desc: 'Reports & stats', icon: 'monitoring', gate: null },
]

const visibleTabs = computed(() =>
  allTabDefs.filter(t => !t.gate || can(t.gate))
)

const activeTab = ref(visibleTabs.value[0]?.id)
const indicatorStyle = ref({})

watch(visibleTabs, (list) => {
  if (list.length && !list.find(t => t.id === activeTab.value)) {
    activeTab.value = list[0].id
  }
})

function switchTab(id, index) {
  activeTab.value = id
  nextTick(() => updateIndicator(index))
}

function updateIndicator(targetIndex) {
  const idx = targetIndex ?? visibleTabs.value.findIndex(t => t.id === activeTab.value)
  const tabEl = document.querySelectorAll('.qrdd__tab')[idx]
  if (tabEl) {
    indicatorStyle.value = {
      left: `${tabEl.offsetLeft}px`,
      width: `${tabEl.offsetWidth}px`,
    }
  }
}

// ── Form modals ──

const showBuForm = ref(false)
const editingBu = ref(null)
const showMwForm = ref(false)
const editingMw = ref(null)
const showPrForm = ref(false)
const editingPr = ref(null)

const deleteTarget = ref(null)

const merchantOptions = computed(() =>
  mw.items.value.map(r => ({
    label: `${r.merchant_id} — ${r.merchant_name}`,
    value: r.merchant_id,
  })),
)

// ── Handlers ──

function onAddBuAccount() { editingBu.value = null; showBuForm.value = true }
function onEditBuAccount(row) { editingBu.value = row; showBuForm.value = true }
function onDeleteBuAccount(row) { deleteTarget.value = { type: 'bu', id: row.id, label: row.name } }

function onAddMerchant() { editingMw.value = null; showMwForm.value = true }
function onEditMerchant(row) { editingMw.value = row; showMwForm.value = true }
function onDeleteMerchant(row) { deleteTarget.value = { type: 'mw', id: row.id, label: row.merchant_id } }

function onAddPromo() { editingPr.value = null; showPrForm.value = true }
function onEditPromo(row) { editingPr.value = row; showPrForm.value = true }
function onDeletePromo(row) { deleteTarget.value = { type: 'pr', id: row.promo_id, label: row.promo_id } }

function closeBuForm() { showBuForm.value = false; editingBu.value = null }
function closeMwForm() { showMwForm.value = false; editingMw.value = null }
function closePrForm() { showPrForm.value = false; editingPr.value = null }

async function onSaveBuAccount(formData) {
  const ok = editingBu.value
    ? await buAccounts.updateItem(editingBu.value.id, formData)
    : await buAccounts.createItem(formData)
  if (ok) closeBuForm()
}

async function onSaveMerchant(formData) {
  const ok = editingMw.value
    ? await mw.updateItem(editingMw.value.id, formData)
    : await mw.createItem(formData)
  if (ok) closeMwForm()
}

async function onSavePromo(formData) {
  const ok = editingPr.value
    ? await pr.updateItem(editingPr.value.promo_id, formData)
    : await pr.createItem(formData)
  if (ok) closePrForm()
}

async function confirmDelete() {
  const t = deleteTarget.value
  deleteTarget.value = null
  if (!t) return
  if (t.type === 'bu') await buAccounts.deleteItem(t.id, t.label)
  else if (t.type === 'mw') await mw.deleteItem(t.id, t.label)
  else if (t.type === 'pr') await pr.deleteItem(t.id)
}

// ── Init ──

onMounted(() => {
  buAccounts.loadItems()
  mw.loadItems()
  pr.loadItems()
  nextTick(() => updateIndicator())
  window.addEventListener('resize', () => nextTick(() => updateIndicator()))
})

onUnmounted(() => {
  window.removeEventListener('resize', () => nextTick(() => updateIndicator()))
})
</script>

<style scoped>
.qrdd {
  max-width: 1280px;
  margin: 0 auto;
  padding: var(--space-lg, 24px) var(--space-xl, 32px);
  display: flex;
  flex-direction: column;
  gap: var(--space-lg, 24px);
}

.qrdd__header-content { display: flex; justify-content: space-between; align-items: center; }
.qrdd__title-group { display: flex; align-items: center; gap: var(--space-l, 16px); }
.qrdd__icon-badge {
  width: 48px; height: 48px;
  display: flex; align-items: center; justify-content: center;
  background: linear-gradient(135deg, #6366F1, #8B5CF6);
  border-radius: var(--radius-sm, 12px);
  box-shadow: 0 4px 16px rgba(99, 102, 241, 0.3);
}
.qrdd__icon-badge .material-symbols-outlined { font-size: 26px; color: #fff; }
.qrdd__title { font-size: 26px; font-weight: 800; margin: 0; letter-spacing: -0.5px; }
.qrdd__subtitle { font-size: 14px; color: var(--color-gray-500, #8e8ea0); margin: 2px 0 0; }

/* Pill Tabs */
.qrdd__tabs-wrapper { }
.qrdd__tabs {
  display: flex; position: relative;
  background: rgba(255,255,255,0.5); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(0,0,0,0.06); border-radius: var(--radius-md, 16px);
  padding: 5px; gap: 2px;
}
.qrdd__tab {
  flex: 1; display: flex; flex-direction: column; align-items: center; gap: 2px;
  padding: 14px 12px; border: none; border-radius: var(--radius-sm, 12px);
  background: transparent; cursor: pointer;
  font-family: var(--font-body, 'Inter', sans-serif);
  transition: all 300ms ease-out;
  position: relative; z-index: 1;
}
.qrdd__tab:hover { background: rgba(255,255,255,0.5); }
.qrdd__tab--active { color: var(--color-on-surface, #1a1a2e); }
.qrdd__tab-icon { font-size: 22px; color: var(--color-gray-500, #8e8ea0); transition: color 300ms ease-out, transform 300ms cubic-bezier(0.34, 1.56, 0.64, 1); }
.qrdd__tab--active .qrdd__tab-icon { color: #6366F1; transform: scale(1.1); }
.qrdd__tab-label { font-size: 13px; font-weight: 600; color: var(--color-gray-700, #555); transition: color 300ms ease-out; }
.qrdd__tab--active .qrdd__tab-label { color: var(--color-on-surface, #1a1a2e); }
.qrdd__tab-desc { font-size: 11px; color: var(--color-gray-400, #aaa); font-weight: 400; transition: color 300ms ease-out; }
.qrdd__tab--active .qrdd__tab-desc { color: var(--color-gray-500, #8e8ea0); }
.qrdd__tab-indicator {
  position: absolute; top: 5px; height: calc(100% - 10px);
  background: #fff; border-radius: var(--radius-sm, 12px);
  box-shadow: 0 2px 8px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.02);
  transition: all 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
  z-index: 0;
}

/* Delete */
.qrdd__delete-text { font-size: 14px; color: var(--color-gray-700, #666); line-height: 1.6; margin: 0; }
.qrdd__btn {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 8px 18px; border: 1px solid transparent;
  border-radius: var(--radius-pill, 999px);
  font-family: var(--font-body, 'Inter', sans-serif);
  font-size: 13px; font-weight: 600; cursor: pointer; transition: all 200ms;
}
.qrdd__btn--cancel { color: var(--color-gray-700, #666); border-color: rgba(0,0,0,0.1); background: transparent; }
.qrdd__btn--cancel:hover { background: rgba(0,0,0,0.04); }
.qrdd__btn--danger { color: #fff; background: var(--color-red-400, #C83E3B); border-color: var(--color-red-400, #C83E3B); }
.qrdd__btn--danger:hover { opacity: 0.9; }

.panel-slide-enter-active { transition: all 0.35s cubic-bezier(0.16, 1, 0.3, 1); }
.panel-slide-leave-active { transition: all 0.2s ease-in; }
.panel-slide-enter-from { opacity: 0; transform: translateY(12px); }
.panel-slide-leave-to { opacity: 0; transform: translateY(-8px); }

@media (max-width: 768px) {
  .qrdd { padding: var(--space-md, 16px); gap: var(--space-md, 16px); }
  .qrdd__title { font-size: 20px; }
  .qrdd__icon-badge { width: 40px; height: 40px; }
  .qrdd__icon-badge .material-symbols-outlined { font-size: 22px; }
  .qrdd__tab { padding: 10px 8px; min-width: 0; flex-shrink: 0; }
  .qrdd__tab-desc { display: none; }
}
@media (max-width: 480px) {
  .qrdd__icon-badge { display: none; }
  .qrdd__tab-label { font-size: 12px; }
  .qrdd__tab-icon { font-size: 18px; }
}
@media (prefers-reduced-motion: reduce) {
  .qrdd__tab-indicator { transition: none; }
  .qrdd__tab-icon { transition: none; }
  .panel-slide-enter-active, .panel-slide-leave-active { transition-duration: 0.01ms; }
}
</style>
```

- [ ] **Step 2: Commit**

```bash
git add src/modules/qrdd/views/QrddView.vue
git commit -m "feat(qrdd): migrate QrddView to pill tabs, add Dashboard tab, wire export

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 11: Migrate AdminView to pill tabs

**Files:**
- Modify: `src/modules/admin/views/AdminView.vue`

**Interfaces:**
- Replaces `LiTabs` with same custom pill tab nav pattern
- No structural logic changes — only visual tab replacement

- [ ] **Step 1: Replace LiTabs with pill tabs in AdminView.vue**

Remove the `<LiTabs>` import and usage. Replace the tabs section (lines 33-34 in original: `<LiTabs v-model="activeTab" :tabs="tabDefs" />`) with:

```html
<!-- Pill Tabs -->
<nav class="admin__tabs-wrapper">
  <div class="admin__tabs">
    <button
      v-for="(tab, index) in tabDefs"
      :key="tab.id"
      class="admin__tab"
      :class="{ 'admin__tab--active': activeTab === index }"
      @click="switchTab(index)"
    >
      <span class="material-symbols-outlined admin__tab-icon">{{ tab.icon }}</span>
      <span class="admin__tab-label">{{ tab.label }}</span>
    </button>
    <div class="admin__tab-indicator" :style="indicatorStyle" />
  </div>
</nav>
```

In `<script setup>`, remove the `LiTabs` import and add:

```js
import { ref, onMounted, onUnmounted, nextTick } from 'vue'
// Remove: import LiTabs from '@lib/components/LiTabs.vue'

const indicatorStyle = ref({})

function switchTab(index) {
  activeTab.value = index
  nextTick(() => updateIndicator())
}

function updateIndicator() {
  const tabEl = document.querySelectorAll('.admin__tab')[activeTab.value]
  if (tabEl) {
    indicatorStyle.value = {
      left: `${tabEl.offsetLeft}px`,
      width: `${tabEl.offsetWidth}px`,
    }
  }
}

// Add to onMounted:
nextTick(() => updateIndicator())
window.addEventListener('resize', () => nextTick(() => updateIndicator()))

// Add to onUnmounted (can append to existing or add new):
// window.removeEventListener(...)
```

Update `tabDefs` to include `id` and `desc`:

```js
const tabDefs = [
  { id: 'users', label: 'Users', desc: 'Manage users', icon: 'group' },
  { id: 'roles', label: 'Roles', desc: 'Role management', icon: 'shield_person' },
  { id: 'modules', label: 'Modules', desc: 'Module access', icon: 'apps' },
]
```

Add pill tab CSS (copy pattern from Task 10, replace `qrdd` prefix with `admin`):

```css
/* Pill Tabs */
.admin__tabs-wrapper { }
.admin__tabs {
  display: flex; position: relative;
  background: rgba(255,255,255,0.5); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(0,0,0,0.06); border-radius: var(--radius-md, 16px);
  padding: 5px; gap: 2px;
}
.admin__tab {
  flex: 1; display: flex; flex-direction: column; align-items: center; gap: 2px;
  padding: 14px 12px; border: none; border-radius: var(--radius-sm, 12px);
  background: transparent; cursor: pointer;
  font-family: var(--font-body, 'Inter', sans-serif);
  transition: all 300ms ease-out;
  position: relative; z-index: 1;
}
.admin__tab:hover { background: rgba(255,255,255,0.5); }
.admin__tab--active { color: var(--color-on-surface, #1a1a2e); }
.admin__tab-icon { font-size: 22px; color: var(--color-gray-500, #8e8ea0); transition: color 300ms ease-out, transform 300ms cubic-bezier(0.34, 1.56, 0.64, 1); }
.admin__tab--active .admin__tab-icon { color: var(--cta-primary-bg, #FFBC25); transform: scale(1.1); }
.admin__tab-label { font-size: 13px; font-weight: 600; color: var(--color-gray-700, #555); transition: color 300ms ease-out; }
.admin__tab--active .admin__tab-label { color: var(--color-on-surface, #1a1a2e); }
.admin__tab-indicator {
  position: absolute; top: 5px; height: calc(100% - 10px);
  background: #fff; border-radius: var(--radius-sm, 12px);
  box-shadow: 0 2px 8px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.02);
  transition: all 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
  z-index: 0;
}
@media (max-width: 768px) {
  .admin__tab { padding: 10px 8px; min-width: 0; flex-shrink: 0; }
}
@media (max-width: 480px) {
  .admin__tab-label { font-size: 12px; }
  .admin__tab-icon { font-size: 18px; }
}
@media (prefers-reduced-motion: reduce) {
  .admin__tab-indicator { transition: none; }
  .admin__tab-icon { transition: none; }
}
```

ponytail: Admin tabs don't have descriptions so `desc` field is in tabDefs but not rendered. Add when admin tabs need descriptions.

- [ ] **Step 2: Commit**

```bash
git add src/modules/admin/views/AdminView.vue
git commit -m "feat(admin): migrate AdminView from LiTabs to pill tabs

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 12: Add QR DD summary to DashboardView (homepage)

**Files:**
- Modify: `src/modules/dashboard/views/DashboardView.vue`

**Interfaces:**
- Consumes: `useQrddDashboard` composable
- New section between tools grid and empty state: QR DD summary cards

- [ ] **Step 1: Add QR DD summary section**

Add between the tools `<section>` and the empty `<div>` in the template:

```html
<!-- QR DD Summary -->
<section v-if="showQrddSummary" class="dash__section">
  <h2 class="dash__section-title">QR DD Summary</h2>
  <div class="dash__summary-grid">
    <div class="dash__summary-card">
      <span class="dash__summary-num">{{ qrddStats.buCount }}</span>
      <span class="dash__summary-label">BU Accounts</span>
    </div>
    <div class="dash__summary-card">
      <span class="dash__summary-num">{{ qrddStats.merchantActive }}</span>
      <span class="dash__summary-label">Active Merchants</span>
    </div>
    <div class="dash__summary-card">
      <span class="dash__summary-num">{{ qrddStats.promoActive }}</span>
      <span class="dash__summary-label">Active Promos</span>
    </div>
    <div class="dash__summary-card">
      <span class="dash__summary-num">{{ qrddStats.expiringCount }}</span>
      <span class="dash__summary-label">Expiring ≤30 days</span>
    </div>
  </div>
</section>
```

In `<script setup>`, add:

```js
import { ref, computed, onMounted } from 'vue'
import { useQrddDashboard } from '@/modules/qrdd/composables/useQrddDashboard.js'

const { canModule } = useAccess()
const qrddDash = useQrddDashboard()

const showQrddSummary = computed(() => canModule('qrdd'))

const qrddStats = computed(() => ({
  buCount: qrddDash.stats.value.buCount,
  merchantActive: qrddDash.stats.value.merchantActive,
  promoActive: qrddDash.stats.value.promoActive,
  expiringCount: qrddDash.expiringPromos.value.length,
}))

onMounted(() => {
  if (canModule('qrdd')) {
    qrddDash.loadAll()
  }
})
```

Add styles for the summary section:

```css
.dash__summary-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: var(--space-m, 12px);
}
.dash__summary-card {
  display: flex; flex-direction: column; align-items: center; gap: 4px;
  padding: var(--space-l, 16px);
  background: rgba(255,255,255,0.55);
  backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px);
  border: 1px solid rgba(99,102,241,0.1);
  border-radius: var(--radius-md, 16px);
  transition: all 200ms;
}
.dash__summary-card:hover {
  border-color: rgba(99,102,241,0.3);
  box-shadow: 0 4px 16px rgba(99,102,241,0.08);
  transform: translateY(-2px);
}
.dash__summary-num {
  font-size: 28px; font-weight: 800; color: #6366F1;
  letter-spacing: -0.5px; font-family: var(--font-display, 'Inter', sans-serif);
}
.dash__summary-label {
  font-size: 11px; font-weight: 600; color: var(--color-gray-500, #8e8ea0);
  text-transform: uppercase; text-align: center;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/modules/dashboard/views/DashboardView.vue
git commit -m "feat(dashboard): add QR DD summary cards to DashboardView homepage

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 13: Final verification — build check

- [ ] **Step 1: Run npm install + build**

```bash
npm install && npm run build
```

Expected: build succeeds with no errors. Fix any import mismatches.

- [ ] **Step 2: Commit any fixes**

```bash
git add -A
git commit -m "chore: build fixes after QR DD enhancements

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```
