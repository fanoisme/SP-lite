<template>
  <section class="ddpromo">
    <header class="ddpromo__head">
      <div>
        <h1 class="ddpromo__title">Promo Rules</h1>
        <p class="ddpromo__sub">Discount rules across every business unit.</p>
      </div>
      <div class="ddpromo__actions">
        <p class="ddpromo__count">{{ total }} {{ total === 1 ? 'rule' : 'rules' }}</p>
        <button class="ddpromo__ghost" type="button" :disabled="exporting" @click="exportXlsx">
          <span class="material-symbols-outlined">file_save</span>
          Export XLSX
        </button>
        <button v-if="canCreate" class="ddpromo__ghost" type="button" @click="showBulk = true">
          <span class="material-symbols-outlined">upload</span>
          Bulk Upload
        </button>
        <button v-if="canCreate" class="ddpromo__add" type="button" @click="openCreate">
          <span class="material-symbols-outlined">add</span>
          Add Promo
        </button>
      </div>
    </header>

    <!-- Someone else wrote to qrdd_promo_rules while this page was open. The
         page is not reloaded from under the reader — they may be mid-edit. -->
    <div v-if="stale && !staleDismissed" class="ddpromo__stale">
      <span class="material-symbols-outlined">sync_problem</span>
      <span class="ddpromo__stale-text">
        {{ staleCount }} {{ staleCount === 1 ? 'change' : 'changes' }}
        <template v-if="staleBy"> by {{ staleBy }}</template>
        since this page loaded.
      </span>
      <button class="ddpromo__stale-btn" type="button" @click="refresh">Reload</button>
      <button class="ddpromo__stale-x" type="button" aria-label="Dismiss" @click="staleDismissed = true">
        <span class="material-symbols-outlined">close</span>
      </button>
    </div>

    <div class="ddpromo__filters">
      <LiTextField v-model="search" placeholder="Search promo, merchant or BU…" />
      <LiSelect v-model="statusFilter" :options="statusOptions" placeholder="All statuses" />
      <LiSelect v-model="buFilter" :options="buOptions" placeholder="All business units" />
      <LiSelect v-model="period" :options="PERIOD_OPTIONS" placeholder="All periods" />
      <button class="ddpromo__reset" type="button" @click="resetAll">Reset</button>
    </div>

    <p v-if="error" class="ddpromo__error">{{ error }}</p>

    <LiTable
      :data="rows"
      :columns="tableColumns"
      row-key="promo_id"
      :loading="loading"
      @sort="onSort"
    >
      <template #cell-promo_id="{ value }">
        <code class="ddpromo__code">{{ value }}</code>
      </template>

      <template #cell-promo_name="{ value }">
        <span class="ddpromo__name">{{ value }}</span>
      </template>

      <template #cell-merchant_id="{ value }">
        <code v-if="value" class="ddpromo__code">{{ value }}</code>
        <span v-else class="ddpromo__muted">All merchants</span>
      </template>

      <template #cell-bu_name="{ value }">
        <LiBadge :label="value" variant="brand" size="sm" is-pill />
      </template>

      <template #cell-period="{ row }">
        <span class="ddpromo__period">
          <span class="ddpromo__dates">{{ formatDate(row.start_date) }} – {{ formatDate(row.end_date) }}</span>
          <LiBadge
            v-if="periodBadge(row)"
            :label="periodBadge(row).label"
            :variant="periodBadge(row).variant"
            size="sm"
            is-pill
          />
        </span>
      </template>

      <template #cell-prime="{ row }">
        <span v-if="discount(row, 'prm')">{{ discount(row, 'prm') }}</span>
        <span v-else class="ddpromo__muted">Not eligible</span>
      </template>

      <template #cell-paylater="{ row }">
        <span v-if="discount(row, 'pl')">{{ discount(row, 'pl') }}</span>
        <span v-else class="ddpromo__muted">Not eligible</span>
      </template>

      <template #cell-min_txn_amount="{ value }">{{ formatMinAmount(value) }}</template>
      <!-- Blank means "no ceiling" for these two, so an em dash would read as
           missing data when it is in fact a decision. -->
      <template #cell-max_txn_amount="{ value }">
        <span v-if="value == null" class="ddpromo__muted">Unlimited</span>
        <span v-else>{{ formatAmount(value) }}</span>
      </template>
      <template #cell-budget_amount="{ value }">
        <span v-if="value == null" class="ddpromo__muted">Unlimited</span>
        <span v-else>{{ formatAmount(value) }}</span>
      </template>

      <!-- Read-only on purpose, where DD had an inline LiToggle. DD could patch
           one cell; the only write path here is updateRow, which rewrites the
           whole row — so a toggle would either need a second, unaudited path or
           would spend a full round-trip and an audit entry per flick. Status is
           edited in the form, alongside the dates it interacts with. -->
      <template #cell-status="{ value }">
        <LiBadge :label="value" :variant="value === 'ACTIVE' ? 'success' : 'neutral'" size="sm" is-pill />
      </template>

      <template #cell-updated_at="{ row }">
        <span class="ddpromo__meta">
          {{ formatRelative(row.updated_at) }}
          <template v-if="row.updated_by"><br />{{ row.updated_by }}</template>
        </span>
      </template>

      <template #cell-actions="{ row }">
        <div class="ddpromo__row-actions">
          <button v-if="canUpdate" class="ddpromo__icon" type="button" title="Edit" @click="openEdit(row)">
            <span class="material-symbols-outlined">edit</span>
          </button>
          <button v-if="canCreate" class="ddpromo__icon" type="button" title="Duplicate" @click="openDuplicate(row)">
            <span class="material-symbols-outlined">content_copy</span>
          </button>
          <button
            v-if="canDelete"
            class="ddpromo__icon ddpromo__icon--danger"
            type="button"
            title="Delete"
            @click="askDelete(row)"
          >
            <span class="material-symbols-outlined">delete</span>
          </button>
        </div>
      </template>
    </LiTable>

    <LiEmptyState
      v-if="!loading && !rows.length"
      icon="sell"
      :title="hasFilters ? 'No promo matches these filters' : 'No promo rules yet'"
      :description="hasFilters
        ? 'Adjust or reset the filters above.'
        : 'Create the first discount rule to get started.'"
      size="sm"
    />

    <div v-if="totalPages > 1" class="ddpromo__pagination">
      <LiPagination v-model="currentPage" :total-pages="totalPages" />
    </div>

    <DdPromoForm
      v-model="showForm"
      :row="editRow"
      :duplicate-of="duplicateRow"
      @saved="load"
    />

    <DdBulkUpload v-model="showBulk" table-id="promos" :bulk-upsert="bulkUpsert" @done="load" />

    <LiModal v-model="showDelete" title="Delete promo rule" size="sm">
      <p class="ddpromo__confirm">
        Delete <strong>{{ deleteRowTarget?.promo_name }}</strong>
        (<code class="ddpromo__code">{{ deleteRowTarget?.promo_id }}</code>)? This cannot be undone.
      </p>
      <template #footer>
        <LiButton variant="ghost" @click="showDelete = false">Cancel</LiButton>
        <LiButton variant="danger" :loading="saving" @click="confirmDelete">Delete</LiButton>
      </template>
    </LiModal>
  </section>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import LiTable from '@lib/components/LiTable.vue'
