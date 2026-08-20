<template>
  <section class="ddmer">
    <header class="ddmer__head">
      <div>
        <h1 class="ddmer__title">Merchants</h1>
        <p class="ddmer__sub">The whitelist of merchants eligible for discounts.</p>
      </div>
      <div class="ddmer__actions">
        <p class="ddmer__count">{{ total }} {{ total === 1 ? 'merchant' : 'merchants' }}</p>
        <button class="ddmer__btn" type="button" :disabled="exporting || !total" @click="exportXlsx">
          <span class="material-symbols-outlined">file_save</span>
          {{ exporting ? 'Exporting…' : 'Export XLSX' }}
        </button>
        <button v-if="canCreate" class="ddmer__btn" type="button" @click="showBulk = true">
          <span class="material-symbols-outlined">upload</span>
          Bulk Upload
        </button>
        <button v-if="canCreate" class="ddmer__btn ddmer__btn--primary" type="button" @click="openForm(null)">
          <span class="material-symbols-outlined">add</span>
          Add Merchant
        </button>
      </div>
    </header>

    <!-- Someone else wrote to this table while this page sat open. The banner
         offers the reload rather than performing it: a silent re-sort under a
         reader mid-scan is worse than a stale row. -->
    <div v-if="stale && !bannerDismissed" class="ddmer__stale">
      <span class="material-symbols-outlined">sync_problem</span>
      <span class="ddmer__stale-text">
        {{ staleCount }} {{ staleCount === 1 ? 'change' : 'changes' }}
        <template v-if="staleBy">by {{ staleBy }}</template>
        since you loaded this page.
      </span>
      <button class="ddmer__stale-action" type="button" @click="refresh">Refresh</button>
      <button class="ddmer__stale-close" type="button" aria-label="Dismiss" @click="bannerDismissed = true">
        <span class="material-symbols-outlined">close</span>
      </button>
    </div>

    <div class="ddmer__filters">
      <LiTextField v-model="search" placeholder="Search merchant ID, name or BU…" />
      <LiSelect v-model="filterStatus" :options="statusOptions" />
      <LiSelect v-model="filterBu" :options="buOptions" />
      <button class="ddmer__reset" type="button" @click="resetFilters">Reset</button>
    </div>

    <p v-if="error" class="ddmer__error">{{ error }}</p>

    <LiTable
      v-if="loading || rows.length"
      :data="rows"
      :columns="columns"
      row-key="merchant_id"
      :loading="loading"
      @sort="onSort"
    >
      <!-- merchant_id is varchar downstream and its leading zeros are load
           bearing, so it is rendered as monospace text and never coerced to a
           number for display. -->
      <template #cell-merchant_id="{ value }">
        <code class="ddmer__id">{{ value }}</code>
      </template>
      <template #cell-merchant_name="{ value }">
        <span class="ddmer__name">{{ value }}</span>
      </template>
      <template #cell-bu_name="{ value }">
        <template v-if="value">{{ value }}</template>
        <span v-else class="ddmer__muted">{{ EM_DASH }}</span>
      </template>
      <template #cell-status="{ value }">
        <LiBadge :label="value || 'UNKNOWN'" :variant="value === 'ACTIVE' ? 'success' : 'neutral'" size="sm" is-pill />
      </template>
      <template #cell-updated_at="{ row }">
        <span class="ddmer__when" :title="formatTimestamp(row.updated_at)">
          {{ formatRelative(row.updated_at) }}
          <small v-if="row.updated_by">{{ row.updated_by }}</small>
        </span>
      </template>
      <template #cell-actions="{ row }">
        <div class="ddmer__row-actions">
          <button v-if="canUpdate" class="ddmer__icon-btn" type="button" title="Edit" @click="openForm(row)">
            <span class="material-symbols-outlined">edit</span>
          </button>
          <button v-if="canDelete" class="ddmer__icon-btn ddmer__icon-btn--danger" type="button" title="Delete" @click="askDelete(row)">
            <span class="material-symbols-outlined">delete</span>
          </button>
        </div>
      </template>
    </LiTable>

    <LiEmptyState
      v-else
      icon="storefront"
      :title="hasActiveFilter ? 'No merchant matches these filters' : 'No merchants yet'"
      :description="hasActiveFilter
        ? 'Adjust the search or the filters above, or reset them.'
        : 'Add the first merchant to the whitelist, or bulk upload a spreadsheet.'"
    >
      <template v-if="canCreate && !hasActiveFilter" #action>
        <LiButton @click="openForm(null)">Add Merchant</LiButton>
      </template>
    </LiEmptyState>

    <div v-if="totalPages > 1" class="ddmer__pagination">
      <LiPagination v-model="currentPage" :total-pages="totalPages" />
    </div>

    <DdMerchantForm v-model="showForm" :row="editRow" @saved="load" />
    <DdBulkUpload v-model="showBulk" table-id="merchants" :bulk-upsert="bulkUpsert" @done="load" />

    <LiModal v-model="showDelete" title="Delete merchant" size="sm">
      <p class="ddmer__confirm">
        Delete <strong>{{ deleteRowRef?.merchant_name }}</strong>
        (<code class="ddmer__id">{{ deleteRowRef?.merchant_id }}</code>) from the whitelist?
      </p>
      <p class="ddmer__confirm-note">
        A promo rule that still names this merchant will block the delete — remove or repoint the promo first.
      </p>
      <template #footer>
        <LiButton variant="ghost" @click="showDelete = false">Cancel</LiButton>
        <LiButton variant="danger" :loading="saving" @click="confirmDelete">Delete</LiButton>
      </template>
    </LiModal>
  </section>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import LiTable from '@lib/components/LiTable.vue'
