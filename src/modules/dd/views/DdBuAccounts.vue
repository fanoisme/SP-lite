<template>
  <section class="ddbu">
    <header class="ddbu__head">
      <div>
        <h1 class="ddbu__title">Business Units</h1>
        <p class="ddbu__sub">Discount expense and receivable accounts per BU.</p>
      </div>
      <div class="ddbu__actions">
        <p class="ddbu__count">{{ total }} {{ total === 1 ? 'business unit' : 'business units' }}</p>
        <button class="ddbu__btn" type="button" :disabled="!total || exporting" @click="exportXlsx">
          <LiIcon name="file_save" />
          {{ exporting ? 'Exporting…' : 'Export XLSX' }}
        </button>
        <button v-if="canCreate" class="ddbu__btn" type="button" @click="showBulk = true">
          <LiIcon name="upload" />
          Bulk Upload
        </button>
        <button v-if="canCreate" class="ddbu__btn ddbu__btn--primary" type="button" @click="openForm(null)">
          <LiIcon name="add" />
          Add
        </button>
      </div>
    </header>

    <!-- Someone else wrote to this table while the page sat open. The rows on
         screen are not wrong, they are old — so this offers a reload rather than
         forcing one and losing whatever the reader was in the middle of. -->
    <div v-if="showStale" class="ddbu__stale">
      <LiIcon name="sync_problem" />
      <p class="ddbu__stale-text">
        {{ staleCount }} {{ staleCount === 1 ? 'change' : 'changes' }}
        <template v-if="staleBy">by {{ staleBy }}</template>
        since you loaded this page.
      </p>
      <button class="ddbu__stale-action" type="button" @click="refresh">Refresh</button>
      <button class="ddbu__stale-close" type="button" aria-label="Dismiss" @click="staleDismissed = true">
        <LiIcon name="close" />
      </button>
    </div>

    <div class="ddbu__filters">
      <LiTextField v-model="search" placeholder="Search name, account number or holder…" />
      <LiSelect v-model="sofFilter" :options="sofOptions" />
      <button class="ddbu__reset" type="button" @click="resetFilters">Reset</button>
    </div>

    <p v-if="error" class="ddbu__error">{{ error }}</p>

    <LiTable
      v-if="loading || rows.length"
      :data="rows"
      :columns="tableColumns"
      row-key="id"
      :loading="loading"
      @sort="onSort"
    >
      <template #cell-name="{ value }">
        <span class="ddbu__name">{{ value }}</span>
      </template>

      <template #cell-sof="{ value }">
        <LiBadge :label="value" :variant="value === 'PRIME' ? 'info' : 'warning'" size="sm" is-pill />
      </template>

      <template #cell-expense="{ row }">
        <div class="ddbu__acct">
          <span class="ddbu__acct-num">{{ row.account1 || EM_DASH }}</span>
          <span class="ddbu__acct-name" :title="row.acctname1">{{ row.acctname1 || EM_DASH }}</span>
        </div>
      </template>

      <template #cell-receivable="{ row }">
        <div class="ddbu__acct">
          <span class="ddbu__acct-num">{{ row.account2 || EM_DASH }}</span>
          <span class="ddbu__acct-name" :title="row.acctname2">{{ row.acctname2 || EM_DASH }}</span>
        </div>
      </template>

      <template #cell-split="{ row }">
        <div class="ddbu__split">
          <span class="ddbu__split-bar">
            <span class="ddbu__split-fill" :style="{ width: barWidth(row.percentage1) }" />
          </span>
          <span class="ddbu__split-nums">
            {{ formatPercentage(row.percentage1) }} / {{ formatPercentage(row.percentage2) }}
          </span>
        </div>
      </template>

      <!-- Relative on screen, absolute on hover: "2 days ago" is what a reader
           scans for, the exact stamp is what they quote in a ticket. -->
      <template #cell-updated_at="{ row }">
        <span class="ddbu__when" :title="formatTimestamp(row.updated_at)">
          {{ formatRelative(row.updated_at) }}
        </span>
        <small v-if="row.updated_by" class="ddbu__by">{{ row.updated_by }}</small>
      </template>

      <template #cell-actions="{ row }">
        <div class="ddbu__row-actions">
          <button v-if="canUpdate" class="ddbu__icon-btn" type="button" :aria-label="`Edit ${row.name}`" title="Edit" @click="openForm(row)">
            <LiIcon name="edit" />
          </button>
          <button
            v-if="canDelete"
            class="ddbu__icon-btn ddbu__icon-btn--danger"
            type="button"
            :aria-label="`Delete ${row.name}`"
            title="Delete"
            @click="pendingDelete = row"
          >
            <LiIcon name="delete" />
          </button>
        </div>
      </template>
    </LiTable>

    <LiEmptyState
      v-else
      icon="account_balance"
      :title="isFiltered ? 'No business unit matches these filters' : 'No business units yet'"
      :description="isFiltered
        ? 'Adjust the search or the source of fund, or reset the filters.'
        : 'Add a business unit before creating merchants or promos.'"
    >
      <template v-if="isFiltered" #action>
        <LiButton variant="secondary" @click="resetFilters">Reset filters</LiButton>
      </template>
      <template v-else-if="canCreate" #action>
        <LiButton @click="openForm(null)">New business unit</LiButton>
      </template>
    </LiEmptyState>

    <div v-if="totalPages > 1" class="ddbu__pagination">
      <LiPagination v-model="currentPage" :total-pages="totalPages" />
    </div>

    <!-- The form writes through its own useDdTable instance, so this list has to
         be told to catch up. -->
    <DdBuAccountForm v-model="showForm" :row="editRow" @saved="load" />

    <DdBulkUpload v-model="showBulk" table-id="bu_accounts" :bulk-upsert="bulkUpsert" @done="load" />

    <LiModal v-model="showDelete" title="Delete business unit" size="sm">
      <p class="ddbu__confirm">
        Delete <strong>{{ pendingDelete?.name }}</strong> ({{ pendingDelete?.sof }})?
      </p>
      <!-- Downstream keys on name AND sof, and merchants and promos reference
           the name, so this is not a local-only removal. -->
      <p class="ddbu__confirm-note">
        Merchants and promos pointing at this business unit will be left without one.
        This cannot be undone.
      </p>
      <template #footer>
        <LiButton variant="ghost" @click="pendingDelete = null">Cancel</LiButton>
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
import { useToast } from '@lib/composables/useToast.js'
import { exportToXlsx } from '@lib/export-xlsx.js'
import DdBuAccountForm from '../components/DdBuAccountForm.vue'
import DdBulkUpload from '../components/DdBulkUpload.vue'
import { useDdTable } from '../composables/useDdTable.js'
import { useDdAccess } from '../composables/useDdAccess.js'
import { SOF_VALUES, editableColumns } from '../lib/columns.js'
import { formatPercentage, formatRelative, formatTimestamp, formatStoredTimestamp, EM_DASH } from '../lib/format.js'