import LiPagination from '@lib/components/LiPagination.vue'
import LiSelect from '@lib/components/LiSelect.vue'
import LiTextField from '@lib/components/LiTextField.vue'
import LiBadge from '@lib/components/LiBadge.vue'
import LiButton from '@lib/components/LiButton.vue'
import LiModal from '@lib/components/LiModal.vue'
import LiEmptyState from '@lib/components/LiEmptyState.vue'
import { exportToXlsx } from '@lib/export-xlsx.js'
import { useToast } from '@lib/composables/useToast.js'
import { supabase } from '@/lib/supabase.js'
import { DD_TABLES } from '../lib/schema.js'
import { STATUS_VALUES, isUnlimited } from '../lib/columns.js'
import {
  formatDate, formatAmount, formatMinAmount, formatDiscount, formatRelative,
  daysUntil, isExpired,
} from '../lib/format.js'
import { useDdTable } from '../composables/useDdTable.js'
import { useDdAccess } from '../composables/useDdAccess.js'
import DdPromoForm from '../components/DdPromoForm.vue'
import DdBulkUpload from '../components/DdBulkUpload.vue'

const route = useRoute()
const toast = useToast()
const { canTable, isReadOnly } = useDdAccess()

const {
  rows, loading, saving, error, total,
  currentPage, totalPages,
  search, filters, rangeFilters, stale, staleCount, staleBy,
  load, refresh, fetchAll, setSort, resetFilters,
  deleteRow, bulkUpsert, subscribe,
} = useDdTable('promos')

