<template>
  <LiModal
    :model-value="modelValue"
    size="lg"
    :closable="!importing"
    :close-on-overlay="!importing"
    @update:model-value="onToggle"
  >
    <template #header>
      <div>
        <h2 class="ddbulk__title">Bulk upload — {{ meta.label }}</h2>
        <p class="ddbulk__sub">{{ STEPS[step].caption }}</p>
      </div>
    </template>

    <LiStepper :steps="STEPS" :current-step="step" class="ddbulk__stepper" aria-label="Bulk upload" />

    <!-- ── Choose ─────────────────────────────────────────────────────── -->
    <section v-if="step === 0" class="ddbulk__pane">
      <LiBanner
        variant="info"
        title="Start from the template"
        :message="`The template carries exactly the ${editable.length} columns you may fill in. Leave a cell empty for “not set”; id and the created/updated stamps are filled in for you.`"
      />

      <div class="ddbulk__tpl">
        <LiButton variant="secondary" size="sm" @click="downloadTemplate">Download template</LiButton>
        <span class="ddbulk__cols" :title="editableNames.join(' · ')">{{ editableNames.join(' · ') }}</span>
      </div>

      <LiUpload
        :key="resetKey"
        accept=".xlsx,.xls,.csv,.tsv,.txt"
        hint="One sheet, one header row — .xlsx, .xls or .csv"
        @change="onFilePicked"
      />

      <div class="ddbulk__or"><span>or paste rows</span></div>

      <LiTextField
        v-model="pasteText"
        type="area"
        :rows="5"
        label="Paste from Excel or Google Sheets"
        :placeholder="pastePlaceholder"
        class="ddbulk__paste"
      />

      <p v-if="parseError" class="ddbulk__error">{{ parseError }}</p>
    </section>

    <!-- ── Preview ────────────────────────────────────────────────────── -->

    <section v-else-if="step === 1" class="ddbulk__pane">
      <LiBanner
        v-if="headerInfo.missingRequired.length"
        variant="error"
        title="Required columns are missing"
        :message="`Nothing can be imported until the file has a column for: ${headerInfo.missingRequired.join(', ')}.`"
      />
      <!-- A date column nobody can read unambiguously stops the import outright.
           Importing it on a guess would silently move promo periods by months,
           and no later check would notice. -->
      <LiBanner
        v-for="b in dateBlocked" :key="b.column"
        variant="error"
        :title="`${b.column} cannot be read safely`"
        :message="`${b.reason}. Re-save the file with that column as YYYY-MM-DD — in Google Sheets, Format > Number > Custom date and time.`"
      />

      <!-- Only genuinely unplaceable headers warn. The ones we recognise and
           refuse on purpose get a quiet line below the toolbar instead — they
           appear in every DD export, and warning about them each time is how a
           warning stops being read. -->
      <LiBanner
        v-if="headerInfo.unknown.length"
        variant="warning"
        title="Some columns could not be matched"
        :message="`${headerInfo.unknown.join(', ')} — not a column of ${meta.label}, or a repeat of one already read. Check the spelling if one of these was meant to be imported.`"
      />
      <!-- Toolbar: what the file contains, and the two ways to narrow it.
           The counts are the filter rather than a caption beside one, so there
           is never a second control able to disagree about what is on screen. -->
      <div class="ddbulk__toolbar">
        <div class="ddbulk__tabs" role="group" aria-label="Filter rows">
          <button
            v-for="f in FILTERS" :key="f.value" type="button"
            class="ddbulk__tab" :class="[`is-${f.value || 'all'}`, { 'is-on': statusFilter === f.value }]"
            :disabled="!!f.value && !counts[f.value]"
            :aria-pressed="statusFilter === f.value"
            @click="statusFilter = f.value"
          >
            <span class="ddbulk__tab-n">{{ f.value ? counts[f.value] : checked.length }}</span>
            <span class="ddbulk__tab-l">{{ f.label }}</span>
          </button>
        </div>

        <div class="ddbulk__tools">
          <div class="ddbulk__find">
            <LiIcon name="search" />
            <input v-model="rowSearch" type="search" placeholder="Find a value, a line, a problem…" >
          </div>
          <button
            v-if="statusFilter || rowSearch" type="button"
            class="ddbulk__linkbtn" @click="statusFilter = ''; rowSearch = ''"
          >Clear</button>
        </div>
      </div>

      <p v-if="headerInfo.ignored.length" class="ddbulk__ignored">
        <LiIcon name="info" />
        Not imported: {{ headerInfo.ignored.join(', ') }} — the app keeps its own
        record id and stamps who wrote a row and when.
      </p>

      <p v-if="dateAssumed.length" class="ddbulk__ignored">
        <LiIcon name="event" />
        Read {{ dateAssumed.join(', ') }} — converted to YYYY-MM-DD.
      </p>

      <div class="ddbulk__grid">
        <LiTable :data="visibleRows" :columns="previewColumns" row-key="__line">
          <template #cell-__verdict="{ value }">
            <LiBadge :label="STATUS_LABEL[value]" :variant="STATUS_VARIANT[value]" size="sm" is-pill />
          </template>
          <template #cell-__problems="{ value }">
            <span v-if="!value.length" class="ddbulk__muted">—</span>
            <span v-else class="ddbulk__problems" :title="value.join('; ')">{{ value.join('; ') }}</span>
          </template>
          <template #cell-__view="{ row }">
            <button class="ddbulk__view" type="button" :aria-label="`Inspect row ${row.__line}`" title="Inspect this row" @click="openDetail(row.__line)">
              <LiIcon name="chevron_right" />
            </button>
          </template>
        </LiTable>

        <p v-if="!filteredRows.length" class="ddbulk__none">
          <LiIcon name="filter_alt_off" />
          Nothing matches. <button type="button" class="ddbulk__linkbtn" @click="statusFilter = ''; rowSearch = ''">Clear the filter</button>
        </p>
        <p v-else-if="visibleRows.length < filteredRows.length" class="ddbulk__more">
          Showing the first {{ visibleRows.length }} of {{ filteredRows.length }}. Every importable row is written, listed here or not.
        </p>
      </div>

      <LiCheckbox
        v-if="existingCount"
        v-model="allowUpdate"
        label="Update rows that already exist"
        :description="`${existingCount} row(s) match a record already in ${meta.label}. Off, they are refused; on, the file overwrites them.`"
      />

      <LiCheckbox
        v-if="counts.error"
        v-model="skipInvalid"
        label="Import the valid rows and skip the rest"
        :description="`${counts.new + counts.update} row(s) would be written, ${counts.error} left behind.`"
      />

      <LiProgress
        v-if="importing"
        :value="progressPct"
        :label="`Writing ${progressDone} of ${progressTotal}…`"
        show-value
      />
    </section>

    <!-- ── Result ─────────────────────────────────────────────────────── -->
    <section v-else class="ddbulk__pane">
      <div class="ddbulk__tiles">
        <div class="ddbulk__tile ddbulk__tile--new">
          <b>{{ result.inserted }}</b><span>inserted</span>
        </div>
        <div class="ddbulk__tile ddbulk__tile--update">
          <b>{{ result.updated }}</b><span>updated</span>
        </div>
        <div class="ddbulk__tile" :class="{ 'ddbulk__tile--error': skippedTotal }">
          <b>{{ skippedTotal }}</b><span>skipped</span>
        </div>
      </div>

      <p v-if="!resultErrors.length" class="ddbulk__ok">Every row went through.</p>

      <template v-else>
        <div class="ddbulk__failhead">
          <p class="ddbulk__failtitle">{{ resultErrors.length }} row(s) were not written</p>
          <LiButton variant="secondary" size="sm" @click="downloadErrors">Download error report</LiButton>
        </div>
        <ul class="ddbulk__fails">
          <li v-for="(e, i) in resultErrors" :key="i" class="ddbulk__fail">
            <span class="ddbulk__failkey">
              <template v-if="e.line">Line {{ e.line }}</template>
              <template v-if="e.line && e.key"> · </template>
              <template v-if="e.key">{{ e.key }}</template>
            </span>
            <span class="ddbulk__failmsg">{{ e.problems.join('; ') }}</span>
          </li>
        </ul>
      </template>
    </section>

    <!-- Nested inside the upload modal on purpose: the person is mid-review and
         should come back to the same filter and scroll position, which a route
         change or a replaced modal body would both throw away. -->
    <LiModal v-model="detailOpen" :title="detailRow ? `Line ${detailRow.line}` : ''" size="md">
      <div v-if="detailRow" class="ddbulk__detail">
        <div class="ddbulk__detail-head">
          <LiBadge
            :label="STATUS_LABEL[detailRow.status]"
            :variant="STATUS_VARIANT[detailRow.status]"
            size="sm" is-pill
          />
          <code class="ddbulk__detail-key">{{ detailRow.key || '—' }}</code>
        </div>

        <ul v-if="detailRow.problems.length" class="ddbulk__detail-problems">
          <li v-for="(p, i) in detailRow.problems" :key="i">{{ p }}</li>
        </ul>

        <dl class="ddbulk__detail-fields">
          <template v-for="f in detailFields" :key="f.name">
            <dt :class="{ 'is-missing': !f.present }">
              {{ f.label }}
              <code>{{ f.name }}</code>
              <span v-if="!f.present" class="ddbulk__detail-note">not in file</span>
            </dt>
            <dd :class="{ 'is-empty': f.value === '' || f.value == null }">
              <template v-if="f.value === '' || f.value == null">
                {{ f.required ? 'required, but empty' : '—' }}
              </template>
              <template v-else>{{ f.value }}</template>
            </dd>
          </template>
        </dl>
      </div>
      <template #footer>
        <LiButton variant="ghost" @click="detailLine = null">Close</LiButton>
      </template>
    </LiModal>

    <template #footer>
      <template v-if="step === 0">
        <LiButton variant="ghost" @click="close">Cancel</LiButton>
        <LiButton :disabled="!hasInput" :loading="preparing" @click="toPreview">Preview rows</LiButton>
      </template>
      <template v-else-if="step === 1">
        <LiButton variant="ghost" :disabled="importing" @click="backToChoose">Back</LiButton>
        <LiButton :disabled="!canImport" :loading="importing" @click="runImport">
          Import {{ importable.length }} row{{ importable.length === 1 ? '' : 's' }}
        </LiButton>
      </template>
      <template v-else>
        <LiButton variant="ghost" @click="reset">Upload another file</LiButton>
        <LiButton @click="close">Done</LiButton>
      </template>
    </template>
  </LiModal>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import LiModal from '@lib/components/LiModal.vue'