const {
  rows, loading, saving, error, total, currentPage, totalPages,
  search, filters, stale, staleCount, staleBy,
  load, refresh, fetchAll, setSort, resetFilters, deleteRow, bulkUpsert, subscribe,
} = useDdTable('bu_accounts')

const route = useRoute()

const { canTable, isReadOnly } = useDdAccess()
const toast = useToast()

// canTable already ORs the menu scope with the database scope (DD's
// canWriteSheet rule), so it is the only predicate needed here. isReadOnly is
// checked as well so a role with no write verb at all shows no write UI, even
// if a scope were mis-seeded.
const canCreate = computed(() => !isReadOnly.value && canTable('bu_accounts', 'create'))
const canUpdate = computed(() => !isReadOnly.value && canTable('bu_accounts', 'update'))
const canDelete = computed(() => !isReadOnly.value && canTable('bu_accounts', 'delete'))

const showForm = ref(false)
const showBulk = ref(false)
const editRow = ref(null)
const pendingDelete = ref(null)
const exporting = ref(false)
const staleDismissed = ref(false)

const tableColumns = [
  { key: 'name', label: 'Business unit', sortable: true },
  { key: 'sof', label: 'Source of fund', sortable: true },
  { key: 'expense', label: 'Expense account' },
  { key: 'receivable', label: 'Receivable account' },
  { key: 'split', label: 'Split (expense / receivable)' },
  { key: 'updated_at', label: 'Updated', sortable: true },
  { key: 'actions', label: '' },
]

// '' is the composable's "no filter" sentinel — applyFilters skips it.
const sofOptions = [
  { label: 'All sources of fund', value: '' },
  ...SOF_VALUES.map(v => ({ label: v, value: v })),
]

