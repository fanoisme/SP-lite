# QR DD Module — Full CRUD Admin Panel + Dashboard + Export

2026-07-03

## Scope

New top-level module "QR DD" with 4 tabs: BU Accounts, Merchant Whitelist, Promo Rule, Dashboard.
All tables in `public` schema with RLS (authenticated = full access, shared across all users).
Full CRUD (create, read, update, delete) on first 3 tabs. Hard delete.
Dashboard tab + homepage summary cards for aggregate stats.
XLSX export on every feature (3 CRUD tabs + Dashboard).
Pill tab migration: QR DD & Admin tabs restyled to match QRIS animated pill pattern.

---

## 1. Module Registration

**File:** `src/lib/modules.js`
Add to `MODULE_REGISTRY`:
```js
{ id: 'qrdd', label: 'QR DD', icon: 'database', path: '/qrdd',
  desc: 'Manage BU accounts, merchant whitelist, and promo rules.',
  features: [
    { id: 'bu-accounts.read',     label: 'BU Accounts — Read',   desc: 'View BU account list.' },
    { id: 'bu-accounts.create',   label: 'BU Accounts — Create', desc: 'Add new BU accounts.' },
    { id: 'bu-accounts.update',   label: 'BU Accounts — Update', desc: 'Edit existing BU accounts.' },
    { id: 'bu-accounts.delete',   label: 'BU Accounts — Delete', desc: 'Delete BU accounts.' },
    { id: 'merchant-whitelist.read',   label: 'Merchant Whitelist — Read',   desc: 'View merchant whitelist.' },
    { id: 'merchant-whitelist.create', label: 'Merchant Whitelist — Create', desc: 'Add new merchants.' },
    { id: 'merchant-whitelist.update', label: 'Merchant Whitelist — Update', desc: 'Edit existing merchants.' },
    { id: 'merchant-whitelist.delete', label: 'Merchant Whitelist — Delete', desc: 'Delete merchants.' },
    { id: 'promo-rule.read',   label: 'Promo Rule — Read',   desc: 'View promo rules.' },
    { id: 'promo-rule.create', label: 'Promo Rule — Create', desc: 'Add new promo rules.' },
    { id: 'promo-rule.update', label: 'Promo Rule — Update', desc: 'Edit existing promo rules.' },
    { id: 'promo-rule.delete', label: 'Promo Rule — Delete', desc: 'Delete promo rules.' },
  ],
},
```

**Router:** `src/router/index.js`
```js
{ path: '/qrdd', name: 'qrdd', meta: { module: 'qrdd', label: 'QR DD', icon: 'database' },
  component: () => import('../modules/qrdd/views/QrddView.vue') },
```

Sidebar auto-discovers — no manual change needed.

---

## 2. Database

### 2a. `qrdd_bu_accounts`

| Column | Type | Constraint |
|--------|------|------------|
| id | uuid PK | default gen_random_uuid() |
| name | text NOT NULL UNIQUE | |
| sof | text NOT NULL | CHECK (sof IN ('PRIME', 'PAYLATER')) |
| account1 | text NOT NULL | Expense a/c number |
| acctname1 | text NOT NULL | Expense a/c name |
| percentage1 | numeric(5,4) NOT NULL | 0.5000 |
| account2 | text NOT NULL | Receivable a/c number |
| acctname2 | text NOT NULL | Receivable a/c name |
| percentage2 | numeric(5,4) NOT NULL | 0.5000 |
| created_at | timestamptz NOT NULL | default now() |
| updated_at | timestamptz NOT NULL | default now() |

Constraint: `percentage1 + percentage2 = 1.0000` (CHECK constraint)

### 2b. `qrdd_merchant_whitelist`

| Column | Type | Constraint |
|--------|------|------------|
| id | uuid PK | default gen_random_uuid() |
| merchant_id | text NOT NULL UNIQUE | |
| merchant_name | text NOT NULL | |
| bu_name | text NOT NULL | FK → qrdd_bu_accounts.name |
| status | text NOT NULL DEFAULT 'ACTIVE' | CHECK (status IN ('ACTIVE', 'INACTIVE')) |
| created_by | text NOT NULL | |
| created_at | timestamptz NOT NULL | default now() |
| updated_by | text NOT NULL | |
| updated_at | timestamptz NOT NULL | default now() |

### 2c. `qrdd_promo_rules`

