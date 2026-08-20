<template>
  <section class="ddexpl">
    <template v-if="meta">
      <header class="ddexpl__head">
        <div class="ddexpl__id">
          <h1 class="ddexpl__title">{{ meta.targetTable }}</h1>
          <p class="ddexpl__sub">
            <span class="material-symbols-outlined">dns</span>
            {{ meta.targetDb }}
            <RouterLink v-if="manageRoute" class="ddexpl__manage" :to="{ name: manageRoute }">
              <span class="material-symbols-outlined">tune</span>
              Guided screen
            </RouterLink>
          </p>
        </div>
        <div class="ddexpl__actions">
          <p class="ddexpl__count">
            <b>{{ total }}</b> {{ total === 1 ? 'row' : 'rows' }} ·
            {{ visibleColumns.length }}/{{ allCols.length }} cols
          </p>

          <!-- Up to 21 columns wide. The choice is per table and remembered,
               because the columns someone needs on promo_rule are not the ones
               they need on merchant_whitelist. -->
          <LiDropdown align="right">
            <template #trigger>
              <span class="ddexpl__btn">
                <span class="material-symbols-outlined">view_column</span>
                Columns
              </span>
            </template>
            <div class="ddexpl__colmenu">
              <div class="ddexpl__colmenu-head">
                <button class="ddexpl__link" type="button" @click="showAllColumns">All</button>
                <button class="ddexpl__link" type="button" @click="resetColumns">Reset</button>
              </div>
              <label
                v-for="col in allCols" :key="col.name"
                class="ddexpl__colopt" :class="{ 'ddexpl__colopt--stamp': isStamp(col.name) }"
              >
                <input
                  type="checkbox"
                  :checked="visibleNames.includes(col.name)"
                  @change="toggleColumn(col.name)"
                />
                <code>{{ downstreamName(col.name) }}</code>
                <span class="ddexpl__coltype">{{ col.type }}</span>
              </label>
            </div>
          </LiDropdown>

          <button class="ddexpl__btn" type="button" :disabled="!total || exporting" @click="exportCsv">
            <span class="material-symbols-outlined">file_save</span>
            {{ exporting ? 'Exporting…' : 'Export CSV' }}
          </button>

          <button v-if="canCreate" class="ddexpl__btn ddexpl__btn--primary" type="button" @click="openCreate">
            <span class="material-symbols-outlined">add</span>
            Insert row
          </button>
        </div>
      </header>

      <!-- Someone else wrote to this table while the page sat open. The rows on
           screen are not wrong, they are old — so this offers a reload rather
           than forcing one under the reader. -->
      <div v-if="showStale" class="ddexpl__stale">
        <span class="material-symbols-outlined">sync_problem</span>
        <p class="ddexpl__stale-text">
          {{ staleCount }} {{ staleCount === 1 ? 'change' : 'changes' }}
          <template v-if="staleBy">by {{ staleBy }}</template>
          since you loaded this table.
        </p>
        <button class="ddexpl__stale-action" type="button" @click="refresh">Refresh</button>
        <button class="ddexpl__stale-close" type="button" aria-label="Dismiss" @click="staleDismissed = true">
          <span class="material-symbols-outlined">close</span>
        </button>
      </div>

      <div class="ddexpl__toolbar">
        <LiTextField v-model="search" placeholder="Search text columns…" />
        <LiSelect v-model="searchColumn" :options="searchColumnOptions" />
        <LiSelect v-model="pageSizeStr" :options="pageSizeOptions" />
        <button
          class="ddexpl__btn" type="button"
          :class="{ 'ddexpl__btn--on': showFilters }"
          @click="showFilters = !showFilters"
        >
          <span class="material-symbols-outlined">filter_alt</span>
          Filters
          <span v-if="activeFilters" class="ddexpl__pill">{{ activeFilters }}</span>
        </button>
        <button class="ddexpl__reset" type="button" @click="resetFilters">Reset</button>
      </div>

      <!-- Per-column equality filters. Kept behind a toggle: 21 inputs above the
           grid would bury the grid itself. -->
      <div v-if="showFilters" class="ddexpl__colfilters">
        <div v-for="col in visibleColumns" :key="col.name" class="ddexpl__colfilter">
          <label class="ddexpl__colfilter-label">{{ downstreamName(col.name) }}</label>
          <LiSelect
            v-if="col.type === 'enum'"
            :model-value="filterValue(col.name)"
            :options="enumFilterOptions(col)"
            @update:model-value="v => setFilter(col.name, v)"
          />
          <LiTextField
            v-else
            :model-value="filterValue(col.name)"
            placeholder="exact value"
            @update:model-value="v => setFilter(col.name, v)"
          />
        </div>
      </div>

      <p v-if="error" class="ddexpl__error">{{ error }}</p>

      <LiTable
        v-if="loading || rows.length"
        :data="rows"
        :columns="tableColumns"
        :row-key="pk"
        :loading="loading"
        @sort="onSort"
      >
        <!-- Raw values only. No "Unlimited", no formatted percentage: this
             screen exists to show what is actually stored, and a formatter here
             would defeat the reason someone opened it. -->
        <template v-for="col in visibleColumns" :key="col.name" #[cellSlot(col.name)]="{ value }">
          <i v-if="value === null || value === undefined" class="ddexpl__null">NULL</i>
          <span v-else class="ddexpl__raw" :title="String(value)">{{ value }}</span>
        </template>

        <template #cell-__actions="{ row }">
          <div class="ddexpl__row-actions">
            <button v-if="canUpdate" class="ddexpl__icon-btn" type="button" title="Edit" @click="openEdit(row)">
              <span class="material-symbols-outlined">edit</span>
            </button>
            <button v-if="canCreate" class="ddexpl__icon-btn" type="button" title="Duplicate" @click="openDuplicate(row)">
              <span class="material-symbols-outlined">content_copy</span>
            </button>
            <button
              v-if="canDelete"
              class="ddexpl__icon-btn ddexpl__icon-btn--danger"
              type="button" title="Delete"
              @click="pendingDelete = row"
            >
              <span class="material-symbols-outlined">delete</span>
            </button>
          </div>
        </template>
      </LiTable>

      <LiEmptyState
        v-else
        icon="table_rows"
        :title="isFiltered ? 'No row matches these filters' : 'This table is empty'"
        :description="isFiltered
          ? 'Column filters are exact matches — a partial value finds nothing.'
          : 'Insert a row here, or use the guided screen to add one with the business rules explained.'"
      >
        <template v-if="isFiltered" #action>
          <LiButton variant="secondary" @click="resetFilters">Reset filters</LiButton>
        </template>
        <template v-else-if="canCreate" #action>
          <LiButton @click="openCreate">Insert row</LiButton>
        </template>
      </LiEmptyState>

      <div v-if="totalPages > 1" class="ddexpl__pagination">
        <LiPagination v-model="currentPage" :total-pages="totalPages" />
      </div>

      <DdRowForm
        v-model="showForm"
        :table-id="meta.id"
        :row="formRow"
        :duplicate="formDuplicate"
        @saved="load"
      />

      <LiModal v-model="showDelete" title="Delete row" size="sm">
        <p class="ddexpl__confirm">
          Permanently delete <code>{{ pk }}</code> =
          <strong>{{ pendingDelete?.[pk] }}</strong> from
          <code>{{ meta.targetTable }}</code>?
        </p>
        <p class="ddexpl__confirm-note">
          This is the raw table, so nothing here re-checks what still points at the
          row. It cannot be undone.
        </p>
        <template #footer>
          <LiButton variant="ghost" @click="pendingDelete = null">Cancel</LiButton>
          <LiButton variant="danger" :loading="saving" @click="confirmDelete">Delete row</LiButton>
        </template>
      </LiModal>
    </template>

    <!-- A hand-typed or renamed URL. The guard only redirects when the database
         is unreadable, so an unknown name reaches this component intact. -->
    <LiEmptyState
      v-else
      icon="help"
      size="lg"
      title="Unknown table"
      :description="`No DD table is named “${routeName}”. The Databases group in the sidebar lists every table this module manages.`"
    >
      <template #action>
        <LiButton variant="secondary" @click="router.push({ name: 'dd' })">Back to dashboard</LiButton>
      </template>
    </LiEmptyState>
  </section>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useRoute, useRouter, RouterLink } from 'vue-router'