import LiStepper from '@lib/components/LiStepper.vue'
import LiButton from '@lib/components/LiButton.vue'
import LiBanner from '@lib/components/LiBanner.vue'
import LiUpload from '@lib/components/LiUpload.vue'
import LiTextField from '@lib/components/LiTextField.vue'
import LiCheckbox from '@lib/components/LiCheckbox.vue'
import LiTable from '@lib/components/LiTable.vue'
import LiBadge from '@lib/components/LiBadge.vue'
import LiProgress from '@lib/components/LiProgress.vue'
import { useToast } from '@lib/composables/useToast.js'
import { supabase } from '@/lib/supabase.js'
import { exportToXlsx } from '@lib/export-xlsx.js'
import { DD_TABLES } from '../lib/schema.js'
import { editableColumns } from '../lib/columns.js'
import { validateRow } from '../lib/validate.js'
import { downloadCsv } from '../lib/csv.js'
import { parseDelimited, parseWorkbook, mapHeaders, toRecords, resolveDates, DATE_ORDER_LABEL } from '../lib/tabular.js'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  tableId: { type: String, required: true },
  /** useDdTable's bulkUpsert: (rows, onProgress) => { inserted, updated, skipped, errors } */
  bulkUpsert: { type: Function, required: true },
})
const emit = defineEmits(['update:modelValue', 'done'])