import LiPagination from '@lib/components/LiPagination.vue'
import LiSelect from '@lib/components/LiSelect.vue'
import LiTextField from '@lib/components/LiTextField.vue'
import LiBadge from '@lib/components/LiBadge.vue'
import LiButton from '@lib/components/LiButton.vue'
import LiModal from '@lib/components/LiModal.vue'
import LiEmptyState from '@lib/components/LiEmptyState.vue'
import { supabase } from '@/lib/supabase.js'
import { exportToXlsx } from '@lib/export-xlsx.js'
import { useToast } from '@lib/composables/useToast.js'
import { STATUS_VALUES } from '../lib/columns.js'
import { formatRelative, formatTimestamp, EM_DASH } from '../lib/format.js'
import { useDdTable } from '../composables/useDdTable.js'
import { useDdAccess } from '../composables/useDdAccess.js'
import DdMerchantForm from '../components/DdMerchantForm.vue'
import DdBulkUpload from '../components/DdBulkUpload.vue'

const toast = useToast()
const { canTable, isReadOnly } = useDdAccess()

const {
  rows, loading, saving, error, total, currentPage, totalPages,
  search, filters, stale, staleCount, staleBy,
  load, refresh, fetchAll, setSort, resetFilters,
  deleteRow, bulkUpsert, subscribe,
} = useDdTable('merchants')

const route = useRoute()

// canTable already ORs DD's menu axis with its database axis; isReadOnly is the
// belt to that braces — a role holding no write verb at all shows no write
// affordance even if a scope were mis-seeded.
const canCreate = computed(() => !isReadOnly.value && canTable('merchants', 'create'))
const canUpdate = computed(() => !isReadOnly.value && canTable('merchants', 'update'))
const canDelete = computed(() => !isReadOnly.value && canTable('merchants', 'delete'))

const showForm = ref(false)
const showBulk = ref(false)
const showDelete = ref(false)
const editRow = ref(null)
const deleteRowRef = ref(null)
const exporting = ref(false)

// The composable clears `stale` only on refresh(). Dismissing is a view-level
// concern, so it lives here — and un-dismisses itself when the next change
// lands, otherwise one dismissal would mute the banner for the whole session.
const bannerDismissed = ref(false)
watch(staleCount, () => { bannerDismissed.value = false })

const columns = computed(() => {
  const base = [
    { key: 'merchant_id', label: 'Merchant ID', sortable: true },
    { key: 'merchant_name', label: 'Merchant Name', sortable: true },
    { key: 'bu_name', label: 'BU Name', sortable: true },
    { key: 'status', label: 'Status', sortable: true },
    { key: 'updated_at', label: 'Updated', sortable: true },
  ]
  // No empty column for a reader who can do neither.
  if (canUpdate.value || canDelete.value) base.push({ key: 'actions', label: '', align: 'right' })
  return base
})

// LiTable tracks its own key/direction and emits both; the composable owns the
// real sort, and its toggle rule matches LiTable's, so only the key is passed on.
const onSort = ({ key }) => setSort(key)

const statusOptions = [
  { label: 'All statuses', value: '' },
  ...STATUS_VALUES.map(v => ({ label: v, value: v })),
]