import LiTable from '@lib/components/LiTable.vue'
import LiPagination from '@lib/components/LiPagination.vue'
import LiSelect from '@lib/components/LiSelect.vue'
import LiTextField from '@lib/components/LiTextField.vue'
import LiButton from '@lib/components/LiButton.vue'
import LiModal from '@lib/components/LiModal.vue'
import LiDropdown from '@lib/components/LiDropdown.vue'
import LiEmptyState from '@lib/components/LiEmptyState.vue'
import { useToast } from '@lib/composables/useToast.js'
import DdRowForm from '../components/DdRowForm.vue'
import { useDdTable } from '../composables/useDdTable.js'
import { useDdAccess } from '../composables/useDdAccess.js'
import { DD_TABLES, TABLE_IDS, byTargetTable } from '../lib/schema.js'
import { columns, searchableColumns, primaryKey, STAMP_COLUMNS } from '../lib/columns.js'
import { downloadCsv } from '../lib/csv.js'

const route = useRoute()
const router = useRouter()
const toast = useToast()
const { canTable, canMenu, isReadOnly } = useDdAccess()

// useDdAccess owns the menu -> route mapping but keeps it private, so the three
// entries this screen needs are restated rather than reached into.
const MANAGE_ROUTES = {
  'bu-accounts': 'dd-business-units',
  merchants: 'dd-merchants',
  promos: 'dd-promos',
}