const toast = useToast()

// Rendering every parsed row would put a thousand DOM rows inside a modal for
// no gain; the counts and the error filter are what people actually read.
const PREVIEW_LIMIT = 200

const STEPS = [
  { label: 'Choose', caption: 'Pick a file or paste rows', clickable: false },
  { label: 'Preview', caption: 'Check what will be written', clickable: false },
  { label: 'Result', caption: 'What was written', clickable: false },
]

const STATUS_LABEL = { new: 'New', update: 'Update', error: 'Error' }
const STATUS_VARIANT = { new: 'success', update: 'info', error: 'error' }

// Joins the parts of a composite business key. A control character, so ('AB','C')
// and ('A','BC') cannot collide the way a printable separator would allow.
const KEY_SEP = String.fromCharCode(1)

// The preview table's own columns are prefixed because a data column may be
// called `status` — merchants and promos both have one — and the verdict must
// not overwrite the value being judged.
const VERDICT_KEY = '__verdict'
const LINE_KEY = '__line'
const PROBLEMS_KEY = '__problems'

const meta = computed(() => DD_TABLES[props.tableId] ?? { label: props.tableId, local: '', keyColumns: [] })
const editable = computed(() => editableColumns(props.tableId))
const editableNames = computed(() => editable.value.map(c => c.name))

const step = ref(0)
const resetKey = ref(0)
const pasteText = ref('')
const pickedFile = ref(null)
const parseError = ref('')
const preparing = ref(false)

const parsed = ref({ headers: [], rows: [] })
const records = ref([])
const existingKeys = ref(new Set())

// '' is "everything"; the rest match a row's verdict.
const FILTERS = [
  { value: '', label: 'rows' },
  { value: 'new', label: 'new' },
  { value: 'update', label: 'update' },
  { value: 'error', label: 'error' },
]
const statusFilter = ref('')
const allowUpdate = ref(false)
const dateOrders = ref({})
const dateBlocked = ref([])
const dateRowIssues = ref(new Map())
const rowSearch = ref('')
const detailLine = ref(null)
const skipInvalid = ref(false)

const importing = ref(false)
const progressDone = ref(0)
const progressTotal = ref(0)
const result = ref({ inserted: 0, updated: 0, skipped: 0, errors: [] })
// Rows the preview refused to send. bulkUpsert never sees them, so its own
// `skipped` count would under-report what happened.
const localSkipped = ref([])

const hasInput = computed(() => !!pickedFile.value || pasteText.value.trim() !== '')

// Shows the shape of a paste for *this* table, tab-separated, which is what a
// spreadsheet actually puts on the clipboard.
const pastePlaceholder = computed(() => editableNames.value.slice(0, 4).join('\t'))

// ── Choose ──────────────────────────────────────────────────────────────────

