# QR DD Module — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a full-CRUD admin module "QR DD" with 3 pages: BU Accounts, Merchant Whitelist, Promo Rule. Each page supports create, read, update, delete with per-operation feature flags, pagination, search, and server-validated constraints.

**Architecture:** Follows AdminView pattern — `QrddView.vue` owns state via 3 composables, renders 3 tab components (props-down/events-up), each tab has a LiTable + LiModal create/edit form + LiPagination + search. 3 Supabase tables with CHECK constraints, UNIQUE indexes, and RLS `true` (admin-only module). 12 granular features (3 pages × 4 CRUD ops) registered in module registry.

**Tech Stack:** Vue 3 (Composition API), Supabase JS, LiTable, LiModal, LiPagination, LiTextField, LiSelect, LiDatePicker, LiToggle, LiTabs, LiEmptyState, LiGlassCard, useToast (all existing)

## Global Constraints

- All 3 tables: RLS `for all to authenticated using (true)` — no user-scoping, admin-only module
- Hard delete only — no soft-delete columns
- BU Accounts: `percentage1 + percentage2 = 1.0000` (DB CHECK + frontend guard)
- Merchant Whitelist: `merchant_id` UNIQUE, `bu_name` FK → `qrdd_bu_accounts.name`
- Promo Rule: `promo_id` UNIQUE text PK (user-defined, no UUID), `merchant_id` FK NULLABLE → `qrdd_merchant_whitelist.merchant_id`, sentinel values (unlimited=50000000000.00, no-min=1.00, unlimited-max=NULL, unlimited-budget=NULL)
- Discount values stored as-is (20%→20.00, fixed 10000→10000.00) — no /100 conversion
- BU Accounts percentage: UI input 50→display 50%→DB 0.5000 (convert: `value/100`)
- Page size: 10, paginated client-side (computed from full data set)
- Permission checks: `canFeature('qrdd', '<page>.<op>')` — read gates tab visibility, create gates Add button, update gates Edit action, delete gates Delete action
- Toast on all mutations (useToast)
- Commit per task

---

### Task 1: Module Registration + Router

**Files:**
- Modify: `src/lib/modules.js:41` (add before `admin` entry)
- Modify: `src/router/index.js:49` (add before `/admin` route)

**Interfaces:**
- Produces: Module `qrdd` with 12 sub-features registered; route `/qrdd` available; sidebar auto-discovers

- [ ] **Step 1: Add module to MODULE_REGISTRY**

In `src/lib/modules.js`, add after line 35 (after `video-frames` entry) and before the `admin` entry:

```js
  {
    id: 'qrdd', label: 'QR DD', icon: 'database', path: '/qrdd',
    desc: 'Manage BU accounts, merchant whitelist, and promo rules.',
    features: [
      { id: 'bu-accounts.read',   label: 'BU Accounts — Read',   desc: 'View BU account list.' },
      { id: 'bu-accounts.create', label: 'BU Accounts — Create', desc: 'Add new BU accounts.' },
      { id: 'bu-accounts.update', label: 'BU Accounts — Update', desc: 'Edit existing BU accounts.' },
      { id: 'bu-accounts.delete', label: 'BU Accounts — Delete', desc: 'Delete BU accounts.' },
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

- [ ] **Step 2: Add route**

In `src/router/index.js`, add before the `/admin` route (line 44):

```js
  {
    path: '/qrdd',
    name: 'qrdd',
    meta: { module: 'qrdd', label: 'QR DD', icon: 'database' },
    component: () => import('../modules/qrdd/views/QrddView.vue'),
  },
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/modules.js src/router/index.js
git commit -m "feat(qrdd): register QR DD module with 12 CRUD features + route

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Database — 3 Tables + RLS + Indexes

**Files:**
- Modify: `supabase/schema.sql` (append)

**Interfaces:**
- Produces: `qrdd_bu_accounts`, `qrdd_merchant_whitelist`, `qrdd_promo_rules` tables with constraints, indexes, RLS

- [ ] **Step 1: Add all DDL to schema.sql**

Append to `supabase/schema.sql`:

```sql
-- ============================================================================
-- QR DD Module
-- ============================================================================

-- ── BU Accounts ──
create table if not exists public.qrdd_bu_accounts (
  id           uuid primary key default gen_random_uuid(),
  name         text not null unique,
  sof          text not null check (sof in ('PRIME', 'PAYLATER')),
  account1     text not null,
  acctname1    text not null,
  percentage1  numeric(5,4) not null check (percentage1 > 0 and percentage1 < 1),
  account2     text not null,
  acctname2    text not null,
  percentage2  numeric(5,4) not null check (percentage2 > 0 and percentage2 < 1),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint qrdd_bu_accounts_pct_sum check (percentage1 + percentage2 = 1.0000)
);

create unique index if not exists idx_qrdd_bu_accounts_name on public.qrdd_bu_accounts (name);

alter table public.qrdd_bu_accounts enable row level security;
grant select, insert, update, delete on public.qrdd_bu_accounts to authenticated;
create policy "qrdd_bu_accounts_all" on public.qrdd_bu_accounts
  for all to authenticated using (true) with check (true);

-- ── Merchant Whitelist ──
create table if not exists public.qrdd_merchant_whitelist (
  id             uuid primary key default gen_random_uuid(),
  merchant_id    text not null unique,
  merchant_name  text not null,
  bu_name        text not null references public.qrdd_bu_accounts (name) on delete restrict,
  status         text not null default 'ACTIVE' check (status in ('ACTIVE', 'INACTIVE')),
  created_by     text not null,
  created_at     timestamptz not null default now(),
  updated_by     text not null,
  updated_at     timestamptz not null default now()
);

create unique index if not exists idx_qrdd_mw_merchant_id on public.qrdd_merchant_whitelist (merchant_id);
create index if not exists idx_qrdd_mw_bu_name on public.qrdd_merchant_whitelist (bu_name);

alter table public.qrdd_merchant_whitelist enable row level security;
grant select, insert, update, delete on public.qrdd_merchant_whitelist to authenticated;
create policy "qrdd_mw_all" on public.qrdd_merchant_whitelist
  for all to authenticated using (true) with check (true);

-- ── Promo Rules ──
create table if not exists public.qrdd_promo_rules (
  promo_id          text primary key,
  promo_name        text not null,
  merchant_id       text references public.qrdd_merchant_whitelist (merchant_id) on delete set null,
  bu_name           text not null,
  start_date        date not null,
  end_date          date not null,
  prm_discount_type  text not null check (prm_discount_type in ('PERCENTAGE', 'FIXED')),
  prm_discount_value numeric not null,
  prm_max_discount   numeric not null,
  pl_discount_type   text not null check (pl_discount_type in ('PERCENTAGE', 'FIXED')),
  pl_discount_value  numeric not null,
  pl_max_discount    numeric not null,
  min_txn_amount     numeric not null,
  max_txn_amount     numeric,
  budget_amount      numeric,
  priority          integer not null default 0,
  status            text not null default 'ACTIVE' check (status in ('ACTIVE', 'INACTIVE')),
  created_by        text not null,
  created_at        timestamptz not null default now(),
  updated_by        text not null,
  updated_at        timestamptz not null default now()
);

create index if not exists idx_qrdd_pr_merchant_id on public.qrdd_promo_rules (merchant_id);
create index if not exists idx_qrdd_pr_bu_name on public.qrdd_promo_rules (bu_name);

alter table public.qrdd_promo_rules enable row level security;
grant select, insert, update, delete on public.qrdd_promo_rules to authenticated;
create policy "qrdd_pr_all" on public.qrdd_promo_rules
  for all to authenticated using (true) with check (true);
```

- [ ] **Step 2: Apply migration to Supabase**

Use Supabase MCP `apply_migration` with name `20260703_qrdd_module` and the query from Step 1 (all three CREATE TABLE statements in one migration).

- [ ] **Step 3: Commit**

```bash
git add supabase/schema.sql
git commit -m "feat(db): add qrdd_bu_accounts, qrdd_merchant_whitelist, qrdd_promo_rules tables

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: useBuAccounts Composable

**Files:**
- Create: `src/modules/qrdd/composables/useBuAccounts.js`

**Interfaces:**
- Consumes: `supabase` from `@/lib/supabase.js`, `useAuth` from `@/composables/useAuth.js`, `useToast` from `@/lib/composables/useToast.js`
- Produces: `{ items, loading, error, searchQuery, currentPage, pageSize, paginatedItems, totalPages, loadItems, createItem, updateItem, deleteItem }` — each mutation returns boolean

- [ ] **Step 1: Write the composable**

Create `src/modules/qrdd/composables/useBuAccounts.js`:

```js
import { ref, computed, watch } from 'vue'
import { supabase } from '@/lib/supabase.js'
import { useAuth } from '@/composables/useAuth.js'
import { useToast } from '@/lib/composables/useToast.js'