const COLUMNS_KEY = 'dd.explorer.columns.'
const PAGE_SIZES = [25, 50, 100]

// One composable per table, all three built up front. useDdTable registers
// watchers and an onUnmounted hook during setup, so it cannot be created inside
// a route watcher — and vue-router reuses this component when only :name
// changes (DdLayout's RouterView has no key). Building all three costs nothing
// until load() is called, and it has the happy side effect that each table
// keeps its own page, sort and filters while you move between them.
const tables = Object.fromEntries(TABLE_IDS.map(id => [id, useDdTable(id)]))

const routeName = computed(() => String(route.params.name || ''))
const meta = computed(() => byTargetTable(routeName.value) ?? null)
const active = computed(() => (meta.value ? tables[meta.value.id] : null))

// Flat views over whichever composable is active. A plain object of refs behind
// a computed is not unwrapped by the template, so each field is re-exposed.
const ro = (key, fallback) => computed(() => (active.value ? active.value[key].value : fallback))
const rw = (key, fallback) => computed({
  get: () => (active.value ? active.value[key].value : fallback),
  set: (v) => { if (active.value) active.value[key].value = v },
})

const rows = ro('rows', [])
const loading = ro('loading', false)
const saving = ro('saving', false)
const error = ro('error', null)
const total = ro('total', 0)
const totalPages = ro('totalPages', 1)
const stale = ro('stale', false)
const staleCount = ro('staleCount', 0)
const staleBy = ro('staleBy', '')

const currentPage = rw('currentPage', 1)
const pageSize = rw('pageSize', PAGE_SIZES[0])
const search = rw('search', '')
const searchColumn = rw('searchColumn', '')
const filters = rw('filters', {})

const load = () => active.value?.load()
const refresh = () => active.value?.refresh()
const setSort = (key) => active.value?.setSort(key)
const resetFilters = () => active.value?.resetFilters()

const pk = computed(() => (meta.value ? primaryKey(meta.value.id) : 'id'))
const allCols = computed(() => (meta.value ? columns(meta.value.id) : []))