/**
 * One example row so the template shows the shape a value should take —
 * a fraction that adds to 1, an account number with its leading digits intact,
 * a date in the format Postgres wants.
 */
const SAMPLES = {
  bu_accounts: {
    name: 'Example BU',
    sof: 'PRIME',
    account1: '101001360540601000000001',
    acctname1: 'CTBU Prime Discount Expense - Example BU',
    percentage1: '0.7500',
    account2: '101001360540601000000002',
    acctname2: 'CTBU Prime Discount Receivable - Example BU',
    percentage2: '0.2500',
  },
  merchants: {
    merchant_id: '00000900001',
    merchant_name: 'EXAMPLE STORE',
    bu_name: 'Example BU',
    status: 'ACTIVE',
  },
  promos: {
    promo_id: 'example_promo_26_08_1',
    promo_name: 'Example Payday Promo',
    merchant_id: '',
    bu_name: 'Example BU',
    start_date: '2026-09-01',
    end_date: '2026-09-08',
    prm_discount_type: 'PERCENTAGE',
    prm_discount_value: '10.00',
    prm_max_discount: '50000.00',
    pl_discount_type: '',
    pl_discount_value: '',
    pl_max_discount: '',
    min_txn_amount: '50000.00',
    max_txn_amount: '',
    budget_amount: '100000000.00',
    priority: '1',
    status: 'ACTIVE',
  },
}

function downloadTemplate() {
  const sample = SAMPLES[props.tableId] ?? {}
  // Headers are the local column names, not the labels: they are what comes
  // back out of a re-import unchanged. mapHeaders accepts either.
  const cols = editableNames.value.map(name => ({ key: name, label: name }))
  exportToXlsx([sample], cols, `dd-${props.tableId}-template`)
}

function onFilePicked(files) {
  pickedFile.value = files?.[0] ?? null
  parseError.value = ''
}

async function readInput() {
  const file = pickedFile.value
  if (file) {
    // A .csv arrives as text even from the file picker; only a real workbook
    // needs the xlsx reader.
    if (/\.(xlsx|xls)$/i.test(file.name)) return parseWorkbook(await file.arrayBuffer())
    return parseDelimited(await file.text())
  }
  return parseDelimited(pasteText.value)
}

/**
 * Existing business keys, one column-limited read rather than a probe per row.
 * Paged because PostgREST caps a single response and a silently truncated key
 * set would label existing rows as new.
 */
async function loadExistingKeys() {
  const cols = meta.value.keyColumns
  const keys = new Set()
  const PAGE = 1000
  for (let from = 0; from < PAGE * 50; from += PAGE) {
    const { data, error } = await supabase
      .from(meta.value.local)
      .select(cols.join(','))
      .range(from, from + PAGE - 1)
    if (error) throw error
    for (const r of data || []) keys.add(keyOf(r))
    if (!data || data.length < PAGE) break
  }
  return keys
}

/** Exact, case-sensitive match — the same comparison the writer and the unique
 *  index make. Being friendlier here would only disagree with them. */
function keyOf(row) {
  return meta.value.keyColumns.map(c => String(row?.[c] ?? '').trim()).join(KEY_SEP)
}

/** A row with no key at all is already an error; it must not count as a
 *  duplicate of the next equally empty one. */
const isKeyBlank = (row) =>
  meta.value.keyColumns.every(c => String(row?.[c] ?? '').trim() === '')

function keyLabel(row) {
  return meta.value.keyColumns.map(c => String(row?.[c] ?? '').trim()).filter(Boolean).join(' · ')
}

async function toPreview() {
  preparing.value = true
  parseError.value = ''
  try {
    const grid = await readInput()
    if (!grid.headers.length || !grid.rows.length) {
      parseError.value = 'No data rows found — the first row must be the column headers.'
      return
    }
    parsed.value = grid
    // Dates are normalised here, with the whole file in view: a column's own
    // rows are the only honest evidence for whether it is day-first, and one
    // value can never settle it.
    const built = toRecords(props.tableId, grid.headers, grid.rows)
    const dates = resolveDates(props.tableId, built)
    records.value = dates.records
    dateOrders.value = dates.orders
    dateBlocked.value = dates.blocked
    dateRowIssues.value = dates.rowIssues
    existingKeys.value = await loadExistingKeys()
    statusFilter.value = ''
    rowSearch.value = ''
    detailLine.value = null
    allowUpdate.value = false
  dateOrders.value = {}
  dateBlocked.value = []
  dateRowIssues.value = new Map()
    dateOrders.value = {}
    dateBlocked.value = []
    dateRowIssues.value = new Map()
    skipInvalid.value = false
    step.value = 1
  } catch (e) {
    parseError.value = `Could not read that: ${e.message}`
  } finally {
    preparing.value = false
  }
}

// ── Preview ─────────────────────────────────────────────────────────────────

const headerInfo = computed(() => mapHeaders(props.tableId, parsed.value.headers))

/**
 * Every parsed row with its verdict. Duplicates *within the file* are errors
 * too: two rows claiming the same key is a mistake in the source, and letting
 * the later one quietly win is how a wrong value gets written on purpose.
 */