| Column | Type | Constraint |
|--------|------|------------|
| promo_id | text PK | (no UUID, user-defined like antavaya_promo_2026_01) |
| promo_name | text NOT NULL | |
| merchant_id | text | FK → qrdd_merchant_whitelist.merchant_id, NULLABLE |
| bu_name | text NOT NULL | FK → qrdd_merchant_whitelist.bu_name |
| start_date | date NOT NULL | |
| end_date | date NOT NULL | |
| prm_discount_type | text NOT NULL | CHECK (prm_discount_type IN ('PERCENTAGE', 'FIXED')) |
| prm_discount_value | numeric NOT NULL | |
| prm_max_discount | numeric NOT NULL | |
| pl_discount_type | text NOT NULL | CHECK (pl_discount_type IN ('PERCENTAGE', 'FIXED')) |
| pl_discount_value | numeric NOT NULL | |
| pl_max_discount | numeric NOT NULL | |
| min_txn_amount | numeric NOT NULL | |
| max_txn_amount | numeric | NULL |
| budget_amount | numeric | NULL |
| priority | integer NOT NULL DEFAULT 0 | |
| status | text NOT NULL DEFAULT 'ACTIVE' | CHECK (status IN ('ACTIVE', 'INACTIVE')) |
| created_by | text NOT NULL | |
| created_at | timestamptz NOT NULL | default now() |
| updated_by | text NOT NULL | |
| updated_at | timestamptz NOT NULL | default now() |

### 2d. Indexes
- `qrdd_bu_accounts`: unique index on `name`
- `qrdd_merchant_whitelist`: unique index on `merchant_id`, index on `bu_name`
- `qrdd_promo_rules`: index on `merchant_id`, index on `bu_name`

### 2e. RLS
All three tables: `alter table ... enable row level security;`
Policy: `for all to authenticated using (true)` — admin-only, no user-scoping.

---

## 3. UI Display

### 3a. BU Accounts

Display columns: `name` | `sof` | Allo Expense (`acctname1` + % badge) | Receivable (`acctname2` + % badge) | `updated_at`

Form fields:
- `name` (text)
- `sof` (dropdown: PRIME, PAYLATER)
- `account1` (text, a/c number)
- `acctname1` (text, expense name — label "Allo Expense")
- `percentage1` (number, user types e.g. 50 → displayed as 50% → saved as 0.5000)
- `account2` (text, a/c number)
- `acctname2` (text, receivable name)
- `percentage2` (number, auto-calculated from 100 - percentage1, or manual input)

Validation: percentage1 + percentage2 must = 100 (guard clause). Percentage input > 0.

### 3b. Merchant Whitelist

Display: `merchant_id` | `merchant_name` | `bu_name` | `status` badge | `created_by` | `updated_at`

Form:
- `merchant_id` (text, unique validation check)
- `merchant_name` (text)
- `bu_name` (dropdown from `qrdd_bu_accounts.name`, auto-fetched on mount)
- `status` (dropdown: ACTIVE, INACTIVE)

### 3c. Promo Rule

Display (compact table): `promo_id` | `promo_name` | `merchant_id` (or "All") | `bu_name` | discount summary | `start_date` – `end_date` | `priority` | `status`

Search: dropdown selector (`promo_id` / `promo_name` / `merchant_id` / `bu_name`) + text input.

Form (complex, likely a modal with sections):
- Section 1: Basic — `promo_id`, `promo_name`, `merchant_id` (dropdown from whitelist + "All Merchants" option → NULL), `bu_name` (auto from merchant or direct dropdown)
- Section 2: Dates — `start_date`, `end_date` (date pickers)
- Section 3: PRM Discount — `prm_discount_type` (PERCENTAGE/FIXED toggle), `prm_discount_value` (number), `prm_max_discount` (number + "Unlimited" toggle)
- Section 4: PL Discount — same pattern as PRM
- Section 5: Limits — `min_txn_amount` (number + "No minimum" toggle), `max_txn_amount` (number + "Unlimited" toggle), `budget_amount` (number + "Unlimited" toggle)
- Section 6: `priority` (number), `status` (ACTIVE/INACTIVE)

**Sentinel value mappings (form ↔ DB):**
| Field | UI Toggle | DB Value |
|-------|-----------|----------|
| prm_max_discount / pl_max_discount | "Unlimited" ON | 50000000000.00 |
| min_txn_amount | "No minimum" ON | 1.00 |
| max_txn_amount | "Unlimited" ON | NULL |
| budget_amount | "Unlimited" ON | NULL |