// '' is the composable's "no filter" sentinel, same as the audit screen.
const filterStatus = computed({
  get: () => filters.value.status ?? '',
  set: (v) => { filters.value = { ...filters.value, status: v } },
})
const filterBu = computed({
  get: () => filters.value.bu_name ?? '',
  set: (v) => { filters.value = { ...filters.value, bu_name: v } },
})

const buNames = ref([])
const buOptions = computed(() => [
  { label: 'All business units', value: '' },
  ...buNames.value.map(n => ({ label: n, value: n })),
])

const hasActiveFilter = computed(() =>
  !!(search.value.trim() || filters.value.status || filters.value.bu_name),
)

/** A BU has one row per source of fund, so the raw read returns each name
 *  twice. The filter offers names, not rows, hence the de-duplication. */
async function loadBuNames() {
  const { data, error: e } = await supabase.from('qrdd_bu_accounts').select('name').order('name')
  if (e) return
  buNames.value = [...new Set((data || []).map(r => r.name).filter(Boolean))]
}

function openForm(row) {
  editRow.value = row
  showForm.value = true
}

function askDelete(row) {
  deleteRowRef.value = row
  showDelete.value = true
}

async function confirmDelete() {
  const target = deleteRowRef.value
  if (!target) return
  // A promo still referencing this merchant raises 23503; the composable turns
  // that into a sentence and toasts it, so nothing is re-explained here.
  const res = await deleteRow(target.merchant_id)
  if (res.ok) {
    showDelete.value = false
    deleteRowRef.value = null
  }
}

const EXPORT_COLUMNS = [
  {
    key: 'merchant_id',
    label: 'Merchant ID',
    textFormula: true,
    // export-xlsx's own textFormula guard only fires at ten digits or more, and
    // a whitelist ID can be shorter than that and still lead with a zero. This
    // wraps every all-digit ID instead; the shared helper then sees a string
    // that is no longer bare digits and leaves it alone, so there is no
    // double-wrap.
    format: v => (v == null || v === '' ? '' : (/^\d+$/.test(String(v)) ? `="${v}"` : String(v))),
  },
  { key: 'merchant_name', label: 'Merchant Name' },
  { key: 'bu_name', label: 'BU Name' },
  { key: 'status', label: 'Status' },
  { key: 'created_by', label: 'Created By' },
  { key: 'created_at', label: 'Created At', format: v => (v ? formatTimestamp(v) : '') },
  { key: 'updated_by', label: 'Updated By' },
  { key: 'updated_at', label: 'Updated At', format: v => (v ? formatTimestamp(v) : '') },
]

/** Exports every row matching the current filters, not the visible page — the
 *  page is a rendering detail and nobody wants 25 rows of 4,000. */
async function exportXlsx() {
  exporting.value = true
  try {
    const all = await fetchAll()
    if (!all.length) { toast.info('Nothing to export'); return }
    const stamp = new Date().toISOString().slice(0, 10)
    exportToXlsx(all, EXPORT_COLUMNS, `dd-merchants-${stamp}`)
    toast.success(`Exported ${all.length} ${all.length === 1 ? 'merchant' : 'merchants'}`)
  } catch (e) {
    toast.error(e.message)
  } finally {
    exporting.value = false
  }
}

onMounted(() => {
  // The dashboard links here as /dd/merchants?q=<merchant_id>. Seeding the
  // visible search box rather than filtering invisibly means the reader can see
  // why the list is narrowed — and can clear it. The composable's debounced
  // search watcher issues the first load itself, so calling load() as well
  // would run the same query twice.
  const q = route.query.q
  if (q) search.value = String(q)
  else load()
  loadBuNames()
  subscribe()
})
</script>