// Both DD access axes at once: canTable ORs the menu scope with the scope of the
// database that owns the table, so `db.ihybrid_order.update` alone is enough to
// edit here. isReadOnly is checked too, so a role holding no write verb on
// either axis shows no write UI even if one scope were mis-seeded.
const canCreate = computed(() => !!meta.value && !isReadOnly.value && canTable(meta.value.id, 'create'))
const canUpdate = computed(() => !!meta.value && !isReadOnly.value && canTable(meta.value.id, 'update'))
const canDelete = computed(() => !!meta.value && !isReadOnly.value && canTable(meta.value.id, 'delete'))
const canWrite = computed(() => canCreate.value || canUpdate.value || canDelete.value)

// The guided screen is menu-only: someone here on a database scope alone has no
// business being offered a link they would just bounce off the guard.
const manageRoute = computed(() =>
  meta.value && canMenu(meta.value.menu) ? MANAGE_ROUTES[meta.value.menu] : null,
)

const showFilters = ref(false)
const showForm = ref(false)
const formRow = ref(null)
const formDuplicate = ref(false)
const pendingDelete = ref(null)
const exporting = ref(false)
const staleDismissed = ref(false)

// ── Column visibility ──────────────────────────────────────────────────────

const visibleNames = ref([])

const isStamp = (name) => STAMP_COLUMNS.includes(name)

/** Local column -> the name it carries downstream. Only the timestamps differ,
 *  and only on bu_accounts, but the whole point of this screen is downstream
 *  naming so the mapping is applied everywhere a column name is printed. */
const downstreamName = (name) => meta.value?.timestamps?.[name] ?? name

const defaultVisible = (id) => columns(id).filter(c => !isStamp(c.name)).map(c => c.name)

function storageKey(id) {
  return `${COLUMNS_KEY}${DD_TABLES[id].targetTable}`
}

function restoreColumns(id) {
  let saved = null
  try {
    saved = JSON.parse(localStorage.getItem(storageKey(id)) || 'null')
  } catch {
    saved = null
  }
  // Intersected with the live schema and kept in declaration order: a column
  // dropped from columns.js must not survive in someone's browser, and a column
  // added to it must not land wherever it happened to be saved.
  const known = columns(id).map(c => c.name)
  visibleNames.value = Array.isArray(saved) && saved.length
    ? known.filter(n => saved.includes(n))
    : defaultVisible(id)
  if (!visibleNames.value.length) visibleNames.value = defaultVisible(id)
}

function persistColumns() {
  if (!meta.value) return
  try {
    localStorage.setItem(storageKey(meta.value.id), JSON.stringify(visibleNames.value))
  } catch {
    // A full or blocked localStorage costs the person their column choice next
    // visit, which is not worth interrupting them over.
  }
}

function toggleColumn(name) {
  const on = visibleNames.value.includes(name)
  // A table with no columns renders as an empty box with no way back, so the
  // last one cannot be switched off.
  if (on && visibleNames.value.length === 1) return
  visibleNames.value = on
    ? visibleNames.value.filter(n => n !== name)
    : allCols.value.map(c => c.name).filter(n => visibleNames.value.includes(n) || n === name)
  persistColumns()
}

function showAllColumns() {
  visibleNames.value = allCols.value.map(c => c.name)
  persistColumns()
}

function resetColumns() {
  if (!meta.value) return
  visibleNames.value = defaultVisible(meta.value.id)
  persistColumns()
}

const visibleColumns = computed(() => allCols.value.filter(c => visibleNames.value.includes(c.name)))

const tableColumns = computed(() => {
  const cols = visibleColumns.value.map(c => ({
    key: c.name,
    label: downstreamName(c.name),
    sortable: true,
  }))
  // Hide, do not disable: with no write scope on either axis the column itself
  // never exists.
  if (canWrite.value) cols.push({ key: '__actions', label: '', align: 'right' })
  return cols
})

// Dynamic slot names are built through a helper rather than inline, so the
// compiler sees one plain expression per slot.
const cellSlot = (name) => `cell-${name}`

// ── Search, filters, paging ────────────────────────────────────────────────

const searchColumnOptions = computed(() => [
  { label: 'All text columns', value: '' },
  ...(meta.value ? searchableColumns(meta.value.id) : []).map(n => ({ label: n, value: n })),
])