**Discount value mappings:**
| UI | Type | DB |
|----|------|-----|
| User types 20 | PERCENTAGE | 20.00 (no /100 conversion) |
| User types 10000 | FIXED | 10000.00 |

All decimal values stored with precision as-is. No division by 100 for any discount field — only BU Accounts percentage uses the percentage-to-decimal conversion.

---

## 4. CRUD Permission Model

Each page has 4 granular sub-features (read, create, update, delete). Admin can enable/disable each operation per role via the existing Admin Modules UI.

```dot
qrdd (module)
├── bu-accounts.read →
├── bu-accounts.create → "Add BU Account" button shown
├── bu-accounts.update → "Edit" action on each row
├── bu-accounts.delete → "Delete" action on each row
├── merchant-whitelist.read →
├── merchant-whitelist.create →
├── merchant-whitelist.update →
├── merchant-whitelist.delete →
├── promo-rule.read →
├── promo-rule.create →
├── promo-rule.update →
└── promo-rule.delete →
```

**Pattern in code:** Components check `canFeature('qrdd', 'bu-accounts.create')` etc. before rendering action buttons. Parent view gates the entire tab behind `canFeature('qrdd', 'bu-accounts.read')`. This follows the existing `useAccess().canFeature()` pattern already used in QrisView (`canFeature('qris', 'history')`).

**DB seeding:** Insert into `feature_access` for admin role — admin gets all 12 features by default. Other roles assigned as needed.

---

## 5. Architecture

```
src/modules/qrdd/
├── views/QrddView.vue              (pill tab switching + form modal + delete confirm)
├── composables/
│   ├── useBuAccounts.js             (CRUD + pagination + search + export)
│   ├── useMerchantWhitelist.js      (CRUD + pagination + search + BU dropdown + export)
│   ├── usePromoRule.js              (CRUD + pagination + smart search + export)
│   └── useQrddDashboard.js          (aggregation queries for dashboard)
└── components/
    ├── BuAccountsTab.vue            (LiTable + export button)
    ├── BuAccountForm.vue            (create/edit form modal)
    ├── MerchantWhitelistTab.vue     (LiTable + export button)
    ├── MerchantForm.vue             (create/edit form modal)
    ├── PromoRuleTab.vue             (LiTable + search selector + export button)
    ├── PromoRuleForm.vue            (multi-section create/edit form)
    └── DashboardTab.vue             (summary cards + CSS charts + recent activity + export)

src/lib/
└── export-xlsx.js                   (shared XLSX helper)

src/modules/admin/views/
└── AdminView.vue                    (LiTabs → pill tabs, same AdminView logic)

src/modules/dashboard/views/
└── DashboardView.vue                (add QR DD summary cards section)
```

Pattern: QrddView owns composables + form state, passes props-down/events-up to tab components. Forms rendered as modals at view level (not embedded in tabs).

---

## 5b. Files Changed Summary (cumulative)

| File | Change |
|------|--------|
| `src/lib/modules.js` | (done) Add qrdd module + 12 features |
| `src/router/index.js` | (done) Add /qrdd route |
| `supabase/schema.sql` | (done) Add 3 tables + indexes + RLS |
| `package.json` | Add `xlsx` |
| `src/lib/export-xlsx.js` | **New** |
| `src/modules/qrdd/views/QrddView.vue` | (done → modify) Pill tabs + Dashboard tab |
| `src/modules/qrdd/composables/useBuAccounts.js` | (done → modify) Add export |
| `src/modules/qrdd/composables/useMerchantWhitelist.js` | (done → modify) Add export |
| `src/modules/qrdd/composables/usePromoRule.js` | (done → modify) Add export |
| `src/modules/qrdd/composables/useQrddDashboard.js` | **New** |
| `src/modules/qrdd/components/BuAccountsTab.vue` | (done → modify) Add export button |
| `src/modules/qrdd/components/BuAccountForm.vue` | (done) |
| `src/modules/qrdd/components/MerchantWhitelistTab.vue` | (done → modify) Add export button |
| `src/modules/qrdd/components/MerchantForm.vue` | (done) |
| `src/modules/qrdd/components/PromoRuleTab.vue` | (done → modify) Add export button |
| `src/modules/qrdd/components/PromoRuleForm.vue` | (done) |
| `src/modules/qrdd/components/DashboardTab.vue` | **New** |
| `src/modules/admin/views/AdminView.vue` | **Modify** — LiTabs → pill tabs |
| `src/modules/dashboard/views/DashboardView.vue` | **Modify** — QR DD summary cards |