const sofFilter = computed({
  get: () => filters.value.sof ?? '',
  set: (v) => { filters.value = { ...filters.value, sof: v } },
})

const isFiltered = computed(() => !!search.value.trim() || !!sofFilter.value)

// A dismissal covers the changes known at that moment; a later one is new
// information and earns the banner back.
const showStale = computed(() => stale.value && !staleDismissed.value)
watch(staleCount, () => { staleDismissed.value = false })

const showDelete = computed({
  get: () => !!pendingDelete.value,
  set: (v) => { if (!v) pendingDelete.value = null },
})

function openForm(row) {
  editRow.value = row
  showForm.value = true
}

// LiTable owns its own asc/desc toggle and emits both; setSort flips the same
// way off the same key, so passing the key alone keeps the two in step.
function onSort({ key }) {
  setSort(key)
}

function barWidth(p) {
  const n = Number(p)
  return `${Math.max(0, Math.min(1, Number.isNaN(n) ? 0 : n)) * 100}%`
}

async function confirmDelete() {
  const row = pendingDelete.value
  if (!row) return
  const res = await deleteRow(row.id)
  if (res?.ok) pendingDelete.value = null
}

// Every column that carries data downstream, plus who last touched the row.
// account1/account2 are 20+ digit strings: without the text formula Excel
// rounds them into scientific notation and the export is unusable.
const exportSpec = [
  ...editableColumns('bu_accounts').map(c => ({
    key: c.name,
    label: c.label,
    text: c.name === 'account1' || c.name === 'account2',
  })),
  // The stored shape, not the screen's "21 Aug 2026 09:14": an export is read
  // next to the database and has to say the same thing it does.
  { key: 'updated_at', label: 'Updated At', format: formatStoredTimestamp },
  { key: 'updated_by', label: 'Updated By' },
]

async function exportXlsx() {
  exporting.value = true
  try {
    // The filtered set, not the visible page — what is on screen is 25 rows of
    // a server-side query, and nobody wants page 3 of their export.
    const all = await fetchAll()
    const stamp = new Date().toISOString().slice(0, 10)
    exportToXlsx(all, exportSpec, `dd-business-units-${stamp}`)
  } catch (e) {
    toast.error(e.message)
  } finally {
    exporting.value = false
  }
}

onMounted(() => {
  // The dashboard links here as /dd/business-units?q=<name>. Seeding the
  // visible search box rather than filtering invisibly means the reader can see
  // why the list is narrowed — and can clear it. The composable's debounced
  // search watcher issues the first load itself, so calling load() as well
  // would run the same query twice.
  const q = route.query.q
  if (q) search.value = String(q)
  else load()
  subscribe()
})
</script>