export function useBuAccounts() {
  const { session } = useAuth()
  const toast = useToast()

  const items = ref([])
  const loading = ref(true)
  const error = ref(null)

  const searchQuery = ref('')
  const currentPage = ref(1)
  const pageSize = 10

  watch(searchQuery, () => { currentPage.value = 1 })

  // ── Derived ──

  const filtered = computed(() => {
    let result = items.value
    if (searchQuery.value) {
      const q = searchQuery.value.toLowerCase()
      result = result.filter(r =>
        (r.name || '').toLowerCase().includes(q) ||
        (r.sof || '').toLowerCase().includes(q) ||
        (r.acctname1 || '').toLowerCase().includes(q) ||
        (r.acctname2 || '').toLowerCase().includes(q),
      )
    }
    return result
  })

  const totalPages = computed(() =>
    Math.max(1, Math.ceil(filtered.value.length / pageSize)),
  )

  const paginatedItems = computed(() => {
    const start = (currentPage.value - 1) * pageSize
    return filtered.value.slice(start, start + pageSize)
  })

  // ── DB operations ──

  async function loadItems() {
    loading.value = true
    error.value = null
    try {
      const { data, error: e } = await supabase
        .from('qrdd_bu_accounts')
        .select('*')
        .order('name', { ascending: true })
      if (e) throw e
      items.value = data || []
    } catch (e) {
      error.value = e.message
      items.value = []
    } finally {
      loading.value = false
    }
  }

  async function createItem(form) {
    error.value = null
    const p1 = form.percentage1 / 100
    const p2 = form.percentage2 / 100

    if (Math.abs(p1 + p2 - 1) > 0.0001) {
      toast.error('Percentages must sum to 100%')
      return false
    }

    const { data, error: e } = await supabase
      .from('qrdd_bu_accounts')
      .insert({
        name: form.name,
        sof: form.sof,
        account1: form.account1,
        acctname1: form.acctname1,
        percentage1: p1,
        account2: form.account2,
        acctname2: form.acctname2,
        percentage2: p2,
      })
      .select('*').single()
    if (e) {
      if (e.code === '23505') {
        toast.error(`BU Account "${form.name}" already exists`)
      } else {
        toast.error(e.message)
      }
      return false
    }
    items.value = [data, ...items.value]
    toast.success(`BU Account "${form.name}" created`)
    return true
  }

  async function updateItem(id, form) {
    error.value = null
    const p1 = form.percentage1 / 100
    const p2 = form.percentage2 / 100

    if (Math.abs(p1 + p2 - 1) > 0.0001) {
      toast.error('Percentages must sum to 100%')
      return false
    }

    const { data, error: e } = await supabase
      .from('qrdd_bu_accounts')
      .update({
        name: form.name,
        sof: form.sof,
        account1: form.account1,
        acctname1: form.acctname1,
        percentage1: p1,
        account2: form.account2,
        acctname2: form.acctname2,
        percentage2: p2,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select('*').single()
    if (e) {
      if (e.code === '23505') {
        toast.error(`BU Account "${form.name}" already exists`)
      } else {
        toast.error(e.message)
      }
      return false
    }
    const idx = items.value.findIndex(r => r.id === id)
    if (idx !== -1) items.value[idx] = data
    toast.success(`BU Account "${form.name}" updated`)
    return true
  }

  async function deleteItem(id, name) {
    error.value = null
    const { error: e } = await supabase
      .from('qrdd_bu_accounts')
      .delete()
      .eq('id', id)
    if (e) {
      if (e.code === '23503') {
        toast.error(`Cannot delete "${name}" — it is referenced by merchants or promo rules`)
      } else {
        toast.error(e.message)
      }
      return false
    }
    items.value = items.value.filter(r => r.id !== id)
    toast.success(`BU Account "${name}" deleted`)
    return true
  }

  // ── Helpers for dependent dropdowns ──

  const nameOptions = computed(() =>
    items.value.map(r => ({ label: r.name, value: r.name })),
  )

  return {
    items, loading, error,
    searchQuery, currentPage, pageSize,
    paginatedItems, totalPages, nameOptions,
    loadItems, createItem, updateItem, deleteItem,
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/modules/qrdd/composables/useBuAccounts.js
git commit -m "feat(qrdd): add useBuAccounts composable with full CRUD

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: useMerchantWhitelist Composable

**Files:**
- Create: `src/modules/qrdd/composables/useMerchantWhitelist.js`

**Interfaces:**
- Consumes: `supabase`, `useAuth`, `useToast`
- Produces: `{ items, loading, error, searchQuery, currentPage, pageSize, paginatedItems, totalPages, loadItems, createItem, updateItem, deleteItem }`

- [ ] **Step 1: Write the composable**

Create `src/modules/qrdd/composables/useMerchantWhitelist.js`:

```js
import { ref, computed, watch } from 'vue'
import { supabase } from '@/lib/supabase.js'
import { useAuth } from '@/composables/useAuth.js'
import { useToast } from '@/lib/composables/useToast.js'

export function useMerchantWhitelist() {
  const { session } = useAuth()
  const toast = useToast()

  const items = ref([])
  const loading = ref(true)
  const error = ref(null)

  const searchQuery = ref('')
  const currentPage = ref(1)
  const pageSize = 10

  watch(searchQuery, () => { currentPage.value = 1 })

  const filtered = computed(() => {
    let result = items.value
    if (searchQuery.value) {
      const q = searchQuery.value.toLowerCase()
      result = result.filter(r =>
        (r.merchant_id || '').toLowerCase().includes(q) ||
        (r.merchant_name || '').toLowerCase().includes(q) ||
        (r.bu_name || '').toLowerCase().includes(q),
      )
    }
    return result
  })

  const totalPages = computed(() =>
    Math.max(1, Math.ceil(filtered.value.length / pageSize)),
  )

  const paginatedItems = computed(() => {
    const start = (currentPage.value - 1) * pageSize
    return filtered.value.slice(start, start + pageSize)
  })

  const username = computed(() => session.value?.user?.email || 'SYSTEM')

  async function loadItems() {
    loading.value = true
    error.value = null
    try {
      const { data, error: e } = await supabase
        .from('qrdd_merchant_whitelist')
        .select('*')
        .order('created_at', { ascending: false })
      if (e) throw e
      items.value = data || []
    } catch (e) {
      error.value = e.message
      items.value = []
    } finally {
      loading.value = false
    }
  }

  async function createItem(form) {
    error.value = null
    const { data, error: e } = await supabase
      .from('qrdd_merchant_whitelist')
      .insert({
        merchant_id: form.merchant_id,
        merchant_name: form.merchant_name,
        bu_name: form.bu_name,
        status: form.status || 'ACTIVE',
        created_by: username.value,
        updated_by: username.value,
      })
      .select('*').single()
    if (e) {
      if (e.code === '23505') {
        toast.error(`Merchant "${form.merchant_id}" already exists`)
      } else if (e.code === '23503') {
        toast.error('Invalid BU name — must exist in BU Accounts')
      } else {
        toast.error(e.message)
      }
      return false
    }
    items.value = [data, ...items.value]
    toast.success(`Merchant "${form.merchant_id}" added`)
    return true
  }

  async function updateItem(id, form) {
    error.value = null
    const { data, error: e } = await supabase
      .from('qrdd_merchant_whitelist')
      .update({
        merchant_id: form.merchant_id,
        merchant_name: form.merchant_name,
        bu_name: form.bu_name,
        status: form.status,
        updated_by: username.value,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select('*').single()
    if (e) {
      if (e.code === '23505') {
        toast.error(`Merchant "${form.merchant_id}" already exists`)
      } else {
        toast.error(e.message)
      }
      return false
    }
    const idx = items.value.findIndex(r => r.id === id)
    if (idx !== -1) items.value[idx] = data
    toast.success(`Merchant "${form.merchant_id}" updated`)
    return true
  }

  async function deleteItem(id, merchantId) {
    error.value = null
    const { error: e } = await supabase
      .from('qrdd_merchant_whitelist')
      .delete()
      .eq('id', id)
    if (e) {
      if (e.code === '23503') {
        toast.error(`Cannot delete "${merchantId}" — it is referenced by promo rules`)
      } else {
        toast.error(e.message)
      }
      return false
    }
    items.value = items.value.filter(r => r.id !== id)
    toast.success(`Merchant "${merchantId}" deleted`)
    return true
  }

  return {
    items, loading, error,
    searchQuery, currentPage, pageSize,
    paginatedItems, totalPages,
    loadItems, createItem, updateItem, deleteItem,
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/modules/qrdd/composables/useMerchantWhitelist.js
git commit -m "feat(qrdd): add useMerchantWhitelist composable with full CRUD

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: usePromoRule Composable

**Files:**
- Create: `src/modules/qrdd/composables/usePromoRule.js`

**Interfaces:**
- Consumes: `supabase`, `useAuth`, `useToast`
- Produces: `{ items, loading, error, searchQuery, searchColumn, paginatedItems, totalPages, loadItems, createItem, updateItem, deleteItem }`

**Sentinel values (form ↔ DB):**
| Field | UI Toggle | DB Value |
|-------|-----------|----------|
| prm_max_discount / pl_max_discount | "Unlimited" ON | `50000000000.00` |
| min_txn_amount | "No minimum" ON | `1.00` |
| max_txn_amount | "Unlimited" ON | `null` |
| budget_amount | "Unlimited" ON | `null` |

- [ ] **Step 1: Write the composable**

Create `src/modules/qrdd/composables/usePromoRule.js`:

```js
import { ref, computed, watch } from 'vue'
import { supabase } from '@/lib/supabase.js'
import { useAuth } from '@/composables/useAuth.js'
import { useToast } from '@/lib/composables/useToast.js'

// ── Sentinel constants ──
const UNLIMITED_AMOUNT = 50000000000.00
const NO_MINIMUM = 1.00

export { UNLIMITED_AMOUNT, NO_MINIMUM }

export function usePromoRule() {
  const { session } = useAuth()
  const toast = useToast()

  const items = ref([])
  const loading = ref(true)
  const error = ref(null)

  const searchQuery = ref('')
  const searchColumn = ref('promo_id') // 'promo_id' | 'promo_name' | 'merchant_id' | 'bu_name'
  const currentPage = ref(1)
  const pageSize = 10

  watch([searchQuery, searchColumn], () => { currentPage.value = 1 })

  const filtered = computed(() => {
    let result = items.value
    if (searchQuery.value) {
      const q = searchQuery.value.toLowerCase()
      result = result.filter(r =>
        (r[searchColumn.value] || '').toLowerCase().includes(q),
      )
    }
    return result
  })

  const totalPages = computed(() =>
    Math.max(1, Math.ceil(filtered.value.length / pageSize)),
  )

  const paginatedItems = computed(() => {
    const start = (currentPage.value - 1) * pageSize
    return filtered.value.slice(start, start + pageSize)
  })

  const username = computed(() => session.value?.user?.email || 'SYSTEM')

  async function loadItems() {
    loading.value = true
    error.value = null
    try {
      const { data, error: e } = await supabase
        .from('qrdd_promo_rules')
        .select('*')
        .order('created_at', { ascending: false })
      if (e) throw e
      items.value = data || []
    } catch (e) {
      error.value = e.message
      items.value = []
    } finally {
      loading.value = false
    }
  }

  async function createItem(form) {
    error.value = null
    if (!form.promo_id?.trim()) {
      toast.error('Promo ID is required')
      return false
    }
    const { data, error: e } = await supabase
      .from('qrdd_promo_rules')
      .insert({
        promo_id: form.promo_id,
        promo_name: form.promo_name,
        merchant_id: form.merchant_id || null,
        bu_name: form.bu_name,
        start_date: form.start_date,
        end_date: form.end_date,
        prm_discount_type: form.prm_discount_type,
        prm_discount_value: form.prm_discount_value,
        prm_max_discount: form.prm_unlimited ? UNLIMITED_AMOUNT : form.prm_max_discount,
        pl_discount_type: form.pl_discount_type,
        pl_discount_value: form.pl_discount_value,
        pl_max_discount: form.pl_unlimited ? UNLIMITED_AMOUNT : form.pl_max_discount,
        min_txn_amount: form.min_no_minimum ? NO_MINIMUM : (form.min_txn_amount || 1),
        max_txn_amount: form.max_unlimited ? null : (form.max_txn_amount || null),
        budget_amount: form.budget_unlimited ? null : (form.budget_amount || null),
        priority: form.priority || 0,
        status: form.status || 'ACTIVE',
        created_by: username.value,
        updated_by: username.value,
      })
      .select('*').single()
    if (e) {
      if (e.code === '23505') {
        toast.error(`Promo "${form.promo_id}" already exists`)
      } else if (e.code === '23503') {
        toast.error('Invalid merchant or BU reference')
      } else {
        toast.error(e.message)
      }
      return false
    }
    items.value = [data, ...items.value]
    toast.success(`Promo "${form.promo_id}" created`)
    return true
  }

  async function updateItem(promoId, form) {
    error.value = null
    const { data, error: e } = await supabase
      .from('qrdd_promo_rules')
      .update({
        promo_name: form.promo_name,
        merchant_id: form.merchant_id || null,
        bu_name: form.bu_name,
        start_date: form.start_date,
        end_date: form.end_date,
        prm_discount_type: form.prm_discount_type,
        prm_discount_value: form.prm_discount_value,
        prm_max_discount: form.prm_unlimited ? UNLIMITED_AMOUNT : form.prm_max_discount,
        pl_discount_type: form.pl_discount_type,
        pl_discount_value: form.pl_discount_value,
        pl_max_discount: form.pl_unlimited ? UNLIMITED_AMOUNT : form.pl_max_discount,
        min_txn_amount: form.min_no_minimum ? NO_MINIMUM : (form.min_txn_amount || 1),
        max_txn_amount: form.max_unlimited ? null : (form.max_txn_amount || null),
        budget_amount: form.budget_unlimited ? null : (form.budget_amount || null),
        priority: form.priority || 0,
        status: form.status || 'ACTIVE',
        updated_by: username.value,
        updated_at: new Date().toISOString(),
      })
      .eq('promo_id', promoId)
      .select('*').single()
    if (e) {
      if (e.code === '23503') {
        toast.error('Invalid merchant or BU reference')
      } else {
        toast.error(e.message)
      }
      return false
    }
    const idx = items.value.findIndex(r => r.promo_id === promoId)
    if (idx !== -1) items.value[idx] = data
    toast.success(`Promo "${promoId}" updated`)
    return true
  }

  async function deleteItem(promoId) {
    error.value = null
    const { error: e } = await supabase
      .from('qrdd_promo_rules')
      .delete()
      .eq('promo_id', promoId)
    if (e) {
      toast.error(e.message)
      return false
    }
    items.value = items.value.filter(r => r.promo_id !== promoId)
    toast.success(`Promo "${promoId}" deleted`)
    return true
  }

  return {
    items, loading, error,
    searchQuery, searchColumn, currentPage, pageSize,
    paginatedItems, totalPages,
    loadItems, createItem, updateItem, deleteItem,
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/modules/qrdd/composables/usePromoRule.js
git commit -m "feat(qrdd): add usePromoRule composable with full CRUD + sentinel values

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 6: QrddView — Parent View with Tab Switching

**Files:**
- Create: `src/modules/qrdd/views/QrddView.vue`

**Interfaces:**
- Consumes: `useBuAccounts`, `useMerchantWhitelist`, `usePromoRule` composables; `useAccess` for feature checks; `LiTabs`, `LiModal` (delete confirm)
- Produces: Tab-switching view, wires 3 tab components, owns delete confirm modal

- [ ] **Step 1: Create QrddView.vue**

Create `src/modules/qrdd/views/QrddView.vue`:

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

    <!-- Tabs -->
    <LiTabs v-model="activeTab" :tabs="visibleTabs" />

    <!-- Tab Content -->
    <Transition name="panel-slide" mode="out-in">
      <BuAccountsTab
        v-if="activeTab === 0 && can('bu-accounts.read')"
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
      />

      <MerchantWhitelistTab
        v-else-if="activeTab === 1 && can('merchant-whitelist.read')"
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
      />

      <PromoRuleTab
        v-else-if="activeTab === 2 && can('promo-rule.read')"
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
      />
    </Transition>

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
import { ref, computed, onMounted } from 'vue'
import { useAccess } from '@/composables/useAccess.js'
import { useBuAccounts } from '../composables/useBuAccounts.js'
import { useMerchantWhitelist } from '../composables/useMerchantWhitelist.js'
import { usePromoRule } from '../composables/usePromoRule.js'
import BuAccountsTab from '../components/BuAccountsTab.vue'
import MerchantWhitelistTab from '../components/MerchantWhitelistTab.vue'
import PromoRuleTab from '../components/PromoRuleTab.vue'
import LiTabs from '@lib/components/LiTabs.vue'
import LiModal from '@lib/components/LiModal.vue'

const { canFeature } = useAccess()
const buAccounts = useBuAccounts()
const mw = useMerchantWhitelist()
const pr = usePromoRule()

function can(feature) { return canFeature('qrdd', feature) }

// ── Tabs ──

const activeTab = ref(0)
const allTabDefs = [
  { label: 'BU Accounts', icon: 'account_balance' },
  { label: 'Merchant Whitelist', icon: 'store' },
  { label: 'Promo Rule', icon: 'discount' },
]
const visibleTabs = computed(() => {
  const keys = ['bu-accounts.read', 'merchant-whitelist.read', 'promo-rule.read']
  return allTabDefs.filter((_, i) => can(keys[i]))
})

// ── Form modals ──

const showBuForm = ref(false)
const editingBu = ref(null) // null = create, object = edit

const showMwForm = ref(false)
const editingMw = ref(null)

const showPrForm = ref(false)
const editingPr = ref(null)

// ── Delete confirm ──

const deleteTarget = ref(null) // { type: 'bu'|'mw'|'pr', id, label }

// ── Merchant dropdown (for Promo Rule form) ──

const merchantOptions = computed(() =>
  mw.items.value.map(r => ({
    label: `${r.merchant_id} — ${r.merchant_name}`,
    value: r.merchant_id,
  })),
)

// ── Handlers: BU Accounts ──

function onAddBuAccount() {
  editingBu.value = null
  showBuForm.value = true
  // Form component rendered inline in tab or as modal — see tab implementation
  // ponytail: currently form is embedded in tab; extract to separate modal component when complex enough
}

function onEditBuAccount(row) {
  editingBu.value = row
  showBuForm.value = true
}

function onDeleteBuAccount(row) {
  deleteTarget.value = { type: 'bu', id: row.id, label: row.name }
}

// ── Handlers: Merchant Whitelist ──

function onAddMerchant() {
  editingMw.value = null
  showMwForm.value = true
}

function onEditMerchant(row) {
  editingMw.value = row
  showMwForm.value = true
}

function onDeleteMerchant(row) {
  deleteTarget.value = { type: 'mw', id: row.id, label: row.merchant_id }
}

// ── Handlers: Promo Rule ──

function onAddPromo() {
  editingPr.value = null
  showPrForm.value = true
}

function onEditPromo(row) {
  editingPr.value = row
  showPrForm.value = true
}

function onDeletePromo(row) {
  deleteTarget.value = { type: 'pr', id: row.promo_id, label: row.promo_id }
}

// ── Confirm delete ──

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
</style>
```

- [ ] **Step 2: Commit**

```bash
git add src/modules/qrdd/views/QrddView.vue
git commit -m "feat(qrdd): add QrddView with tab switching and delete confirm

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 7: BuAccountsTab + BuAccountForm Components

**Files:**
- Create: `src/modules/qrdd/components/BuAccountsTab.vue`
- Create: `src/modules/qrdd/components/BuAccountForm.vue`

**Interfaces:**
- Consumes: `LiTable`, `LiTextField`, `LiSelect`, `LiPagination`, `LiModal`, `LiGlassCard`, `LiEmptyState`, `useAccess`

- [ ] **Step 1: Create BuAccountsTab.vue**

Create `src/modules/qrdd/components/BuAccountsTab.vue`:

```html
<template>
  <div class="tab">
    <!-- Toolbar -->
    <div class="tab__toolbar">
      <LiTextField
        v-model="searchQuery"
        placeholder="Search BU accounts..."
        iconLeft="search"
        class="tab__search"
      />
      <button v-if="canCreate" class="tab__add-btn" @click="$emit('add')">
        <span class="material-symbols-outlined">add</span>
        Add BU Account
      </button>
    </div>

    <LiGlassCard variant="light" size="md" :hoverable="false" class="tab__card">
      <LiTable :data="items" :columns="columns" :loading="loading" rowKey="id">
        <template #cell-sof="{ value }">
          <span class="tab__sof-badge" :class="'tab__sof--' + (value || '').toLowerCase()">{{ value }}</span>
        </template>

        <template #cell-percentage1="{ row }">
          <span class="tab__pct">{{ formatPct(row.percentage1) }}% — {{ row.acctname1 }}</span>
          <small class="tab__acct-num">{{ row.account1 }}</small>
        </template>

        <template #cell-percentage2="{ row }">
          <span class="tab__pct">{{ formatPct(row.percentage2) }}% — {{ row.acctname2 }}</span>
          <small class="tab__acct-num">{{ row.account2 }}</small>
        </template>

        <template #cell-updated_at="{ value }">
          <span class="tab__date">{{ formatDate(value) }}</span>
        </template>

        <template #cell-actions="{ row }">
          <div class="tab__actions">
            <button v-if="canUpdate" class="tab__edit-btn" @click="$emit('edit', row)" title="Edit">
              <span class="material-symbols-outlined">edit</span>
            </button>
            <button v-if="canDelete" class="tab__del-btn" @click="$emit('delete', row)" title="Delete">
              <span class="material-symbols-outlined">delete</span>
            </button>
          </div>
        </template>
      </LiTable>

      <LiEmptyState
        v-if="!loading && items.length === 0"
        icon="account_balance"
        title="No BU accounts"
        :description="searchQueryProxy ? 'Try a different search' : 'Add your first BU account to get started.'"
      />

      <div v-if="totalPages > 1" class="tab__pagination">
        <LiPagination v-model="currentPage" :totalPages="totalPages" />
      </div>
    </LiGlassCard>

    <!-- Create/Edit Modal -->
    <BuAccountForm
      v-if="showForm"
      :editing="editingItem"
      @save="onSave"
      @close="closeForm"
    />
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import LiGlassCard from '@lib/components/LiGlassCard.vue'
import LiTable from '@lib/components/LiTable.vue'
import LiTextField from '@lib/components/LiTextField.vue'
import LiPagination from '@lib/components/LiPagination.vue'
import LiEmptyState from '@lib/components/LiEmptyState.vue'
import BuAccountForm from './BuAccountForm.vue'

const props = defineProps({
  items: Array,
  loading: Boolean,
  searchQuery: String,
  currentPage: Number,
  totalPages: Number,
  canCreate: Boolean,
  canUpdate: Boolean,
  canDelete: Boolean,
})

const emit = defineEmits([
  'update:searchQuery', 'update:currentPage',
  'add', 'edit', 'delete',
  'save-create', 'save-edit',
])

const searchQueryProxy = computed({
  get: () => props.searchQuery,
  set: (v) => emit('update:searchQuery', v),
})
const currentPage = computed({
  get: () => props.currentPage,
  set: (v) => emit('update:currentPage', v),
})

// ── Form modal state ──

const showForm = ref(false)
const editingItem = ref(null)

// Watch parent signals to open form
// ponytail: parent uses these internal methods via template ref. Upgrade to
// proper props/events when forms get complex enough to extract.
function openCreate() { editingItem.value = null; showForm.value = true }
function openEdit(row) { editingItem.value = row; showForm.value = true }
function closeForm() { showForm.value = false; editingItem.value = null }

// Listen for parent 'add'/'edit' events — QrddView handles gating
// ponytail: currently this component owns form state internally. The parent
// emits 'add'/'edit', we intercept via wrapper emits. If this gets unwieldy,
// lift form state to QrddView.

// For now, the tab directly opens the form on button click:
defineExpose({ openCreate, openEdit })

// Actually, we need a different approach. Let the tab emit 'add'/'edit' and
// the parent QrddView calls openCreate/openEdit via template ref.
// ponytail: simplify by embedding form in tab for now.

// We'll just intercept via the "add" button click. Since parent wires @add,
// we can use a local handler that opens the local form:
function onLocalAdd() {
  if (props.canCreate) {
    editingItem.value = null
    showForm.value = true
  }
}

function onLocalEdit(row) {
  if (props.canUpdate) {
    editingItem.value = row
    showForm.value = true
  }
}

// Save handler — delegate to parent
function onSave(formData) {
  if (editingItem.value) {
    emit('save-edit', editingItem.value.id, formData)
  } else {
    emit('save-create', formData)
  }
  // Parent closes modal on success via callback
  // ponytail: current approach — parent re-emits success by closing form
}

const columns = [
  { key: 'name', label: 'Name', sortable: true },
  { key: 'sof', label: 'SOF' },
  { key: 'percentage1', label: 'Allo Expense' },
  { key: 'percentage2', label: 'Receivable' },
  { key: 'updated_at', label: 'Updated' },
  { key: 'actions', label: '', width: '100px' },
]

function formatPct(val) {
  if (val == null) return '0'
  return Math.round(Number(val) * 100)
}

function formatDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}
</script>

<style scoped>
.tab__toolbar { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
.tab__search { flex: 1; max-width: 320px; }
.tab__add-btn {
  display: flex; align-items: center; gap: 6px;
  padding: 10px 20px; background: var(--cta-primary-bg, #FFBC25); color: var(--cta-primary-text, #1E1E1E);
  border: none; border-radius: var(--radius-pill, 999px); font-weight: 600; font-size: 13px;
  font-family: var(--font-body, 'Inter', sans-serif); cursor: pointer; transition: all 200ms; white-space: nowrap;
}
.tab__add-btn:hover { transform: translateY(-2px); }
.tab__card { padding: 0; overflow: hidden; }
.tab__sof-badge { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 11px; font-weight: 700; }
.tab__sof--prime { background: #E6E6FF; color: #0047B2; }
.tab__sof--paylater { background: #FFF3D6; color: #CC7000; }
.tab__pct { display: block; font-weight: 600; font-size: 13px; }
.tab__acct-num { font-family: 'SF Mono','Fira Code',monospace; font-size: 10px; color: var(--color-gray-400, #B3B3B3); display: block; }
.tab__date { font-size: 12px; color: var(--color-gray-400, #B3B3B3); font-variant-numeric: tabular-nums; }
.tab__actions { display: inline-flex; align-items: center; gap: 2px; }
.tab__edit-btn, .tab__del-btn {
  background: none; border: none; cursor: pointer; padding: 6px; border-radius: var(--radius-sm, 12px);
  display: inline-flex; align-items: center; justify-content: center; color: var(--color-gray-400, #B3B3B3);
  transition: all 200ms;
}
.tab__edit-btn:hover { color: var(--cta-primary-bg, #FFBC25); background: rgba(255,188,37,0.12); }
.tab__del-btn:hover { color: var(--color-red-400, #C83E3B); background: rgba(200,62,59,0.08); }
.tab__edit-btn .material-symbols-outlined, .tab__del-btn .material-symbols-outlined { font-size: 18px; }
.tab__pagination { display: flex; justify-content: center; padding: 16px; border-top: 1px solid rgba(0,0,0,0.04); }
</style>
```

> **ponytail note:** Due to Tab/Form complexity, the BuAccountsTab currently mixes concerns — it contains inline form-open logic and emits save-create/save-edit. This is acceptable for the first iteration. When forms grow complex (PromoRule already is), extract form state into the parent view.

Actually — simpler approach. Let me revise Task 7 to use a cleaner pattern. The tab emits `add`/`edit`/`delete`, and the parent QrddView opens a modal. The modal is rendered at QrddView level (like AdminUserModal pattern).

- [ ] **Step 1 (revised): Create BuAccountsTab.vue — simpler**

Create `src/modules/qrdd/components/BuAccountsTab.vue`:

```html
<template>
  <div class="tab">
    <div class="tab__toolbar">
      <LiTextField v-model="searchQueryProxy" placeholder="Search BU accounts..." iconLeft="search" class="tab__search" />
      <button v-if="canCreate" class="tab__add-btn" @click="$emit('add')">
        <span class="material-symbols-outlined">add</span>
        Add BU Account
      </button>
    </div>

    <LiGlassCard variant="light" size="md" :hoverable="false" class="tab__card">
      <LiTable :data="items" :columns="columns" :loading="loading" rowKey="id">
        <template #cell-sof="{ value }">
          <span class="tab__sof-badge" :class="'tab__sof--' + (value || '').toLowerCase()">{{ value }}</span>
        </template>
        <template #cell-percentage1="{ row }">
          <span class="tab__pct">{{ formatPct(row.percentage1) }}%</span>
          <small class="tab__acct-name">{{ row.acctname1 }}</small>
          <small class="tab__acct-num">{{ row.account1 }}</small>
        </template>
        <template #cell-percentage2="{ row }">
          <span class="tab__pct">{{ formatPct(row.percentage2) }}%</span>
          <small class="tab__acct-name">{{ row.acctname2 }}</small>
          <small class="tab__acct-num">{{ row.account2 }}</small>
        </template>
        <template #cell-updated_at="{ value }">
          <span class="tab__date">{{ formatDate(value) }}</span>
        </template>
        <template #cell-actions="{ row }">
          <div class="tab__actions">
            <button v-if="canUpdate" class="tab__edit-btn" @click="$emit('edit', row)" title="Edit"><span class="material-symbols-outlined">edit</span></button>
            <button v-if="canDelete" class="tab__del-btn" @click="$emit('delete', row)" title="Delete"><span class="material-symbols-outlined">delete</span></button>
          </div>
        </template>
      </LiTable>

      <LiEmptyState v-if="!loading && items.length === 0" icon="account_balance" title="No BU accounts"
        :description="searchQueryProxy ? 'Try a different search' : 'Add your first BU account.'" />

      <div v-if="totalPages > 1" class="tab__pagination">
        <LiPagination v-model="currentPageProxy" :totalPages="totalPages" />
      </div>
    </LiGlassCard>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import LiGlassCard from '@lib/components/LiGlassCard.vue'
import LiTable from '@lib/components/LiTable.vue'
import LiTextField from '@lib/components/LiTextField.vue'
import LiPagination from '@lib/components/LiPagination.vue'
import LiEmptyState from '@lib/components/LiEmptyState.vue'

const props = defineProps({
  items: Array, loading: Boolean,
  searchQuery: String, currentPage: Number, totalPages: Number,
  canCreate: Boolean, canUpdate: Boolean, canDelete: Boolean,
})
const emit = defineEmits(['update:searchQuery', 'update:currentPage', 'add', 'edit', 'delete'])

const searchQueryProxy = computed({ get: () => props.searchQuery, set: v => emit('update:searchQuery', v) })
const currentPageProxy = computed({ get: () => props.currentPage, set: v => emit('update:currentPage', v) })

const columns = [
  { key: 'name', label: 'Name', sortable: true },
  { key: 'sof', label: 'SOF' },
  { key: 'percentage1', label: 'Allo Expense' },
  { key: 'percentage2', label: 'Receivable' },
  { key: 'updated_at', label: 'Updated' },
  { key: 'actions', label: '', width: '100px' },
]

function formatPct(val) { return val != null ? Math.round(Number(val) * 100) : '0' }
function formatDate(d) { return d ? new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '—' }
</script>
```

- [ ] **Step 2: Create BuAccountForm.vue**

Create `src/modules/qrdd/components/BuAccountForm.vue` (modal form):

```html
<template>
  <LiModal :modelValue="true" :title="editing ? 'Edit BU Account' : 'Add BU Account'" size="md" @update:modelValue="$emit('close')">
    <div class="form">
      <LiTextField v-model="form.name" label="Name" placeholder="e.g. Antavaya" />
      <LiSelect v-model="form.sof" label="SOF" :options="sofOptions" placeholder="Select SOF..." />

      <div class="form__section"><span class="form__section-label">Allo Expense</span></div>
      <LiTextField v-model="form.account1" label="Account Number" placeholder="e.g. 101001360540601269000005" />
      <LiTextField v-model="form.acctname1" label="Account Name" placeholder="e.g. CTBU Prime Discount Expense - Antavaya" />
      <LiTextField v-model.number="form.percentage1" label="Percentage (%)" type="number" placeholder="50" />

      <div class="form__section"><span class="form__section-label">Receivable</span></div>
      <LiTextField v-model="form.account2" label="Account Number" placeholder="e.g. 101001360540601279000006" />
      <LiTextField v-model="form.acctname2" label="Account Name" placeholder="e.g. CTBU Prime Discount Receivable - Antavaya" />
      <LiTextField v-model.number="form.percentage2" label="Percentage (%)" type="number" placeholder="50" />

      <p v-if="pctError" class="form__error">{{ pctError }}</p>
    </div>
    <template #footer>
      <button class="form__btn form__btn--cancel" @click="$emit('close')">Cancel</button>
      <button class="form__btn form__btn--save" :disabled="!valid" @click="onSave">
        {{ editing ? 'Save Changes' : 'Create' }}
      </button>
    </template>
  </LiModal>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import LiModal from '@lib/components/LiModal.vue'
import LiTextField from '@lib/components/LiTextField.vue'
import LiSelect from '@lib/components/LiSelect.vue'

const props = defineProps({ editing: Object }) // null = create, row object = edit
const emit = defineEmits(['save', 'close'])

const sofOptions = [
  { label: 'PRIME', value: 'PRIME' },
  { label: 'PAYLATER', value: 'PAYLATER' },
]

const form = reactive({
  name: '', sof: 'PRIME',
  account1: '', acctname1: '', percentage1: 50,
  account2: '', acctname2: '', percentage2: 50,
})

const valid = computed(() => {
  return form.name.trim() && form.sof &&
    form.account1.trim() && form.acctname1.trim() &&
    form.account2.trim() && form.acctname2.trim() &&
    Number(form.percentage1) > 0 && Number(form.percentage2) > 0 &&
    Math.abs(Number(form.percentage1) + Number(form.percentage2) - 100) < 0.01
})

const pctError = computed(() => {
  const p1 = Number(form.percentage1) || 0
  const p2 = Number(form.percentage2) || 0
  const sum = p1 + p2
  if (p1 > 0 && p2 > 0 && Math.abs(sum - 100) >= 0.01) {
    return `Percentages must sum to 100% (currently ${sum}%)`
  }
  return null
})

onMounted(() => {
  if (props.editing) {
    form.name = props.editing.name
    form.sof = props.editing.sof
    form.account1 = props.editing.account1
    form.acctname1 = props.editing.acctname1
    form.percentage1 = Math.round(Number(props.editing.percentage1) * 100)
    form.account2 = props.editing.account2
    form.acctname2 = props.editing.acctname2
    form.percentage2 = Math.round(Number(props.editing.percentage2) * 100)
  }
})

function onSave() {
  if (!valid.value) return
  emit('save', { ...form })
  emit('close')
}
</script>

<style scoped>
.form { display: flex; flex-direction: column; gap: 12px; }
.form__section { border-top: 1px solid rgba(0,0,0,0.06); padding-top: 8px; margin-top: 4px; }
.form__section-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: var(--color-gray-400, #B3B3B3); }
.form__error { color: var(--color-red-400, #C83E3B); font-size: 12px; font-weight: 500; margin: 0; }
.form__btn { display: inline-flex; align-items: center; gap: 6px; padding: 8px 18px; border: 1px solid transparent; border-radius: var(--radius-pill, 999px); font-family: var(--font-body, 'Inter', sans-serif); font-size: 13px; font-weight: 600; cursor: pointer; transition: all 200ms; }
.form__btn--cancel { color: var(--color-gray-700, #666); border-color: rgba(0,0,0,0.1); background: transparent; }
.form__btn--cancel:hover { background: rgba(0,0,0,0.04); }
.form__btn--save { color: var(--cta-primary-text, #1E1E1E); background: var(--cta-primary-bg, #FFBC25); border-color: var(--cta-primary-bg, #FFBC25); }
.form__btn--save:hover { transform: translateY(-1px); }
.form__btn--save:disabled { opacity: 0.4; cursor: not-allowed; }
</style>
```

- [ ] **Step 3: Commit**

```bash
git add src/modules/qrdd/components/BuAccountsTab.vue src/modules/qrdd/components/BuAccountForm.vue
git commit -m "feat(qrdd): add BuAccountsTab and BuAccountForm components

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 8: MerchantWhitelistTab + MerchantForm Components

**Files:**
- Create: `src/modules/qrdd/components/MerchantWhitelistTab.vue`
- Create: `src/modules/qrdd/components/MerchantForm.vue`

- [ ] **Step 1: Create MerchantWhitelistTab.vue**

Create `src/modules/qrdd/components/MerchantWhitelistTab.vue`:

```html
<template>
  <div class="tab">
    <div class="tab__toolbar">
      <LiTextField v-model="searchQueryProxy" placeholder="Search merchants..." iconLeft="search" class="tab__search" />
      <button v-if="canCreate" class="tab__add-btn" @click="$emit('add')">
        <span class="material-symbols-outlined">add</span>
        Add Merchant
      </button>
    </div>

    <LiGlassCard variant="light" size="md" :hoverable="false" class="tab__card">
      <LiTable :data="items" :columns="columns" :loading="loading" rowKey="id">
        <template #cell-merchant_id="{ value }">
          <span class="tab__code">{{ value }}</span>
        </template>
        <template #cell-status="{ value }">
          <span class="tab__status" :class="'tab__status--' + (value || 'active').toLowerCase()">{{ value }}</span>
        </template>
        <template #cell-created_at="{ value }">
          <span class="tab__date">{{ formatDate(value) }}</span>
        </template>
        <template #cell-created_by="{ row }">
          <span class="tab__meta">{{ row.created_by }}<br><small>{{ formatDate(row.created_at) }}</small></span>
        </template>
        <template #cell-updated_at="{ row }">
          <span class="tab__meta">{{ row.updated_by }}<br><small>{{ formatDate(row.updated_at) }}</small></span>
        </template>
        <template #cell-actions="{ row }">
          <div class="tab__actions">
            <button v-if="canUpdate" class="tab__edit-btn" @click="$emit('edit', row)" title="Edit"><span class="material-symbols-outlined">edit</span></button>
            <button v-if="canDelete" class="tab__del-btn" @click="$emit('delete', row)" title="Delete"><span class="material-symbols-outlined">delete</span></button>
          </div>
        </template>
      </LiTable>

      <LiEmptyState v-if="!loading && items.length === 0" icon="store" title="No merchants"
        :description="searchQueryProxy ? 'Try a different search' : 'Add your first merchant.'" />

      <div v-if="totalPages > 1" class="tab__pagination">
        <LiPagination v-model="currentPageProxy" :totalPages="totalPages" />
      </div>
    </LiGlassCard>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import LiGlassCard from '@lib/components/LiGlassCard.vue'
import LiTable from '@lib/components/LiTable.vue'
import LiTextField from '@lib/components/LiTextField.vue'
import LiPagination from '@lib/components/LiPagination.vue'
import LiEmptyState from '@lib/components/LiEmptyState.vue'

const props = defineProps({
  items: Array, loading: Boolean,
  searchQuery: String, currentPage: Number, totalPages: Number,
  buNameOptions: Array,
  canCreate: Boolean, canUpdate: Boolean, canDelete: Boolean,
})
const emit = defineEmits(['update:searchQuery', 'update:currentPage', 'add', 'edit', 'delete'])

const searchQueryProxy = computed({ get: () => props.searchQuery, set: v => emit('update:searchQuery', v) })
const currentPageProxy = computed({ get: () => props.currentPage, set: v => emit('update:currentPage', v) })

const columns = [
  { key: 'merchant_id', label: 'Merchant ID', sortable: true },
  { key: 'merchant_name', label: 'Merchant Name', sortable: true },
  { key: 'bu_name', label: 'BU Name' },
  { key: 'status', label: 'Status' },
  { key: 'created_by', label: 'Created' },
  { key: 'updated_at', label: 'Updated' },
  { key: 'actions', label: '', width: '100px' },
]

function formatDate(d) { return d ? new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '—' }
</script>
```

- [ ] **Step 2: Create MerchantForm.vue**

Create `src/modules/qrdd/components/MerchantForm.vue`:

```html
<template>
  <LiModal :modelValue="true" :title="editing ? 'Edit Merchant' : 'Add Merchant'" size="md" @update:modelValue="$emit('close')">
    <div class="form">
      <LiTextField v-model="form.merchant_id" label="Merchant ID" placeholder="e.g. 000885002405722" />
      <LiTextField v-model="form.merchant_name" label="Merchant Name" placeholder="e.g. C&F TSM Cibubur" />
      <LiSelect v-model="form.bu_name" label="BU Name" :options="buNameOptions" placeholder="Select BU..." />
      <LiSelect v-model="form.status" label="Status" :options="statusOptions" />
    </div>
    <template #footer>
      <button class="form__btn form__btn--cancel" @click="$emit('close')">Cancel</button>
      <button class="form__btn form__btn--save" :disabled="!valid" @click="onSave">
        {{ editing ? 'Save Changes' : 'Create' }}
      </button>
    </template>
  </LiModal>
</template>

<script setup>
import { reactive, computed, onMounted } from 'vue'
import LiModal from '@lib/components/LiModal.vue'
import LiTextField from '@lib/components/LiTextField.vue'
import LiSelect from '@lib/components/LiSelect.vue'

const props = defineProps({ editing: Object, buNameOptions: { type: Array, default: () => [] } })
const emit = defineEmits(['save', 'close'])

const statusOptions = [
  { label: 'ACTIVE', value: 'ACTIVE' },
  { label: 'INACTIVE', value: 'INACTIVE' },
]

const form = reactive({ merchant_id: '', merchant_name: '', bu_name: '', status: 'ACTIVE' })

const valid = computed(() => form.merchant_id.trim() && form.merchant_name.trim() && form.bu_name)

onMounted(() => {
  if (props.editing) {
    form.merchant_id = props.editing.merchant_id
    form.merchant_name = props.editing.merchant_name
    form.bu_name = props.editing.bu_name
    form.status = props.editing.status
  }
})

function onSave() {
  if (!valid.value) return
  emit('save', { ...form })
  emit('close')
}
</script>

<style scoped>
.form { display: flex; flex-direction: column; gap: 12px; }
.form__btn { display: inline-flex; align-items: center; gap: 6px; padding: 8px 18px; border: 1px solid transparent; border-radius: var(--radius-pill, 999px); font-family: var(--font-body, 'Inter', sans-serif); font-size: 13px; font-weight: 600; cursor: pointer; transition: all 200ms; }
.form__btn--cancel { color: var(--color-gray-700, #666); border-color: rgba(0,0,0,0.1); background: transparent; }
.form__btn--cancel:hover { background: rgba(0,0,0,0.04); }
.form__btn--save { color: var(--cta-primary-text, #1E1E1E); background: var(--cta-primary-bg, #FFBC25); border-color: var(--cta-primary-bg, #FFBC25); }
.form__btn--save:hover { transform: translateY(-1px); }
.form__btn--save:disabled { opacity: 0.4; cursor: not-allowed; }
</style>
```

- [ ] **Step 3: Commit**

```bash
git add src/modules/qrdd/components/MerchantWhitelistTab.vue src/modules/qrdd/components/MerchantForm.vue
git commit -m "feat(qrdd): add MerchantWhitelistTab and MerchantForm components

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 9: PromoRuleTab + PromoRuleForm Components

**Files:**
- Create: `src/modules/qrdd/components/PromoRuleTab.vue`
- Create: `src/modules/qrdd/components/PromoRuleForm.vue`

- [ ] **Step 1: Create PromoRuleTab.vue**

Create `src/modules/qrdd/components/PromoRuleTab.vue`:

```html
<template>
  <div class="tab">
    <div class="tab__toolbar">
      <div class="tab__search-row">
        <LiSelect v-model="searchColumnProxy" :options="searchColumns" class="tab__search-col" />
        <LiTextField v-model="searchQueryProxy" :placeholder="'Search ' + searchColumnLabel + '...'" iconLeft="search" class="tab__search" />
      </div>
      <button v-if="canCreate" class="tab__add-btn" @click="$emit('add')">
        <span class="material-symbols-outlined">add</span>
        Add Promo
      </button>
    </div>

    <LiGlassCard variant="light" size="md" :hoverable="false" class="tab__card">
      <LiTable :data="items" :columns="columns" :loading="loading" rowKey="promo_id">
        <template #cell-promo_id="{ value }">
          <span class="tab__code">{{ value }}</span>
        </template>
        <template #cell-merchant_id="{ value }">
          <span v-if="value" class="tab__code">{{ value }}</span>
          <span v-else class="tab__all">All Merchants</span>
        </template>
        <template #cell-discount="{ row }">
          <span class="tab__discount">
            PRM: {{ row.prm_discount_value }}{{ row.prm_discount_type === 'PERCENTAGE' ? '%' : '' }}
            / PL: {{ row.pl_discount_value }}{{ row.pl_discount_type === 'PERCENTAGE' ? '%' : '' }}
          </span>
        </template>
        <template #cell-dates="{ row }">
          <span class="tab__date">{{ fmt(row.start_date) }} – {{ fmt(row.end_date) }}</span>
        </template>
        <template #cell-status="{ value }">
          <span class="tab__status" :class="'tab__status--' + (value || 'active').toLowerCase()">{{ value }}</span>
        </template>
        <template #cell-actions="{ row }">
          <div class="tab__actions">
            <button v-if="canUpdate" class="tab__edit-btn" @click="$emit('edit', row)" title="Edit"><span class="material-symbols-outlined">edit</span></button>
            <button v-if="canDelete" class="tab__del-btn" @click="$emit('delete', row)" title="Delete"><span class="material-symbols-outlined">delete</span></button>
          </div>
        </template>
      </LiTable>

      <LiEmptyState v-if="!loading && items.length === 0" icon="discount" title="No promo rules"
        :description="searchQueryProxy ? 'Try a different search' : 'Add your first promo rule.'" />

      <div v-if="totalPages > 1" class="tab__pagination">
        <LiPagination v-model="currentPageProxy" :totalPages="totalPages" />
      </div>
    </LiGlassCard>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import LiGlassCard from '@lib/components/LiGlassCard.vue'
import LiTable from '@lib/components/LiTable.vue'
import LiTextField from '@lib/components/LiTextField.vue'
import LiSelect from '@lib/components/LiSelect.vue'
import LiPagination from '@lib/components/LiPagination.vue'
import LiEmptyState from '@lib/components/LiEmptyState.vue'

const props = defineProps({
  items: Array, loading: Boolean,
  searchQuery: String, searchColumn: String,
  currentPage: Number, totalPages: Number,
  merchantOptions: Array, buNameOptions: Array,
  canCreate: Boolean, canUpdate: Boolean, canDelete: Boolean,
})
const emit = defineEmits(['update:searchQuery', 'update:searchColumn', 'update:currentPage', 'add', 'edit', 'delete'])

const searchQueryProxy = computed({ get: () => props.searchQuery, set: v => emit('update:searchQuery', v) })
const searchColumnProxy = computed({ get: () => props.searchColumn, set: v => emit('update:searchColumn', v) })
const currentPageProxy = computed({ get: () => props.currentPage, set: v => emit('update:currentPage', v) })

const searchColumns = [
  { label: 'Promo ID', value: 'promo_id' },
  { label: 'Name', value: 'promo_name' },
  { label: 'Merchant ID', value: 'merchant_id' },
  { label: 'BU Name', value: 'bu_name' },
]

const searchColumnLabel = computed(() => {
  const c = searchColumns.find(c => c.value === props.searchColumn)
  return c ? c.label.toLowerCase() : 'promo id'
})

const columns = [
  { key: 'promo_id', label: 'Promo ID' },
  { key: 'promo_name', label: 'Name' },
  { key: 'merchant_id', label: 'Merchant' },
  { key: 'bu_name', label: 'BU' },
  { key: 'discount', label: 'Discounts' },
  { key: 'dates', label: 'Period' },
  { key: 'priority', label: 'Pri' },
  { key: 'status', label: 'Status' },
  { key: 'actions', label: '', width: '100px' },
]

function fmt(d) { return d || '—' }
</script>

<style scoped>
.tab__toolbar { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
.tab__search-row { display: flex; align-items: center; gap: 8px; flex: 1; max-width: 420px; }
.tab__search-col { width: 140px; flex-shrink: 0; }
.tab__search { flex: 1; }
.tab__add-btn {
  display: flex; align-items: center; gap: 6px;
  padding: 10px 20px; background: var(--cta-primary-bg, #FFBC25); color: var(--cta-primary-text, #1E1E1E);
  border: none; border-radius: var(--radius-pill, 999px); font-weight: 600; font-size: 13px;
  font-family: var(--font-body, 'Inter', sans-serif); cursor: pointer; transition: all 200ms; white-space: nowrap;
}
.tab__add-btn:hover { transform: translateY(-2px); }
.tab__card { padding: 0; overflow: hidden; }
.tab__code { font-family: 'SF Mono','Fira Code',monospace; font-size: 12px; color: var(--color-gray-700, #666); }
.tab__all { font-size: 12px; color: var(--color-gray-400, #B3B3B3); font-style: italic; }
.tab__discount { font-size: 12px; }
.tab__date { font-size: 12px; color: var(--color-gray-400, #B3B3B3); }
.tab__status { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 11px; font-weight: 700; }
.tab__status--active { background: #E6F4EA; color: #137333; }
.tab__status--inactive { background: #F1F3F4; color: #5F6368; }
.tab__actions { display: inline-flex; align-items: center; gap: 2px; }
.tab__edit-btn, .tab__del-btn {
  background: none; border: none; cursor: pointer; padding: 6px; border-radius: var(--radius-sm, 12px);
  display: inline-flex; align-items: center; justify-content: center; color: var(--color-gray-400, #B3B3B3);
  transition: all 200ms;
}
.tab__edit-btn:hover { color: var(--cta-primary-bg, #FFBC25); background: rgba(255,188,37,0.12); }
.tab__del-btn:hover { color: var(--color-red-400, #C83E3B); background: rgba(200,62,59,0.08); }
.tab__edit-btn .material-symbols-outlined, .tab__del-btn .material-symbols-outlined { font-size: 18px; }
.tab__pagination { display: flex; justify-content: center; padding: 16px; border-top: 1px solid rgba(0,0,0,0.04); }
</style>
```

- [ ] **Step 2: Create PromoRuleForm.vue**

Create `src/modules/qrdd/components/PromoRuleForm.vue`:

```html
<template>
  <LiModal :modelValue="true" :title="editing ? 'Edit Promo Rule' : 'Add Promo Rule'" size="lg" @update:modelValue="$emit('close')">
    <div class="form">
      <!-- Section: Basic -->
      <div class="form__section"><span class="form__section-label">Basic Info</span></div>
      <div class="form__row">
        <LiTextField v-model="form.promo_id" label="Promo ID" placeholder="e.g. antavaya_promo_2026_01" :disabled="!!editing" />
        <LiTextField v-model="form.promo_name" label="Promo Name" placeholder="e.g. Antavaya Promo 2026" />
      </div>
      <div class="form__row">
        <LiSelect v-model="form.merchant_id" label="Merchant" :options="merchantIdOptions" placeholder="All Merchants" />
        <LiSelect v-model="form.bu_name" label="BU Name" :options="buNameOptions" placeholder="Select BU..." />
      </div>
      <div class="form__row">
        <LiTextField v-model="form.start_date" label="Start Date" type="date" />
        <LiTextField v-model="form.end_date" label="End Date" type="date" />
      </div>

      <!-- Section: PRM Discount -->
      <div class="form__section"><span class="form__section-label">PRM Discount</span></div>
      <div class="form__row">
        <LiSelect v-model="form.prm_discount_type" label="Type" :options="discountTypeOptions" />
        <LiTextField v-model.number="form.prm_discount_value" label="Value" type="number" :suffix="form.prm_discount_type === 'PERCENTAGE' ? '%' : ''" />
      </div>
      <div class="form__row">
        <LiTextField v-model.number="form.prm_max_discount" label="Max Discount" type="number" :disabled="form.prm_unlimited" />
        <label class="form__toggle-label">
          <input type="checkbox" v-model="form.prm_unlimited" />
          Unlimited
        </label>
      </div>

      <!-- Section: PL Discount -->
      <div class="form__section"><span class="form__section-label">PL Discount</span></div>
      <div class="form__row">
        <LiSelect v-model="form.pl_discount_type" label="Type" :options="discountTypeOptions" />
        <LiTextField v-model.number="form.pl_discount_value" label="Value" type="number" :suffix="form.pl_discount_type === 'PERCENTAGE' ? '%' : ''" />
      </div>
      <div class="form__row">
        <LiTextField v-model.number="form.pl_max_discount" label="Max Discount" type="number" :disabled="form.pl_unlimited" />
        <label class="form__toggle-label"><input type="checkbox" v-model="form.pl_unlimited" /> Unlimited</label>
      </div>

      <!-- Section: Limits -->
      <div class="form__section"><span class="form__section-label">Limits</span></div>
      <div class="form__row">
        <LiTextField v-model.number="form.min_txn_amount" label="Min Transaction" type="number" :disabled="form.min_no_minimum" />
        <label class="form__toggle-label"><input type="checkbox" v-model="form.min_no_minimum" /> No minimum</label>
      </div>
      <div class="form__row">
        <LiTextField v-model.number="form.max_txn_amount" label="Max Transaction" type="number" :disabled="form.max_unlimited" />
        <label class="form__toggle-label"><input type="checkbox" v-model="form.max_unlimited" /> Unlimited</label>
      </div>
      <div class="form__row">
        <LiTextField v-model.number="form.budget_amount" label="Budget" type="number" :disabled="form.budget_unlimited" />
        <label class="form__toggle-label"><input type="checkbox" v-model="form.budget_unlimited" /> Unlimited</label>
      </div>

      <!-- Section: Meta -->
      <div class="form__section"><span class="form__section-label">Meta</span></div>
      <div class="form__row">
        <LiTextField v-model.number="form.priority" label="Priority" type="number" />
        <LiSelect v-model="form.status" label="Status" :options="statusOptions" />
      </div>
    </div>
    <template #footer>
      <button class="form__btn form__btn--cancel" @click="$emit('close')">Cancel</button>
      <button class="form__btn form__btn--save" :disabled="!valid" @click="onSave">
        {{ editing ? 'Save Changes' : 'Create' }}
      </button>
    </template>
  </LiModal>
</template>

<script setup>
import { reactive, computed, onMounted } from 'vue'
import LiModal from '@lib/components/LiModal.vue'
import LiTextField from '@lib/components/LiTextField.vue'
import LiSelect from '@lib/components/LiSelect.vue'

const props = defineProps({
  editing: Object,
  merchantOptions: { type: Array, default: () => [] },
  buNameOptions: { type: Array, default: () => [] },
})
const emit = defineEmits(['save', 'close'])

const discountTypeOptions = [
  { label: 'PERCENTAGE', value: 'PERCENTAGE' },
  { label: 'FIXED', value: 'FIXED' },
]
const statusOptions = [
  { label: 'ACTIVE', value: 'ACTIVE' },
  { label: 'INACTIVE', value: 'INACTIVE' },
]

// Merchant dropdown with "All" option
const merchantIdOptions = computed(() => [
  { label: 'All Merchants', value: '' },
  ...props.merchantOptions,
])

const form = reactive({
  promo_id: '', promo_name: '',
  merchant_id: '', bu_name: '',
  start_date: '', end_date: '',
  prm_discount_type: 'PERCENTAGE', prm_discount_value: 0, prm_max_discount: 0, prm_unlimited: false,
  pl_discount_type: 'PERCENTAGE', pl_discount_value: 0, pl_max_discount: 0, pl_unlimited: false,
  min_txn_amount: 1, min_no_minimum: true,
  max_txn_amount: null, max_unlimited: true,
  budget_amount: null, budget_unlimited: true,
  priority: 0, status: 'ACTIVE',
})

const valid = computed(() => {
  return form.promo_id.trim() && form.promo_name.trim() && form.bu_name &&
    form.start_date && form.end_date &&
    Number(form.prm_discount_value) >= 0 && Number(form.pl_discount_value) >= 0
})

onMounted(() => {
  if (props.editing) {
    const e = props.editing
    form.promo_id = e.promo_id
    form.promo_name = e.promo_name
    form.merchant_id = e.merchant_id || ''
    form.bu_name = e.bu_name
    form.start_date = e.start_date
    form.end_date = e.end_date
    form.prm_discount_type = e.prm_discount_type
    form.prm_discount_value = Number(e.prm_discount_value)
    form.prm_max_discount = Number(e.prm_max_discount)
    form.prm_unlimited = Number(e.prm_max_discount) >= 49999999999
    form.pl_discount_type = e.pl_discount_type
    form.pl_discount_value = Number(e.pl_discount_value)
    form.pl_max_discount = Number(e.pl_max_discount)
    form.pl_unlimited = Number(e.pl_max_discount) >= 49999999999
    form.min_txn_amount = Number(e.min_txn_amount)
    form.min_no_minimum = Number(e.min_txn_amount) <= 1
    form.max_txn_amount = e.max_txn_amount ? Number(e.max_txn_amount) : null
    form.max_unlimited = e.max_txn_amount == null
    form.budget_amount = e.budget_amount ? Number(e.budget_amount) : null
    form.budget_unlimited = e.budget_amount == null
    form.priority = e.priority
    form.status = e.status
  }
})

function onSave() {
  if (!valid.value) return
  emit('save', { ...form })
  emit('close')
}
</script>

<style scoped>
.form { display: flex; flex-direction: column; gap: 12px; max-height: 60vh; overflow-y: auto; }
.form__section { border-top: 1px solid rgba(0,0,0,0.06); padding-top: 8px; margin-top: 4px; }
.form__section-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: var(--color-gray-400, #B3B3B3); }
.form__row { display: flex; gap: 12px; align-items: flex-end; }
.form__row > * { flex: 1; }
.form__toggle-label { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--color-gray-600, #888); white-space: nowrap; flex: 0 0 auto; cursor: pointer; }
.form__btn { display: inline-flex; align-items: center; gap: 6px; padding: 8px 18px; border: 1px solid transparent; border-radius: var(--radius-pill, 999px); font-family: var(--font-body, 'Inter', sans-serif); font-size: 13px; font-weight: 600; cursor: pointer; transition: all 200ms; }
.form__btn--cancel { color: var(--color-gray-700, #666); border-color: rgba(0,0,0,0.1); background: transparent; }
.form__btn--cancel:hover { background: rgba(0,0,0,0.04); }
.form__btn--save { color: var(--cta-primary-text, #1E1E1E); background: var(--cta-primary-bg, #FFBC25); border-color: var(--cta-primary-bg, #FFBC25); }
.form__btn--save:hover { transform: translateY(-1px); }
.form__btn--save:disabled { opacity: 0.4; cursor: not-allowed; }
</style>
```

- [ ] **Step 3: Commit**

```bash
git add src/modules/qrdd/components/PromoRuleTab.vue src/modules/qrdd/components/PromoRuleForm.vue
git commit -m "feat(qrdd): add PromoRuleTab and PromoRuleForm with sentinel toggles

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 10: QrddView — Wire Form Modals + Save Handlers

**Files:**
- Modify: `src/modules/qrdd/views/QrddView.vue`

**Interfaces:**
- Consumes: Already created composables and tab components

- [ ] **Step 1: Read current QrddView and add form modal rendering + save handlers**

The QrddView created in Task 6 has handlers (`onAddBuAccount`, `onEditBuAccount`, etc.) but they don't render the form modals yet. Add modal rendering and save handlers.

Add after the `</Transition>` closing tag and before the Delete Confirm modal:

```html
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
```

Add imports at the top of `<script setup>`:
```js
import BuAccountForm from '../components/BuAccountForm.vue'
import MerchantForm from '../components/MerchantForm.vue'
import PromoRuleForm from '../components/PromoRuleForm.vue'
```

Add save/close handlers after the existing delete handler functions:

```js
function closeBuForm() { showBuForm.value = false; editingBu.value = null }
function closeMwForm() { showMwForm.value = false; editingMw.value = null }
function closePrForm() { showPrForm.value = false; editingPr.value = null }

async function onSaveBuAccount(formData) {
  if (editingBu.value) {
    await buAccounts.updateItem(editingBu.value.id, formData)
  } else {
    await buAccounts.createItem(formData)
  }
  closeBuForm()
}

async function onSaveMerchant(formData) {
  if (editingMw.value) {
    await mw.updateItem(editingMw.value.id, formData)
  } else {
    await mw.createItem(formData)
  }
  closeMwForm()
}

async function onSavePromo(formData) {
  if (editingPr.value) {
    await pr.updateItem(editingPr.value.promo_id, formData)
  } else {
    await pr.createItem(formData)
  }
  closePrForm()
}
```

- [ ] **Step 2: Commit**

```bash
git add src/modules/qrdd/views/QrddView.vue
git commit -m "feat(qrdd): wire form modals and save handlers in QrddView

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 11: Build + Integration Check

**No files changed.** Manual verification via `npm run build`.

- [ ] **Step 1: Build**

```bash
npm run build
```
Expected: `✓ built in ...` — no errors.

- [ ] **Step 2: Verify module registration**

- Open app, login as admin
- Expected: "QR DD" appears in sidebar with database icon
- Click "QR DD" → navigates to `/qrdd`
- Expected: 3 tabs — BU Accounts, Merchant Whitelist, Promo Rule

- [ ] **Step 3: Test BU Accounts CRUD**

1. Click "Add BU Account"
2. Fill form: name=Test BU, sof=PRIME, both account numbers + names, percentage1=50, percentage2=50
3. Click "Create" → toast success, row appears
4. Click edit → change name → "Save Changes" → toast success
5. Click delete → confirm → toast success, row removed
6. Try creating same name again → toast "already exists"

- [ ] **Step 4: Test Merchant Whitelist CRUD**

1. Click "Add Merchant"
2. Fill: merchant_id=TEST001, merchant_name=Test Merchant, bu_name=Test BU (from dropdown)
3. Create, edit, delete — verify all work
4. Try creating duplicate merchant_id → toast error

- [ ] **Step 5: Test Promo Rule CRUD**

1. Click "Add Promo"
2. Fill form with all sections
3. Toggle "Unlimited" on PRM max → text field disables
4. Toggle "No minimum" on min transaction → text field disables
5. Create, edit, delete — verify sentinel values save correctly

- [ ] **Step 6: Test search + pagination**

1. Add 12+ BU accounts
2. Verify pagination appears (10/page)
3. Search by name — list filters, page resets to 1
4. In Promo Rule tab, switch search column to "Name" and search