const pageSizeOptions = PAGE_SIZES.map(n => ({ label: `${n} / page`, value: String(n) }))

const pageSizeStr = computed({
  get: () => String(pageSize.value),
  set: (v) => {
    pageSize.value = Number(v)
    // useDdTable watches every query input except pageSize — its manage screens
    // never change it — so the reload is this screen's to trigger.
    if (currentPage.value !== 1) currentPage.value = 1
    else load()
  },
})

const filterValue = (name) => filters.value[name] ?? ''

function setFilter(name, value) {
  // Replaced rather than mutated: the composable's watcher is deep, but a fresh
  // object also keeps '' meaning "no filter" rather than "equals empty string".
  filters.value = { ...filters.value, [name]: value }
}

function enumFilterOptions(col) {
  return [{ label: 'Any', value: '' }, ...(col.options || []).map(v => ({ label: v, value: v }))]
}

const activeFilters = computed(() =>
  Object.values(filters.value).filter(v => v !== '' && v != null).length,
)

const isFiltered = computed(() => !!String(search.value).trim() || activeFilters.value > 0)

// A dismissal covers the changes known at that moment; a later one is new
// information and earns the banner back.
const showStale = computed(() => stale.value && !staleDismissed.value)
watch(staleCount, () => { staleDismissed.value = false })

const showDelete = computed({
  get: () => !!pendingDelete.value,
  set: (v) => { if (!v) pendingDelete.value = null },
})

// LiTable owns its own asc/desc toggle and emits both; setSort flips the same
// way off the same key, so passing the key alone keeps the two in step.
function onSort({ key }) {
  setSort(key)
}

function openCreate() {
  formRow.value = null
  formDuplicate.value = false
  showForm.value = true
}

function openEdit(row) {
  formRow.value = row
  formDuplicate.value = false
  showForm.value = true
}

function openDuplicate(row) {
  formRow.value = row
  formDuplicate.value = true
  showForm.value = true
}

async function confirmDelete() {
  const row = pendingDelete.value
  if (!row) return
  const res = await active.value?.deleteRow(row[pk.value])
  if (res?.ok) pendingDelete.value = null
}

async function exportCsv() {
  if (!meta.value) return
  exporting.value = true
  try {
    // The filtered set, not the visible page — nobody wants page 3 of their
    // export. Headers are the downstream names, so the file lines up with the
    // schema the reader is reasoning about.
    const all = await active.value.fetchAll()
    const spec = visibleColumns.value.map(c => ({ key: c.name, label: downstreamName(c.name) }))
    const stamp = new Date().toISOString().slice(0, 10)
    downloadCsv(all, spec, `${meta.value.targetTable}-${stamp}`)
  } catch (e) {
    toast.error(e.message)
  } finally {
    exporting.value = false
  }
}

// ── Table switching ────────────────────────────────────────────────────────

function activate(id) {
  if (!id) return
  restoreColumns(id)
  staleDismissed.value = false
  showFilters.value = false
  tables[id].load()
  tables[id].subscribe()
}

watch(() => meta.value?.id ?? null, (id, previous) => {
  // The realtime channel of a table nobody is looking at would keep flagging it
  // stale, and its banner would be waiting on return for changes already gone.
  if (previous) tables[previous].unsubscribe()
  activate(id)
})

onMounted(() => activate(meta.value?.id ?? null))
</script>

<style scoped>
.ddexpl { display: flex; flex-direction: column; gap: var(--space-md, 16px); }