// Buttons the person may not use are removed, not greyed out: a disabled
// control still advertises a capability they do not have.
const canCreate = computed(() => !isReadOnly.value && canTable('promos', 'create'))
const canUpdate = computed(() => !isReadOnly.value && canTable('promos', 'update'))
const canDelete = computed(() => !isReadOnly.value && canTable('promos', 'delete'))

// ── Filters ────────────────────────────────────────────────────────────────

// `filters` is replaced wholesale rather than mutated so the composable's deep
// watcher fires exactly once per change.
const setFilter = (col, value) => { filters.value = { ...filters.value, [col]: value } }
const statusFilter = computed({
  get: () => filters.value.status ?? '',
  set: v => setFilter('status', v),
})
const buFilter = computed({
  get: () => filters.value.bu_name ?? '',
  set: v => setFilter('bu_name', v),
})

const statusOptions = [
  { label: 'All statuses', value: '' },
  ...STATUS_VALUES.map(v => ({ label: v, value: v })),
]
const buOptions = ref([{ label: 'All business units', value: '' }])

// ── Period filter ──────────────────────────────────────────────────────────
//
// A period is a range test over start_date/end_date, which `filters` cannot
// express — it is equality-only. `rangeFilters` is the composable's answer, and
// it is applied in the same place, so the period narrows the query Postgres
// runs: `total` and the pager describe the filtered set rather than whatever
// happened to be fetched.

// "Soon" is two different windows because the two questions are different: a
// promo about to start is a launch to check, one about to end is a renewal
// decision, and the desk plans those on different horizons.
const STARTING_SOON_DAYS = 14
const EXPIRING_SOON_DAYS = 30
// Unrelated to the filter: how close to the end date the table starts warning.
const EXPIRY_WARN_DAYS = 7

const PERIOD_OPTIONS = [
  { label: 'All periods', value: '' },
  { label: 'Active now', value: 'active' },
  { label: 'Starting soon', value: 'starting' },
  { label: 'Expiring soon', value: 'expiring' },
  { label: 'Expired', value: 'expired' },
]

/** Today, or an offset from it, as the YYYY-MM-DD a `date` column compares
 *  against. Built from local parts: toISOString() would shift to UTC and hand
 *  Jakarta yesterday's date every evening. */
function isoDay(offsetDays = 0) {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + offsetDays)
  const pad = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

// Evaluated per selection rather than once at module load, so a tab left open
// overnight does not keep filtering against yesterday.
const PERIOD_BOUNDS = {
  active: () => ({ start_date: { lte: isoDay() }, end_date: { gte: isoDay() } }),
  starting: () => ({ start_date: { gt: isoDay(), lte: isoDay(STARTING_SOON_DAYS) } }),
  expiring: () => ({ end_date: { gte: isoDay(), lte: isoDay(EXPIRING_SOON_DAYS) } }),
  expired: () => ({ end_date: { lt: isoDay() } }),
}

// The selection is mirrored into rangeFilters by the setter, not by a watcher:
// resetFilters() already clears rangeFilters, and a watcher would then write a
// second empty object and cost a second round-trip.
const periodKey = ref('')
const period = computed({
  get: () => periodKey.value,
  set: (v) => {
    periodKey.value = v
    rangeFilters.value = PERIOD_BOUNDS[v] ? PERIOD_BOUNDS[v]() : {}
  },
})

const hasFilters = computed(() =>
  !!search.value.trim() || !!statusFilter.value || !!buFilter.value || !!periodKey.value,
)

function resetAll() {
  periodKey.value = ''
  resetFilters()
}

// ── Table ──────────────────────────────────────────────────────────────────