## 6. Pill Tab Migration (QR DD + Admin)

Replace `LiTabs` in `QrddView.vue` and `AdminView.vue` with QRIS-style animated pill tabs.

Pattern from `QrisView.vue`:
- `<nav class="qrdd__tabs">` with buttons + absolute-positioned `.qrdd__tab-indicator`
- `indicatorStyle` reactive prop: `{ left, width }` computed from `activeTabIndex` × DOM `offsetLeft`/`offsetWidth`
- `updateIndicator()` called on tab switch + window resize
- Transition: `all 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)` spring
- Tab defs: `{ id, label, desc, icon }` — `desc` hidden under 640px, icon hidden under 480px

**QR DD tabs** (4 tabs, feature-gated):
| ID | Label | Desc | Icon | Feature Gate |
|----|-------|------|------|-------------|
| `bu-accounts` | BU Accounts | Manage accounts | `account_balance` | `bu-accounts.read` |
| `merchant-whitelist` | Merchants | Whitelist management | `store` | `merchant-whitelist.read` |
| `promo-rule` | Promo Rules | Discount rules | `discount` | `promo-rule.read` |
| `dashboard` | Dashboard | Reports & stats | `monitoring` | always visible (no feature gate) |

**Admin tabs** (3 tabs, no change in structure):
| ID | Label | Desc | Icon |
|----|-------|------|------|
| `users` | Users | Manage users | `group` |
| `roles` | Roles | Role management | `shield_person` |
| `modules` | Modules | Module access | `apps` |

Tab content rendering: `v-if` on `activeTab` (string ID), not index. Tab index computed from `visibleTabs` array.

---

## 7. Dashboard Tab (QR DD Module)

New 4th tab in QR DD. Aggregated stats from all 3 tables.

### 7a. Summary Cards (top row)

4 cards in a grid:
- **BU Accounts** — total count, breakdown PRIME vs PAYLATER badges
- **Merchants** — total count, breakdown ACTIVE vs INACTIVE
- **Promo Rules** — total count, breakdown ACTIVE vs INACTIVE
- **Active Budget** — sum of `budget_amount` for active promos where budget is not NULL; "Unlimited" if any active promo has NULL budget

### 7b. Charts (middle row) — CSS-only, no library

**Bar chart: Merchants per BU**
- Query: `SELECT bu_name, COUNT(*) FROM qrdd_merchant_whitelist GROUP BY bu_name`
- Horizontal bars, width proportional to max count
- Label: BU name + count

**Bar chart: Promos per BU**
- Query: `SELECT bu_name, COUNT(*) FROM qrdd_promo_rules GROUP BY bu_name`
- Same pattern as above

**Donut/ring: Discount type distribution**
- PRM PERCENTAGE vs FIXED vs PL PERCENTAGE vs FIXED
- Pure CSS ring using `conic-gradient`
- Legend below

### 7c. Recent Activity (bottom)

Two small tables side by side:
- **Recent Promos** — last 5: `promo_id`, `promo_name`, `start_date`, `end_date`, `status`
- **Recent Merchants** — last 5: `merchant_id`, `merchant_name`, `bu_name`, `created_at`

### 7d. Composables

**New:** `src/modules/qrdd/composables/useQrddDashboard.js`

```js
export function useQrddDashboard() {
  // Returns:
  return {
    stats,          // reactive: { buCount, merchantCount, promoCount, activeBudget, ... }
    merchantsPerBu, // reactive: [{ bu_name, count }]
    promosPerBu,    // reactive: [{ bu_name, count }]
    discountTypes,  // reactive: { prmPct, prmFixed, plPct, plFixed }
    recentPromos,   // reactive: last 5
    recentMerchants,// reactive: last 5
    loading,
    loadAll,        // fetch all aggregations
  }
}
```

Aggregation queries:
- Counts: Supabase `count` with filters (no `select *`)
- Grouped: Supabase raw SQL via `.rpc()` or client-side `groupBy` (ponytail: client-side groupBy for small datasets <1000 rows; upgrade to DB view/RPC when data grows)
- Recent: `.select().order().limit(5)`