<style scoped>
.ddbu { display: flex; flex-direction: column; gap: var(--space-md, 16px); }
.ddbu__head { display: flex; align-items: flex-end; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.ddbu__title { font-size: 24px; font-weight: 800; margin: 0; letter-spacing: -0.4px; }
.ddbu__sub { font-size: 14px; color: var(--color-gray-500, #8e8ea0); margin: 2px 0 0; }
.ddbu__count { font-size: 13px; color: var(--color-gray-500, #8e8ea0); margin: 0; white-space: nowrap; }
.ddbu__actions { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.ddbu__error {
  font-size: 13px; color: var(--color-red-400, #C83E3B);
  background: rgba(200, 62, 59, 0.08);
  border-radius: var(--radius-sm, 12px); padding: 10px 14px; margin: 0;
}
.ddbu__pagination { display: flex; justify-content: center; }

.ddbu__btn {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 8px 16px; border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: var(--radius-pill, 999px); background: transparent;
  font-family: var(--font-body, 'Inter', sans-serif);
  font-size: 13px; font-weight: 600; color: var(--color-gray-700, #666);
  cursor: pointer; transition: all 200ms; white-space: nowrap;
}
.ddbu__btn:hover:not(:disabled) { background: rgba(0, 0, 0, 0.04); }
.ddbu__btn:disabled { opacity: 0.45; cursor: not-allowed; }
.ddbu__btn .li-icon { font-size: 17px; }
.ddbu__btn--primary {
  background: var(--cta-primary-bg, #FFBC25);
  color: var(--cta-primary-text, #1E1E1E);
  border-color: var(--cta-primary-bg, #FFBC25);
}
.ddbu__btn--primary:hover:not(:disabled) { background: var(--cta-primary-hover, #FAB000); }

.ddbu__filters {
  display: grid; grid-template-columns: 2fr 1fr auto;
  gap: var(--space-sm, 12px); align-items: end;
}
.ddbu__reset {
  padding: 10px 18px; border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: var(--radius-pill, 999px); background: transparent;
  font-family: var(--font-body, 'Inter', sans-serif);
  font-size: 13px; font-weight: 600; color: var(--color-gray-700, #666);
  cursor: pointer; transition: all 200ms;
}
.ddbu__reset:hover { background: rgba(0, 0, 0, 0.04); }

@media (max-width: 900px) {
  .ddbu__filters { grid-template-columns: 1fr; }
}

.ddbu__stale {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 14px; border-radius: var(--radius-sm, 12px);
  background: rgba(255, 188, 37, 0.12);
  border: 1px solid rgba(255, 188, 37, 0.35);
}
.ddbu__stale .li-icon { font-size: 19px; color: var(--color-yellow-500, #F4A600); }
.ddbu__stale-text { margin: 0; flex: 1; font-size: 13px; color: var(--color-gray-800, #4D4D4D); }
.ddbu__stale-action {
  padding: 6px 14px; border: none; border-radius: var(--radius-pill, 999px);
  background: var(--cta-primary-bg, #FFBC25); color: var(--cta-primary-text, #1E1E1E);
  font-family: var(--font-body, 'Inter', sans-serif);
  font-size: 12px; font-weight: 700; cursor: pointer; transition: all 200ms;
}
.ddbu__stale-action:hover { background: var(--cta-primary-hover, #FAB000); }
.ddbu__stale-close {
  background: none; border: none; cursor: pointer; padding: 2px;
  display: inline-flex; color: var(--color-gray-500, #8e8ea0);
}
.ddbu__stale-close .li-icon { font-size: 16px; color: inherit; }

.ddbu__name { font-weight: 600; font-size: 13px; }
.ddbu__acct { display: flex; flex-direction: column; max-width: 240px; }
.ddbu__acct-num {
  font-family: var(--font-mono, ui-monospace, monospace); font-size: 11.5px;
  overflow-wrap: anywhere;
}
.ddbu__acct-name {
  font-size: 11.5px; color: var(--color-gray-500, #8e8ea0);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}

.ddbu__split { display: flex; align-items: center; gap: 8px; white-space: nowrap; }
.ddbu__split-bar {
  width: 70px; height: 6px; flex: none; overflow: hidden;
  border-radius: var(--radius-pill, 999px);
  background: var(--color-gray-200, #E6E6E6);
}
.ddbu__split-fill {
  display: block; height: 100%;
  border-radius: var(--radius-pill, 999px);
  background: var(--gradient-brand, linear-gradient(135deg, #FFAF03, #FF6B00));
  transition: width 300ms;
}
.ddbu__split-nums {
  font-size: 11.5px; color: var(--color-gray-600, #808080);
  font-variant-numeric: tabular-nums;
}

.ddbu__when { font-size: 12px; color: var(--color-gray-600, #808080); display: block; }
.ddbu__by { font-size: 11px; color: var(--color-gray-400, #B3B3B3); }

.ddbu__row-actions { display: inline-flex; align-items: center; gap: 2px; }
.ddbu__icon-btn {
  background: none; border: none; cursor: pointer; padding: 6px;
  border-radius: var(--radius-sm, 12px);
  display: inline-flex; align-items: center; justify-content: center;
  color: var(--color-gray-400, #B3B3B3); transition: all 200ms;
}
.ddbu__icon-btn:hover { color: var(--cta-primary-bg, #FFBC25); background: rgba(255, 188, 37, 0.12); }
.ddbu__icon-btn--danger:hover { color: var(--color-red-400, #C83E3B); background: rgba(200, 62, 59, 0.08); }
.ddbu__icon-btn .li-icon { font-size: 18px; }

.ddbu__confirm { margin: 0 0 8px; font-size: 14px; color: var(--color-gray-900, #333); }
.ddbu__confirm-note { margin: 0; font-size: 12.5px; color: var(--color-gray-500, #8e8ea0); }
</style>