const tableColumns = [
  { key: 'promo_id', label: 'Promo ID', sortable: true },
  { key: 'promo_name', label: 'Name', sortable: true },
  { key: 'merchant_id', label: 'Applies to', sortable: true },
  { key: 'bu_name', label: 'BU', sortable: true },
  { key: 'period', label: 'Period', sortable: true },
  { key: 'prime', label: 'PRIME' },
  { key: 'paylater', label: 'PAYLATER' },
  { key: 'min_txn_amount', label: 'Min Txn', align: 'right' },
  { key: 'max_txn_amount', label: 'Max Txn', align: 'right' },
  { key: 'budget_amount', label: 'Budget', align: 'right' },
  { key: 'priority', label: 'Pri', align: 'center', sortable: true },
  { key: 'status', label: 'Status', sortable: true },
  { key: 'updated_at', label: 'Updated', sortable: true },
  { key: 'actions', label: '' },
]

// Display keys that are not column names. LiTable owns the asc/desc toggle and
// so does setSort, and they stay in step because the mapping is one-to-one.
const SORT_COLUMN = { period: 'start_date' }
const onSort = ({ key }) => setSort(SORT_COLUMN[key] ?? key)

/** "15% · max Rp 50.000,00" — one cell per channel rather than three. */
function discount(row, prefix) {
  const type = row[`${prefix}_discount_type`]
  if (!type) return ''
  const head = formatDiscount(row[`${prefix}_discount_value`], type)
  const cap = row[`${prefix}_max_discount`]
  if (cap == null || cap === '') return head
  return isUnlimited(cap) ? `${head} · Unlimited` : `${head} · max ${formatAmount(cap)}`
}

/** A badge only when the period needs attention — an in-flight promo with
 *  months to run says nothing worth a coloured pill. */
function periodBadge(row) {
  if (isExpired(row.end_date)) return { label: 'Expired', variant: 'neutral' }
  const left = daysUntil(row.end_date)
  if (left != null && left <= EXPIRY_WARN_DAYS) {
    return { label: left === 0 ? 'Ends today' : `${left}d left`, variant: 'warning' }
  }
  return null
}

// ── Dialogs ────────────────────────────────────────────────────────────────

const showForm = ref(false)
const showBulk = ref(false)
const editRow = ref(null)
const duplicateRow = ref(null)

function openCreate() {
  editRow.value = null
  duplicateRow.value = null
  showForm.value = true
}

function openEdit(row) {
  editRow.value = row
  duplicateRow.value = null
  showForm.value = true
}

/** The most-used action on this screen: most new promos are last month's promo
 *  with new dates. The form generates a fresh promo_id from the copy. */
function openDuplicate(row) {
  editRow.value = null
  duplicateRow.value = row
  showForm.value = true
}

const showDelete = ref(false)
const deleteRowTarget = ref(null)

function askDelete(row) {
  deleteRowTarget.value = row
  showDelete.value = true
}

async function confirmDelete() {
  const target = deleteRowTarget.value
  if (!target) return
  // deleteRow reloads the page itself, which republishes `rows` — the period
  // watcher picks the whole-set refetch up from there.
  const res = await deleteRow(target.promo_id)
  if (res?.ok) {
    showDelete.value = false
    deleteRowTarget.value = null
  }
}

// ── Stale banner ───────────────────────────────────────────────────────────

const staleDismissed = ref(false)
// A dismissal covers the changes seen so far, not every change from now on.
watch(stale, (v) => { if (v) staleDismissed.value = false })

// ── Export ─────────────────────────────────────────────────────────────────