const checked = computed(() => {
  const seen = new Map()
  const blocked = headerInfo.value.missingRequired
  return records.value.map((rec, i) => {
    const line = i + 2 // +1 for zero-based, +1 for the header row they can see
    const problems = validateRow(props.tableId, rec)
    const k = keyOf(rec)

    if (blocked.length) problems.push(`missing column(s): ${blocked.join(', ')}`)
    problems.push(...(dateRowIssues.value.get(i) ?? []))
    if (!isKeyBlank(rec)) {
      if (seen.has(k)) problems.push(`duplicate of line ${seen.get(k)} in this file`)
      else seen.set(k, line)
    }

    // An already-registered key is a problem, not a silent overwrite: a file
    // drop should not be able to rewrite a record someone else created. Ticking
    // `allowUpdate` turns the same rows into deliberate updates.
    const exists = !isKeyBlank(rec) && existingKeys.value.has(k)
    if (exists && !allowUpdate.value) {
      problems.push(`"${keyLabel(rec)}" is already registered`)
    }

    const status = problems.length ? 'error' : (exists ? 'update' : 'new')
    return { line, key: keyLabel(rec), status, problems, rec, exists }
  })
})

/** Rows whose key is already registered, whatever the current verdict — the
 *  opt-in has to stay visible after ticking it, or it could never be unticked. */
/** Only worth saying when a conversion actually happened; a file already in
 *  YYYY-MM-DD needs no explanation. */
const dateAssumed = computed(() =>
  Object.entries(dateOrders.value)
    .filter(([, o]) => o === 'day' || o === 'month')
    .map(([col, o]) => `${col} as ${DATE_ORDER_LABEL[o]}`),
)

const existingCount = computed(() => checked.value.filter(r => r.exists).length)

const counts = computed(() => ({
  new: checked.value.filter(r => r.status === 'new').length,
  update: checked.value.filter(r => r.status === 'update').length,
  error: checked.value.filter(r => r.status === 'error').length,
}))

/**
 * Status and free text, both applied here so the table, the "showing N of M"
 * line and the empty state can never describe different sets.
 *
 * The search covers the parsed values and the problem text, not just the key: a
 * reader looking for what went wrong is as likely to search "Alfamart" or
 * "already exists" as a merchant id.
 */
const filteredRows = computed(() => {
  const term = rowSearch.value.trim().toLowerCase()
  return checked.value.filter((r) => {
    if (statusFilter.value && r.status !== statusFilter.value) return false
    if (!term) return true
    if (String(r.line).includes(term)) return true
    if (r.problems.some(p => p.toLowerCase().includes(term))) return true
    return Object.values(r.rec).some(v => String(v ?? '').toLowerCase().includes(term))
  })
})

/** The row behind the open detail panel, found by line so the lookup survives
 *  the filter changing underneath it. */
const detailRow = computed(() =>
  detailLine.value == null ? null : checked.value.find(r => r.line === detailLine.value) ?? null,
)

/**
 * Every editable column, not only the ones the file carried — the reason a row
 * is wrong is often a column that is missing, and a detail view that hides the
 * absent ones cannot show that.
 */
const detailFields = computed(() => {
  const r = detailRow.value
  if (!r) return []
  return editable.value.map(c => ({
    name: c.name,
    label: c.label,
    value: r.rec[c.name],
    present: headerInfo.value.mapping.includes(c.name),
    required: !!c.required,
  }))
})

function openDetail(line) { detailLine.value = line }

// LiModal wants a writable boolean; the source of truth is which line is open.
const detailOpen = computed({
  get: () => detailLine.value != null,
  set: (v) => { if (!v) detailLine.value = null },
})

// Only the columns the file actually carries — showing seventeen empty promo
// columns because one was pasted helps nobody.
const dataColumns = computed(() =>
  editable.value
    .filter(c => headerInfo.value.mapping.includes(c.name))
    .map(c => ({ key: c.name, label: c.label })),
)

const previewColumns = computed(() => [
  { key: VERDICT_KEY, label: '' },
  { key: LINE_KEY, label: 'Line' },
  ...dataColumns.value,
  { key: PROBLEMS_KEY, label: 'Problems' },
  { key: '__view', label: '' },
])

/**
 * LiTable reads a cell straight off the row object, so each preview row is the
 * record itself plus the three prefixed columns. Values are rendered here
 * rather than through a per-column slot: a null and an empty string both mean
 * "nothing was given" to a reader, and one em dash says that in every column.
 */
const visibleRows = computed(() =>
  filteredRows.value.slice(0, PREVIEW_LIMIT).map((r) => {
    const out = { [VERDICT_KEY]: r.status, [LINE_KEY]: r.line, [PROBLEMS_KEY]: r.problems, __view: '' }
    dataColumns.value.forEach(({ key }) => {
      const v = r.rec[key]
      out[key] = (v === '' || v == null) ? '—' : v
    })
    return out
  }),
)