---

## 8. Homepage Dashboard Summary

In `DashboardView.vue`, add a "QR DD Summary" section below the tools grid.

**Visibility:** Only when `canModule('qrdd')` is true.

**Data cards:**
- Total BU Accounts
- Active Merchants
- Active Promos
- Promos expiring within 30 days

Uses same `useQrddDashboard` composable. Lightweight — only count queries, no heavy aggregation needed for homepage.

Placement: below tools section, above empty state.

---

## 9. XLSX Export

### 9a. Library

Add `xlsx` (SheetJS) to `package.json`. No other deps.

### 9b. Shared helper

**New:** `src/lib/export-xlsx.js`

```js
import * as XLSX from 'xlsx'

// Ensure Excel treats value as text (prevents scientific notation on IDs)
function textFormula(v) {
  if (v == null) return ''
  const s = String(v)
  // Only prefix if it looks like a numeric ID that Excel would mangle
  if (/^\d{10,}$/.test(s)) return `="${s}"`
  return s
}

export function exportToXlsx(rows, columns, filename) {
  const data = rows.map(row => {
    const obj = {}
    for (const col of columns) {
      const v = col.format ? col.format(row[col.key], row) : row[col.key]
      obj[col.label] = col.textFormula ? textFormula(v) : (v ?? '')
    }
    return obj
  })
  const ws = XLSX.utils.json_to_sheet(data)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1')
  XLSX.writeFile(wb, `${filename}.xlsx`)
}
```

### 9c. Per-tab export

Each tab gets an Export button in the toolbar (next to "Add" button). Export uses current **filtered** data (respects search query).

**BU Accounts export columns:**
| Column | Key | Format |
|--------|-----|--------|
| Name | name | text |
| SOF | sof | text |
| Expense Account | account1 | textFormula |
| Expense Name | acctname1 | text |
| Expense % | percentage1 | `Math.round(v*100)+'%'` |
| Receivable Account | account2 | textFormula |
| Receivable Name | acctname2 | text |
| Receivable % | percentage2 | `Math.round(v*100)+'%'` |
| Updated | updated_at | date |

**Merchant Whitelist export columns:**
| Column | Key | Format |
|--------|-----|--------|
| Merchant ID | merchant_id | textFormula |
| Merchant Name | merchant_name | text |
| BU Name | bu_name | text |
| Status | status | text |
| Created By | created_by | text |
| Created At | created_at | date |
| Updated By | updated_by | text |
| Updated At | updated_at | date |

**Promo Rule export columns (all 19 displayed fields):**
| Column | Key | Format |
|--------|-----|--------|
| Promo ID | promo_id | text |
| Promo Name | promo_name | text |
| Merchant ID | merchant_id | textFormula |
| BU Name | bu_name | text |
| Start Date | start_date | date |
| End Date | end_date | date |
| PRM Discount Type | prm_discount_type | text |
| PRM Discount Value | prm_discount_value | `v + (type==PERCENTAGE?'%':'')` |
| PRM Max Discount | prm_max_discount | unlimited→"Unlimited" |
| PL Discount Type | pl_discount_type | text |
| PL Discount Value | pl_discount_value | same as PRM |
| PL Max Discount | pl_max_discount | unlimited→"Unlimited" |
| Min Txn Amount | min_txn_amount | ≤1→"No Minimum" |
| Max Txn Amount | max_txn_amount | null→"Unlimited" |
| Budget Amount | budget_amount | null→"Unlimited" |
| Priority | priority | number |
| Status | status | text |
| Created By | created_by | text |
| Updated By | updated_by | text |
| Updated At | updated_at | date |

**Dashboard export:**
- Single XLSX with 3 sheets: "Summary", "Merchants per BU", "Promos per BU"
- Summary sheet: 4 rows (BU Accounts, Merchants, Promos, Budget)
- Per-BU sheets: bu_name + count

### 9d. Export button UI

Each tab toolbar: Export button with icon `file_save`, text "Export", to the left of the Add button. Styled as secondary/outline variant.

```
[Search...]               [Export] [Add BU Account]
```

---

## 10. Not in Scope
- Soft delete (hard delete only)
- Promo Rule status transition logic (ACTIVE→INACTIVE only, no workflow)
- Chart library (Chart.js, D3) — CSS-only visualizations
- Real-time subscriptions — data refreshed on tab switch / page load only
- PDF export — XLSX only