// Column shape carried over verbatim from qrdd's usePromoRule: the words a
// sentinel turns into here ("Unlimited", "No Minimum", "Not Eligible") are what
// the business reads in the spreadsheet, and changing them silently changes a
// report someone reconciles against.
const exportColumns = [
  { key: 'promo_id', label: 'Promo ID' },
  { key: 'promo_name', label: 'Promo Name' },
  { key: 'merchant_id', label: 'Merchant ID', textFormula: true, format: v => v || 'All Merchants' },
  { key: 'bu_name', label: 'BU Name' },
  { key: 'start_date', label: 'Start Date' },
  { key: 'end_date', label: 'End Date' },
  { key: 'prm_discount_type', label: 'PRIME Discount Type', format: v => v || 'Not Eligible' },
  { key: 'prm_discount_value', label: 'PRIME Discount Value', format: (v, row) => !row.prm_discount_type ? null : (row.prm_discount_type === 'PERCENTAGE' ? v + '%' : v) },
  { key: 'prm_max_discount', label: 'PRIME Max Discount', format: (v, row) => !row.prm_discount_type ? null : (isUnlimited(v) ? 'Unlimited' : v) },
  { key: 'pl_discount_type', label: 'PAYLATER Discount Type', format: v => v || 'Not Eligible' },
  { key: 'pl_discount_value', label: 'PAYLATER Discount Value', format: (v, row) => !row.pl_discount_type ? null : (row.pl_discount_type === 'PERCENTAGE' ? v + '%' : v) },
  { key: 'pl_max_discount', label: 'PAYLATER Max Discount', format: (v, row) => !row.pl_discount_type ? null : (isUnlimited(v) ? 'Unlimited' : v) },
  { key: 'min_txn_amount', label: 'Min Txn Amount', format: v => Number(v) <= 1 ? 'No Minimum' : v },
  { key: 'max_txn_amount', label: 'Max Txn Amount', format: v => v == null ? 'Unlimited' : v },
  { key: 'budget_amount', label: 'Budget Amount', format: v => v == null ? 'Unlimited' : v },
  { key: 'priority', label: 'Priority' },
  { key: 'status', label: 'Status' },
  { key: 'created_by', label: 'Created By' },
  { key: 'updated_by', label: 'Updated By' },
  { key: 'updated_at', label: 'Updated At', format: v => v ? new Date(v).toISOString().slice(0, 10) : '' },
]

const exporting = ref(false)

async function exportXlsx() {
  exporting.value = true
  try {
    // The whole filtered set, not the page on screen — an export of 25 of 900
    // rows is worse than no export at all. fetchAll runs the same applyFilters
    // as load(), so the period bounds are already in the query.
    const data = await fetchAll()
    if (!data.length) { toast.error('Nothing to export'); return }
    exportToXlsx(data, exportColumns, 'dd_promo_rules')
    toast.success(`Exported ${data.length} promo rules`)
  } catch (e) {
    toast.error(`Export failed: ${e.message}`)
  } finally {
    exporting.value = false
  }
}

// ── Boot ───────────────────────────────────────────────────────────────────

async function loadBuOptions() {
  // One BU appears once per source-of-fund row, so the list is deduped before
  // it becomes a filter.
  const { data } = await supabase.from(DD_TABLES.bu_accounts.local).select('name').order('name')
  buOptions.value = [
    { label: 'All business units', value: '' },
    ...[...new Set((data || []).map(r => r.name))].map(name => ({ label: name, value: name })),
  ]
}

onMounted(() => {
  // The Phase 3 dashboard links here as /dd/promos?q=<promo_id>. Seeding the
  // search box rather than filtering invisibly means the reader can see why the
  // list is narrowed — and can clear it.
  const q = route.query.q
  if (q) {
    // The composable's debounced search watcher issues the first load itself;
    // calling load() as well would run the same query twice.
    search.value = String(q)
  } else {
    load()
  }
  loadBuOptions()
  subscribe()
})
</script>