const importable = computed(() =>
  skipInvalid.value ? checked.value.filter(r => r.status !== 'error') : checked.value,
)

const canImport = computed(() =>
  !importing.value
  && !headerInfo.value.missingRequired.length
  // An unreadable date column blocks everything, not just its own rows: the
  // alternative is importing a promo whose period is months off.
  && !dateBlocked.value.length
  && importable.value.length > 0
  && (skipInvalid.value || !counts.value.error),
)

const progressPct = computed(() =>
  progressTotal.value ? Math.round((progressDone.value / progressTotal.value) * 100) : 0,
)

async function runImport() {
  if (!canImport.value) return
  importing.value = true
  progressDone.value = 0
  progressTotal.value = importable.value.length
  localSkipped.value = skipInvalid.value ? checked.value.filter(r => r.status === 'error') : []

  try {
    const res = await props.bulkUpsert(
      importable.value.map(r => r.rec),
      (done, total) => { progressDone.value = done; progressTotal.value = total },
      { allowUpdate: allowUpdate.value },
    )
    result.value = res ?? { inserted: 0, updated: 0, skipped: 0, errors: [] }
    step.value = 2
    if (result.value.inserted || result.value.updated) {
      toast.success(`${result.value.inserted} inserted, ${result.value.updated} updated`)
      emit('done')
    }
  } catch (e) {
    toast.error(`Import failed: ${e.message}`)
  } finally {
    importing.value = false
  }
}

// ── Result ──────────────────────────────────────────────────────────────────

const skippedTotal = computed(() => (result.value.skipped || 0) + localSkipped.value.length)

/**
 * bulkUpsert numbers a failed row within whatever slice it was working on —
 * the valid subset, or one insert batch — so its `line` does not point at a
 * line of the file the person is holding. Where the key identifies the row, the
 * preview's own line number is used instead and theirs is the fallback.
 */
const resultErrors = computed(() => {
  const lineByKey = new Map(checked.value.filter(r => r.key).map(r => [r.key, r.line]))
  return [
    ...localSkipped.value.map(r => ({ line: r.line, key: r.key, problems: r.problems })),
    ...(result.value.errors || []).map((e) => {
      const key = e.key == null ? '' : String(e.key)
      return { line: lineByKey.get(key) ?? e.line ?? null, key, problems: e.problems || [] }
    }),
  ]
})

function downloadErrors() {
  // bulkUpsert reports a line number relative to whatever slice it was working
  // on, so the failed row is found again by its key. bu_accounts has no key the
  // writer can report, so those rows come out as key + problems only.
  const byKey = new Map(checked.value.map(r => [r.key, r.rec]))
  const rows = resultErrors.value.map(e => ({
    line: e.line ?? '',
    key: e.key,
    problems: e.problems.join('; '),
    ...(byKey.get(e.key) ?? {}),
  }))
  const cols = [
    { key: 'line', label: 'Line' },
    { key: 'key', label: 'Key' },
    { key: 'problems', label: 'Problems' },
    ...editableNames.value.map(name => ({ key: name, label: name })),
  ]
  downloadCsv(rows, cols, `dd-${props.tableId}-import-errors`)
}

// ── Shell ───────────────────────────────────────────────────────────────────

function reset() {
  step.value = 0
  pasteText.value = ''
  pickedFile.value = null
  parseError.value = ''
  parsed.value = { headers: [], rows: [] }
  records.value = []
  existingKeys.value = new Set()
  statusFilter.value = ''
  rowSearch.value = ''
  detailLine.value = null
  allowUpdate.value = false
  dateOrders.value = {}
  dateBlocked.value = []
  dateRowIssues.value = new Map()
  skipInvalid.value = false
  progressDone.value = 0
  progressTotal.value = 0
  result.value = { inserted: 0, updated: 0, skipped: 0, errors: [] }
  localSkipped.value = []
  // LiUpload copies its file list once at setup, so clearing ours is not enough
  // to make it forget the last file — it has to be remounted.
  resetKey.value++
}

function backToChoose() {
  step.value = 0
}

function close() {
  emit('update:modelValue', false)
}

function onToggle(open) {
  // A half-written import must not be abandoned by an Escape or an overlay
  // click; the writes are already in flight and the report is the only place
  // the failures are named.
  if (!open && importing.value) return
  emit('update:modelValue', open)
}

watch(() => props.modelValue, (open) => { if (open) reset() })
</script>