.ddexpl__head { display: flex; align-items: flex-end; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.ddexpl__id { min-width: 0; }
/* The downstream table name is the title, in the schema's own typeface — this
   screen is about the table as it exists, not about its friendly label. */
.ddexpl__title {
  font-family: var(--font-mono, ui-monospace, monospace);
  font-size: 22px; font-weight: 700; margin: 0; letter-spacing: -0.3px;
  overflow-wrap: anywhere;
}
.ddexpl__sub {
  display: flex; align-items: center; gap: 6px; flex-wrap: wrap;
  font-family: var(--font-mono, ui-monospace, monospace);
  font-size: 12px; color: var(--color-gray-500, #8e8ea0); margin: 4px 0 0;
}
.ddexpl__sub .material-symbols-outlined { font-size: 15px; }
.ddexpl__manage {
  display: inline-flex; align-items: center; gap: 4px; margin-left: 6px;
  font-family: var(--font-body, 'Inter', sans-serif);
  font-size: 12px; font-weight: 600; text-decoration: none;
  color: #6366F1; border-bottom: 1px solid transparent; transition: border-color 160ms;
}
.ddexpl__manage:hover { border-bottom-color: currentColor; }
.ddexpl__manage .material-symbols-outlined { font-size: 15px; }

.ddexpl__actions { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.ddexpl__count {
  font-size: 12px; color: var(--color-gray-500, #8e8ea0); margin: 0; white-space: nowrap;
  font-variant-numeric: tabular-nums;
}
.ddexpl__count b { color: var(--color-gray-900, #333); font-weight: 700; }

.ddexpl__btn {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 8px 16px; border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: var(--radius-pill, 999px); background: transparent;
  font-family: var(--font-body, 'Inter', sans-serif);
  font-size: 13px; font-weight: 600; color: var(--color-gray-700, #666);
  cursor: pointer; transition: all 200ms; white-space: nowrap;
}
.ddexpl__btn:hover:not(:disabled) { background: rgba(0, 0, 0, 0.04); }
.ddexpl__btn:disabled { opacity: 0.45; cursor: not-allowed; }
.ddexpl__btn .material-symbols-outlined { font-size: 17px; }
.ddexpl__btn--primary {
  background: var(--cta-primary-bg, #FFBC25);
  color: var(--cta-primary-text, #1E1E1E);
  border-color: var(--cta-primary-bg, #FFBC25);
}
.ddexpl__btn--primary:hover:not(:disabled) { background: var(--cta-primary-hover, #FAB000); }
.ddexpl__btn--on { background: rgba(99, 102, 241, 0.1); border-color: rgba(99, 102, 241, 0.35); color: #6366F1; }
.ddexpl__pill {
  font-size: 11px; font-weight: 700; line-height: 1;
  background: #6366F1; color: #fff; border-radius: 999px; padding: 2px 6px;
}

.ddexpl__colmenu { max-height: 60vh; overflow-y: auto; min-width: 240px; padding: 2px; }
.ddexpl__colmenu-head {
  display: flex; gap: 10px; padding: 4px 8px 8px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.06); margin-bottom: 4px;
}
.ddexpl__link {
  background: none; border: none; padding: 0; cursor: pointer;
  font-family: var(--font-body, 'Inter', sans-serif);
  font-size: 12px; font-weight: 600; color: #6366F1;
}
.ddexpl__link:hover { text-decoration: underline; }
.ddexpl__colopt {
  display: flex; align-items: center; gap: 8px;
  padding: 5px 8px; border-radius: var(--radius-sm, 8px); cursor: pointer;
}
.ddexpl__colopt:hover { background: rgba(0, 0, 0, 0.04); }
.ddexpl__colopt code {
  font-family: var(--font-mono, ui-monospace, monospace); font-size: 12px;
  flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
/* Stamps are off by default, so they read as the secondary set they are. */
.ddexpl__colopt--stamp code { color: var(--color-gray-500, #8e8ea0); }
.ddexpl__coltype { font-size: 10px; color: var(--color-gray-400, #B3B3B3); letter-spacing: 0.3px; }

.ddexpl__toolbar {
  display: grid; grid-template-columns: 2fr 1.2fr 1fr auto auto;
  gap: var(--space-sm, 12px); align-items: end;
}
.ddexpl__reset {
  padding: 10px 18px; border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: var(--radius-pill, 999px); background: transparent;
  font-family: var(--font-body, 'Inter', sans-serif);
  font-size: 13px; font-weight: 600; color: var(--color-gray-700, #666);
  cursor: pointer; transition: all 200ms;
}
.ddexpl__reset:hover { background: rgba(0, 0, 0, 0.04); }

.ddexpl__colfilters {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: var(--space-sm, 12px);
  padding: 14px; border-radius: var(--radius-sm, 12px);
  background: rgba(0, 0, 0, 0.02); border: 1px solid rgba(0, 0, 0, 0.06);
}
.ddexpl__colfilter { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.ddexpl__colfilter-label {
  font-family: var(--font-mono, ui-monospace, monospace);
  font-size: 11px; color: var(--color-gray-600, #808080);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}

.ddexpl__error {
  font-size: 13px; color: var(--color-red-400, #C83E3B);
  background: rgba(200, 62, 59, 0.08);
  border-radius: var(--radius-sm, 12px); padding: 10px 14px; margin: 0;
}
.ddexpl__pagination { display: flex; justify-content: center; }

.ddexpl__stale {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 14px; border-radius: var(--radius-sm, 12px);
  background: rgba(255, 188, 37, 0.12);
  border: 1px solid rgba(255, 188, 37, 0.35);
}
.ddexpl__stale .material-symbols-outlined { font-size: 19px; color: var(--color-yellow-500, #F4A600); }
.ddexpl__stale-text { margin: 0; flex: 1; font-size: 13px; color: var(--color-gray-800, #4D4D4D); }
.ddexpl__stale-action {
  padding: 6px 14px; border: none; border-radius: var(--radius-pill, 999px);
  background: var(--cta-primary-bg, #FFBC25); color: var(--cta-primary-text, #1E1E1E);
  font-family: var(--font-body, 'Inter', sans-serif);
  font-size: 12px; font-weight: 700; cursor: pointer; transition: all 200ms;
}
.ddexpl__stale-action:hover { background: var(--cta-primary-hover, #FAB000); }
.ddexpl__stale-close {
  background: none; border: none; cursor: pointer; padding: 2px;
  display: inline-flex; color: var(--color-gray-500, #8e8ea0);
}
.ddexpl__stale-close .material-symbols-outlined { font-size: 16px; color: inherit; }

/* Every cell is monospaced: aligned digits are how a person spots the row whose
   percentage has one decimal too many. */
.ddexpl__raw {
  font-family: var(--font-mono, ui-monospace, monospace); font-size: 12px;
  display: inline-block; max-width: 260px;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap; vertical-align: bottom;
}
/* A NULL must not look like an empty string — on this screen above all others,
   that difference is the answer someone came here for. */
.ddexpl__null {
  font-style: normal; font-size: 11px; letter-spacing: 0.4px;
  color: var(--color-gray-400, #aaa);
}

.ddexpl__row-actions { display: inline-flex; align-items: center; gap: 2px; }
.ddexpl__icon-btn {
  background: none; border: none; cursor: pointer; padding: 6px;
  border-radius: var(--radius-sm, 12px);
  display: inline-flex; align-items: center; justify-content: center;
  color: var(--color-gray-400, #B3B3B3); transition: all 200ms;
}
.ddexpl__icon-btn:hover { color: var(--cta-primary-bg, #FFBC25); background: rgba(255, 188, 37, 0.12); }
.ddexpl__icon-btn--danger:hover { color: var(--color-red-400, #C83E3B); background: rgba(200, 62, 59, 0.08); }
.ddexpl__icon-btn .material-symbols-outlined { font-size: 18px; }

.ddexpl__confirm { margin: 0 0 8px; font-size: 14px; color: var(--color-gray-900, #333); }
.ddexpl__confirm code {
  font-family: var(--font-mono, ui-monospace, monospace); font-size: 12px;
  background: rgba(0, 0, 0, 0.04); border-radius: 5px; padding: 1px 6px;
}
.ddexpl__confirm-note { margin: 0; font-size: 12.5px; color: var(--color-gray-500, #8e8ea0); }

@media (max-width: 1100px) {
  .ddexpl__toolbar { grid-template-columns: 1fr 1fr; }
}
@media (max-width: 700px) {
  .ddexpl__toolbar { grid-template-columns: 1fr; }
}
</style>