<style scoped>
.ddmer { display: flex; flex-direction: column; gap: var(--space-md, 16px); }
.ddmer__head { display: flex; align-items: flex-end; justify-content: space-between; gap: 12px; }
.ddmer__title { font-size: 24px; font-weight: 800; margin: 0; letter-spacing: -0.4px; }
.ddmer__sub { font-size: 14px; color: var(--color-gray-500, #8e8ea0); margin: 2px 0 0; }
.ddmer__count { font-size: 13px; color: var(--color-gray-500, #8e8ea0); margin: 0; white-space: nowrap; }
.ddmer__error {
  font-size: 13px; color: var(--color-red-400, #C83E3B);
  background: rgba(200, 62, 59, 0.08);
  border-radius: var(--radius-sm, 12px); padding: 10px 14px; margin: 0;
}
.ddmer__pagination { display: flex; justify-content: center; }

.ddmer__actions { display: flex; align-items: center; gap: 8px; }
.ddmer__btn {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 8px 16px; border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: var(--radius-pill, 999px); background: transparent;
  font-family: var(--font-body, 'Inter', sans-serif);
  font-size: 13px; font-weight: 600; color: var(--color-gray-700, #666);
  cursor: pointer; transition: all 200ms; white-space: nowrap;
}
.ddmer__btn:hover:not(:disabled) { background: rgba(0, 0, 0, 0.04); }
.ddmer__btn:disabled { opacity: 0.45; cursor: not-allowed; }
.ddmer__btn .material-symbols-outlined { font-size: 17px; }
.ddmer__btn--primary {
  background: var(--cta-primary-bg, #FFBC25);
  color: var(--cta-primary-text, #1E1E1E);
  border-color: var(--cta-primary-bg, #FFBC25);
}
.ddmer__btn--primary:hover:not(:disabled) { background: var(--cta-primary-hover, #FAB000); }

.ddmer__filters {
  display: grid; grid-template-columns: 2fr 1fr 1fr auto;
  gap: var(--space-sm, 12px); align-items: end;
}
.ddmer__reset {
  padding: 10px 18px; border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: var(--radius-pill, 999px); background: transparent;
  font-family: var(--font-body, 'Inter', sans-serif);
  font-size: 13px; font-weight: 600; color: var(--color-gray-700, #666);
  cursor: pointer; transition: all 200ms;
}
.ddmer__reset:hover { background: rgba(0, 0, 0, 0.04); }

@media (max-width: 1100px) {
  .ddmer__filters { grid-template-columns: 1fr 1fr; }
  .ddmer__head { flex-direction: column; align-items: flex-start; }
  .ddmer__actions { flex-wrap: wrap; }
}

.ddmer__stale {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 14px; margin: 0;
  border-radius: var(--radius-sm, 12px);
  background: rgba(255, 188, 37, 0.14);
  border: 1px solid rgba(255, 188, 37, 0.5);
  font-size: 13px; color: var(--color-gray-800, #4D4D4D);
}
.ddmer__stale .material-symbols-outlined { font-size: 18px; }
.ddmer__stale-text { flex: 1; }
.ddmer__stale-action {
  border: none; background: transparent; padding: 4px 8px;
  font-family: var(--font-body, 'Inter', sans-serif);
  font-size: 13px; font-weight: 700; color: var(--color-gray-900, #333);
  text-decoration: underline; cursor: pointer;
}
.ddmer__stale-close {
  border: none; background: transparent; padding: 2px; line-height: 0;
  color: var(--color-gray-600, #808080); cursor: pointer;
}
.ddmer__stale-close:hover { color: var(--color-gray-900, #333); }

/* Same monospace treatment the audit log gives a column name: these are keys,
   not prose, and a leading zero has to read as part of the value. */
.ddmer__id {
  font-family: var(--font-mono, ui-monospace, monospace); font-size: 12px;
  background: rgba(0, 0, 0, 0.04); border-radius: 5px; padding: 1px 6px;
}
.ddmer__name { font-weight: 600; }
.ddmer__muted { color: var(--color-gray-400, #aaa); }
.ddmer__when { font-size: 13px; }
.ddmer__when small { display: block; font-size: 11px; color: var(--color-gray-400, #aaa); }

.ddmer__row-actions { display: inline-flex; align-items: center; gap: 2px; }
.ddmer__icon-btn {
  background: none; border: none; cursor: pointer; padding: 6px;
  border-radius: var(--radius-sm, 12px);
  display: inline-flex; align-items: center; justify-content: center;
  color: var(--color-gray-400, #B3B3B3); transition: all 200ms;
}
.ddmer__icon-btn:hover { color: var(--cta-primary-bg, #FFBC25); background: rgba(255, 188, 37, 0.12); }
.ddmer__icon-btn--danger:hover { color: var(--color-red-400, #C83E3B); background: rgba(200, 62, 59, 0.08); }
.ddmer__icon-btn .material-symbols-outlined { font-size: 18px; }

.ddmer__confirm { margin: 0 0 8px; font-size: 14px; }
.ddmer__confirm-note { margin: 0; font-size: 12.5px; color: var(--color-gray-500, #8e8ea0); }
</style>