<style scoped>
.ddbulk__title { margin: 0; font-size: 18px; font-weight: 700; letter-spacing: -0.2px; }
.ddbulk__sub { margin: 2px 0 0; font-size: 13px; color: var(--color-gray-500, #8e8ea0); }

.ddbulk__stepper { margin-bottom: var(--space-l, 16px); }
.ddbulk__pane { display: flex; flex-direction: column; gap: var(--space-m, 12px); }

.ddbulk__tpl { display: flex; align-items: center; gap: var(--space-s, 8px); flex-wrap: wrap; }
.ddbulk__cols {
  flex: 1; min-width: 0;
  font-family: var(--font-mono, ui-monospace, monospace); font-size: 10.5px;
  color: var(--color-on-surface-muted, #999);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}

/* A labelled rule, so the two input routes read as alternatives rather than as
   steps to be done in order. */
.ddbulk__or {
  display: flex; align-items: center; gap: 10px;
  font-size: 11px; letter-spacing: 0.5px; text-transform: uppercase;
  color: var(--color-gray-400, #aaa);
}
.ddbulk__or::before, .ddbulk__or::after {
  content: ''; flex: 1; height: 1px; background: rgba(0, 0, 0, 0.08);
}
.ddbulk__paste :deep(textarea) {
  font-family: var(--font-mono, ui-monospace, monospace); font-size: 12px; white-space: pre;
}

.ddbulk__error {
  margin: 0; font-size: 13px; color: var(--color-error, #C83E3B);
  background: var(--color-error-container, rgba(200, 62, 59, 0.08));
  border-radius: var(--radius-sm, 12px); padding: 10px 14px;
}




.ddbulk__reset:hover { background: rgba(0,0,0,0.04); }






.ddbulk__view {
  border: none; background: transparent; cursor: pointer; padding: 2px 4px;
  color: var(--color-gray-400, #aaa); display: inline-flex;
}
.ddbulk__view:hover { color: #6366F1; }
.ddbulk__view .li-icon { font-size: 17px; }

.ddbulk__detail { display: flex; flex-direction: column; gap: var(--space-m, 12px); }
.ddbulk__detail-head { display: flex; align-items: center; gap: 8px; }
.ddbulk__detail-key {
  font-family: var(--font-mono, ui-monospace, monospace); font-size: 12px;
  background: rgba(0,0,0,0.04); border-radius: 5px; padding: 2px 7px;
}
.ddbulk__detail-problems {
  margin: 0; padding: 10px 14px 10px 28px; border-radius: var(--radius-sm, 12px);
  background: rgba(200, 62, 59, 0.08); color: var(--color-red-400, #C83E3B);
  font-size: 13px; line-height: 1.6;
}
.ddbulk__detail-fields {
  display: grid; grid-template-columns: minmax(140px, 40%) 1fr;
  gap: 1px; margin: 0; background: rgba(0,0,0,0.06);
  border: 1px solid rgba(0,0,0,0.06); border-radius: var(--radius-sm, 12px); overflow: hidden;
}
.ddbulk__detail-fields dt,
.ddbulk__detail-fields dd { margin: 0; padding: 8px 12px; background: #fff; font-size: 13px; }
.ddbulk__detail-fields dt { display: flex; align-items: baseline; gap: 6px; flex-wrap: wrap; color: var(--color-gray-700, #555); }
.ddbulk__detail-fields dt code {
  font-family: var(--font-mono, ui-monospace, monospace); font-size: 11px;
  color: var(--color-gray-400, #aaa);
}
.ddbulk__detail-fields dt.is-missing { background: rgba(0,0,0,0.02); }
.ddbulk__detail-note { font-size: 10px; letter-spacing: 0.3px; color: var(--color-gray-400, #aaa); }
.ddbulk__detail-fields dd { word-break: break-word; }
.ddbulk__detail-fields dd.is-empty { color: var(--color-gray-400, #aaa); }






/* The preview is the one table in the app that is genuinely wide — every
   pasted column plus a problems column — so it scrolls in both directions
   inside the modal instead of stretching it. */
.ddbulk__grid { max-height: 320px; overflow: auto; }
.ddbulk__grid :deep(th), .ddbulk__grid :deep(td) {
  padding: 6px 10px; font-size: 11.5px; white-space: nowrap;
  max-width: 220px; overflow: hidden; text-overflow: ellipsis;
}
.ddbulk__grid :deep(th) { position: sticky; top: 0; z-index: 1; }
.ddbulk__problems { color: var(--color-error, #C83E3B); white-space: normal; }
.ddbulk__muted { color: var(--color-gray-400, #aaa); }
.ddbulk__more { margin: 0; font-size: 11.5px; color: var(--color-on-surface-muted, #999); }

.ddbulk__tiles { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--space-m, 12px); }
.ddbulk__tile {
  display: flex; flex-direction: column; align-items: center; gap: 2px;
  padding: var(--space-l, 16px); border-radius: var(--radius-md, 16px);
  background: rgba(0, 0, 0, 0.04);
}
.ddbulk__tile b { font-size: 26px; font-weight: 800; letter-spacing: -0.5px; }
.ddbulk__tile span { font-size: 12px; color: var(--color-gray-500, #8e8ea0); }
.ddbulk__tile--new { background: var(--color-success-container, #E6F4EA); color: var(--color-on-success-container, #137333); }
.ddbulk__tile--update { background: var(--color-info-container, #E6E6FF); color: var(--color-on-info-container, #0047B2); }
.ddbulk__tile--error { background: var(--color-error-container, #FDECEE); color: var(--color-on-error-container, #A33129); }

.ddbulk__ok { margin: 0; font-size: 13px; color: var(--color-gray-500, #8e8ea0); }
.ddbulk__failhead { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.ddbulk__failtitle { margin: 0; font-size: 13px; font-weight: 600; }
.ddbulk__fails {
  list-style: none; margin: 0; padding: 0; max-height: 240px; overflow-y: auto;
  display: flex; flex-direction: column; gap: 6px;
}
.ddbulk__fail {
  display: flex; gap: 10px; font-size: 12px; line-height: 1.5;
  padding: 6px 10px; border-radius: var(--radius-xs, 8px);
  background: var(--color-error-container, #FDECEE);
}
.ddbulk__failkey { flex: none; font-weight: 700; color: var(--color-on-error-container, #A33129); }
.ddbulk__failmsg { color: var(--color-gray-700, #666); }

@media (max-width: 640px) {
  .ddbulk__tiles { grid-template-columns: 1fr; }
}
.ddbulk__ignored {
  display: flex; align-items: center; gap: 6px; margin: 0;
  font-size: 12px; color: var(--color-gray-500, #8e8ea0);
}
.ddbulk__ignored .li-icon { font-size: 15px; }

/* ── Preview toolbar ─────────────────────────────────────────────────────── */
.ddbulk__toolbar {
  display: flex; align-items: center; justify-content: space-between;
  gap: var(--space-m, 12px); flex-wrap: wrap;
}

/* Segmented control: one row of verdicts, the live one lifted out of the
   track. Reads as a set of mutually exclusive choices, which it is. */
.ddbulk__tabs {
  display: inline-flex; padding: 3px; gap: 2px;
  background: rgba(0, 0, 0, 0.04); border-radius: var(--radius-pill, 999px);
}
.ddbulk__tab {
  display: inline-flex; align-items: baseline; gap: 5px;
  border: none; background: transparent; cursor: pointer;
  padding: 6px 14px; border-radius: var(--radius-pill, 999px);
  font-family: var(--font-body, 'Inter', sans-serif);
  color: var(--color-gray-700, #555); transition: background 160ms, color 160ms, box-shadow 160ms;
}
.ddbulk__tab-n { font-size: 13px; font-weight: 700; font-variant-numeric: tabular-nums; }
.ddbulk__tab-l { font-size: 12px; }
.ddbulk__tab:disabled { opacity: 0.35; cursor: not-allowed; }
.ddbulk__tab:not(:disabled):hover { background: rgba(0, 0, 0, 0.05); }
.ddbulk__tab.is-on {
  background: #fff; color: var(--color-on-surface, #1a1a2e);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.10);
}
/* Colour only carries the verdict on the active tab; colouring all four at
   rest would make the strip read as four warnings. */
.ddbulk__tab.is-on.is-new .ddbulk__tab-n { color: #0F8A5F; }
.ddbulk__tab.is-on.is-update .ddbulk__tab-n { color: #B26B00; }
.ddbulk__tab.is-on.is-error .ddbulk__tab-n { color: var(--color-red-400, #C83E3B); }

.ddbulk__tools { display: inline-flex; align-items: center; gap: 8px; }
.ddbulk__find {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 7px 12px; min-width: 240px;
  border: 1px solid rgba(0, 0, 0, 0.1); border-radius: var(--radius-pill, 999px);
  background: #fff; transition: border-color 160ms, box-shadow 160ms;
}
.ddbulk__find:focus-within { border-color: #6366F1; box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.12); }
.ddbulk__find .li-icon { font-size: 17px; color: var(--color-gray-400, #aaa); }
.ddbulk__find input {
  border: none; outline: none; background: transparent; width: 100%;
  font-family: var(--font-body, 'Inter', sans-serif); font-size: 13px;
  color: var(--color-on-surface, #1a1a2e);
}
.ddbulk__find input::-webkit-search-cancel-button { cursor: pointer; }

.ddbulk__linkbtn {
  border: none; background: transparent; cursor: pointer; padding: 4px 2px;
  font-family: var(--font-body, 'Inter', sans-serif); font-size: 12px; font-weight: 600;
  color: #6366F1;
}
.ddbulk__linkbtn:hover { text-decoration: underline; }

.ddbulk__none {
  display: flex; align-items: center; justify-content: center; gap: 8px;
  padding: 28px 16px; margin: 0; font-size: 13px;
  color: var(--color-gray-500, #8e8ea0);
}
.ddbulk__none .li-icon { font-size: 19px; }

.ddbulk__view {
  border: none; background: transparent; cursor: pointer; padding: 2px;
  color: var(--color-gray-400, #aaa); display: inline-flex; border-radius: 50%;
  transition: background 160ms, color 160ms;
}
.ddbulk__view:hover { background: rgba(99, 102, 241, 0.1); color: #6366F1; }
.ddbulk__view .li-icon { font-size: 18px; }
</style>