<style scoped>
.ddpromo { display: flex; flex-direction: column; gap: var(--space-md, 16px); }
.ddpromo__head { display: flex; align-items: flex-end; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.ddpromo__title { font-size: 24px; font-weight: 800; margin: 0; letter-spacing: -0.4px; }
.ddpromo__sub { font-size: 14px; color: var(--color-gray-500, #8e8ea0); margin: 2px 0 0; }
.ddpromo__count { font-size: 13px; color: var(--color-gray-500, #8e8ea0); margin: 0; white-space: nowrap; }
.ddpromo__actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.ddpromo__error {
  font-size: 13px; color: var(--color-red-400, #C83E3B);
  background: rgba(200, 62, 59, 0.08);
  border-radius: var(--radius-sm, 12px); padding: 10px 14px; margin: 0;
}
.ddpromo__pagination { display: flex; justify-content: center; }

.ddpromo__filters {
  display: grid; grid-template-columns: 2fr 1fr 1fr 1fr auto;
  gap: var(--space-sm, 12px); align-items: end;
}
.ddpromo__reset {
  padding: 10px 18px; border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: var(--radius-pill, 999px); background: transparent;
  font-family: var(--font-body, 'Inter', sans-serif);
  font-size: 13px; font-weight: 600; color: var(--color-gray-700, #666);
  cursor: pointer; transition: all 200ms;
}
.ddpromo__reset:hover { background: rgba(0, 0, 0, 0.04); }

@media (max-width: 1100px) {
  .ddpromo__filters { grid-template-columns: 1fr 1fr; }
}

.ddpromo__ghost, .ddpromo__add {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 8px 16px; border-radius: var(--radius-pill, 999px);
  font-family: var(--font-body, 'Inter', sans-serif);
  font-size: 13px; font-weight: 600;
  cursor: pointer; transition: all 200ms; white-space: nowrap;
}
.ddpromo__ghost {
  border: 1px solid rgba(0, 0, 0, 0.1); background: transparent;
  color: var(--color-gray-700, #666);
}
.ddpromo__ghost:hover:not(:disabled) { background: rgba(0, 0, 0, 0.04); }
.ddpromo__ghost:disabled { opacity: 0.45; cursor: not-allowed; }
.ddpromo__add {
  border: none; background: var(--cta-primary-bg, #FFBC25);
  color: var(--cta-primary-text, #1E1E1E);
}
.ddpromo__add:hover { transform: translateY(-1px); }
.ddpromo__ghost .material-symbols-outlined,
.ddpromo__add .material-symbols-outlined { font-size: 17px; }

.ddpromo__stale {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 14px; border-radius: var(--radius-sm, 12px);
  background: var(--color-yellow-100, #FFF3D6);
  border: 1px solid rgba(244, 166, 0, 0.35);
  font-size: 13px; color: var(--color-gray-800, #4D4D4D);
}
.ddpromo__stale-text { flex: 1; }
.ddpromo__stale .material-symbols-outlined { font-size: 19px; color: var(--color-yellow-500, #F4A600); }
.ddpromo__stale-btn {
  padding: 5px 14px; border: 1px solid rgba(0, 0, 0, 0.12);
  border-radius: var(--radius-pill, 999px); background: var(--color-gray-0, #fff);
  font-family: var(--font-body, 'Inter', sans-serif);
  font-size: 12px; font-weight: 700; color: var(--color-gray-800, #4D4D4D);
  cursor: pointer;
}
.ddpromo__stale-btn:hover { background: rgba(0, 0, 0, 0.04); }
.ddpromo__stale-x {
  display: inline-flex; border: none; background: none; padding: 2px;
  color: var(--color-gray-600, #808080); cursor: pointer;
}
.ddpromo__stale-x .material-symbols-outlined { font-size: 17px; color: inherit; }

.ddpromo__code {
  font-family: var(--font-mono, ui-monospace, monospace); font-size: 12px;
  background: rgba(0, 0, 0, 0.04); border-radius: 5px; padding: 1px 6px;
}
.ddpromo__name { font-weight: 600; }
.ddpromo__muted { color: var(--color-gray-400, #aaa); }
.ddpromo__meta { font-size: 12px; color: var(--color-gray-500, #8e8ea0); line-height: 1.4; }
.ddpromo__period { display: inline-flex; align-items: center; gap: 8px; white-space: nowrap; }
.ddpromo__dates { font-size: 13px; }

.ddpromo__row-actions { display: inline-flex; align-items: center; gap: 2px; }
.ddpromo__icon {
  display: inline-flex; align-items: center; justify-content: center;
  padding: 6px; border: none; background: none;
  border-radius: var(--radius-sm, 12px);
  color: var(--color-gray-400, #B3B3B3);
  cursor: pointer; transition: all 200ms;
}
.ddpromo__icon:hover { color: var(--cta-primary-bg, #FFBC25); background: rgba(255, 188, 37, 0.12); }
.ddpromo__icon--danger:hover { color: var(--color-red-400, #C83E3B); background: rgba(200, 62, 59, 0.08); }
.ddpromo__icon .material-symbols-outlined { font-size: 18px; }

.ddpromo__confirm { margin: 0; font-size: 14px; line-height: 1.55; }
</style>
