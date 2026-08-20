<template>
  <section class="ddexp">
    <header class="ddexp__head">
      <div>
        <h1 class="ddexp__title">Export</h1>
        <p class="ddexp__sub">MySQL for the DBA, XLSX for everyone else.</p>
      </div>
      <p class="ddexp__count">
        {{ pendingCount }} pending change{{ pendingCount === 1 ? '' : 's' }}
      </p>
    </header>

    <LiEmptyState
      v-if="!readableTables.length"
      icon="lock"
      title="No tables to export"
      description="You do not have read access to any of the DD tables, so there is nothing this screen can produce."
    />

    <div v-else class="ddexp__panels">
      <!-- ── Delta ──────────────────────────────────────────────────────── -->
      <article class="ddexp__panel">
        <header class="ddexp__panel-head">
          <h2 class="ddexp__panel-title">Delta</h2>
          <p class="ddexp__panel-lead">
            Only what moved since the cutoff, replayed from the audit log. A row
            created and deleted again inside the window produces no statement.
          </p>
        </header>

        <div class="ddexp__cutoff">
          <LiTextField v-model="cutoff" label="Changes since" type="datetime-local" />
          <LiButton variant="secondary" :loading="loading" @click="load">Refresh</LiButton>
        </div>
        <p class="ddexp__hint">
          <template v-if="lastExportedAt">
            Last marked exported {{ formatRelative(lastExportedAt) }}, on this browser only.
          </template>
          <template v-else>
            No export marked yet on this browser — defaulting to the last 24 hours.
          </template>
        </p>

        <p v-if="error" class="ddexp__error">{{ error }}</p>
        <p v-if="truncated" class="ddexp__warn">
          The audit log returned as much as this screen reads in one go. Move the
          cutoff forward, export, mark it, then come back for the rest.
        </p>
        <ul v-if="warnings.length" class="ddexp__warn-list">
          <li v-for="(w, i) in warnings" :key="i">{{ w }}</li>
        </ul>

        <LiEmptyState
          v-if="!loading && !pendingCount"
          icon="check_circle"
          size="sm"
          title="Nothing pending"
          description="No table changed after the cutoff, so there is nothing to send downstream."
        />

        <LiTable
          v-else
          :data="pendingChanges"
          :columns="deltaColumns"
          row-key="key"
          :loading="loading"
        >
          <template #cell-tableId="{ value }">{{ tableLabel(value) }}</template>
          <template #cell-action="{ value }">
            <LiBadge :label="value" :variant="actionVariant(value)" size="sm" is-pill />
          </template>
          <template #cell-key="{ row }">
            <code class="ddexp__key">{{ row.key }}</code>
            <!-- A rename is the one case where the downstream WHERE clause does
                 not match what is on screen, so it is spelled out. -->
            <span v-if="row.where" class="ddexp__renamed">was {{ row.matchKey }}</span>
          </template>
          <template #cell-at="{ value }">{{ formatRelative(value) }}</template>
        </LiTable>

        <footer class="ddexp__panel-foot">
          <LiButton variant="secondary" :disabled="!pendingCount" @click="previewDelta">
            Preview SQL
          </LiButton>
          <LiButton variant="secondary" :disabled="!pendingCount" @click="downloadDelta">
            Download .sql
          </LiButton>
          <LiButton :disabled="!pendingCount || loading" @click="confirmMark = true">
            Mark as exported
          </LiButton>
        </footer>
      </article>

      <!-- ── Full ───────────────────────────────────────────────────────── -->
      <article class="ddexp__panel">
        <header class="ddexp__panel-head">
          <h2 class="ddexp__panel-title">Full</h2>
          <p class="ddexp__panel-lead">
            Every row of the tables you tick, as INSERTs. For seeding a fresh
            instance, not for a routine update.
          </p>
        </header>

        <ul class="ddexp__tables">
          <li v-for="id in readableTables" :key="id" class="ddexp__table">
            <LiCheckbox
              :model-value="picked.includes(id)"
              :label="tableLabel(id)"
              @update:model-value="v => togglePicked(id, v)"
            />
            <span class="ddexp__target">{{ target(id) }}</span>
            <span class="ddexp__rows">
              <template v-if="counts[id] != null">{{ counts[id] }} row(s)</template>
              <template v-else>—</template>
            </span>
          </li>
        </ul>

        <p class="ddexp__hint">
          {{ pickedRowCount }} row(s) selected across {{ picked.length }} table(s).
        </p>

        <footer class="ddexp__panel-foot">
          <LiButton
            variant="secondary"
            :disabled="!picked.length"
            :loading="building === 'preview'"
            @click="previewFull"
          >
            Preview SQL
          </LiButton>
          <LiButton
            variant="secondary"
            :disabled="!picked.length"
            :loading="building === 'sql'"
            @click="downloadFull"
          >
            Download .sql
          </LiButton>
          <LiButton
            :disabled="!picked.length"
            :loading="building === 'xlsx'"
            @click="downloadXlsx"
          >
            Download .xlsx
          </LiButton>
        </footer>
      </article>
    </div>

    <!-- ── Preview ──────────────────────────────────────────────────────── -->
    <LiModal v-model="showPreview" size="lg">
      <template #header>
        <div>
          <h2 class="ddexp__modal-title">{{ previewMode === 'full' ? 'Full export' : 'Delta export' }}</h2>
          <p class="ddexp__modal-sub">
            {{ totalLines }} line(s) · read it before you send it
          </p>
        </div>
      </template>

      <div class="ddexp__code">
        <div v-for="(line, i) in shownLines" :key="i" class="ddexp__line">
          <span class="ddexp__ln">{{ i + 1 }}</span>
          <code class="ddexp__src" :class="{ 'is-comment': line.startsWith('--') }">{{ line || ' ' }}</code>
        </div>
      </div>
      <p v-if="hiddenLines" class="ddexp__hint">
        {{ hiddenLines }} more line(s) are in the file but not shown here.
      </p>

      <template #footer>
        <LiButton variant="ghost" @click="showPreview = false">Close</LiButton>
        <LiButton variant="secondary" @click="copyPreview">Copy</LiButton>
        <LiButton @click="downloadPreview">Download .sql</LiButton>
      </template>
    </LiModal>

    <!-- Advancing the cutoff is not undoable from this screen, and it hides
         changes from the next person who opens it. -->
    <LiModal v-model="confirmMark" title="Mark as exported" size="sm">
      <p class="ddexp__confirm">
        This moves the cutoff to now, so these {{ pendingCount }} change(s) stop
        appearing here. It does not send anything anywhere — do it once the
        script has actually been applied downstream.
      </p>
      <template #footer>
        <LiButton variant="ghost" @click="confirmMark = false">Cancel</LiButton>
        <LiButton @click="doMarkExported">Mark as exported</LiButton>
      </template>
    </LiModal>
  </section>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import LiTable from '@lib/components/LiTable.vue'
import LiTextField from '@lib/components/LiTextField.vue'
import LiCheckbox from '@lib/components/LiCheckbox.vue'
import LiButton from '@lib/components/LiButton.vue'
import LiBadge from '@lib/components/LiBadge.vue'
import LiModal from '@lib/components/LiModal.vue'
import LiEmptyState from '@lib/components/LiEmptyState.vue'
import { useToast } from '@lib/composables/useToast.js'
import { exportMultiSheetXlsx } from '@lib/export-xlsx.js'
import { DD_TABLES, tableLabel } from '../lib/schema.js'
import { column, isTextColumn } from '../lib/columns.js'
import { formatRelative } from '../lib/format.js'
import { exportColumnPairs, exportStamp, toSqlDate, toSqlTimestamp } from '../lib/sql-export.js'
import { useDdExport } from '../composables/useDdExport.js'
import { useDdTableCounts } from '../composables/useDdTableCounts.js'

// The preview renders one DOM node per line, so a full dump of a large table is
// capped. The downloaded file is always complete; the footer says how much is
// not on screen.
const PREVIEW_MAX_LINES = 800

const toast = useToast()
const { counts, load: loadCounts } = useDdTableCounts()
const {
  cutoff, lastExportedAt,
  pendingChanges, pendingCount, loading, error, warnings, truncated,
  readableTables,
  load, markExported, fetchAll,
  buildDeltaScript, buildFullScript, downloadScript,
} = useDdExport()

const deltaColumns = [
  { key: 'tableId', label: 'Table' },
  { key: 'action', label: 'Action' },
  { key: 'key', label: 'Record' },
  { key: 'at', label: 'Changed' },
]

const picked = ref([])
const building = ref('')
const confirmMark = ref(false)

const showPreview = ref(false)
const previewMode = ref('delta')
const previewSql = ref('')

const previewLines = computed(() => previewSql.value.split('\n'))
const totalLines = computed(() => previewLines.value.length)
const shownLines = computed(() => previewLines.value.slice(0, PREVIEW_MAX_LINES))
const hiddenLines = computed(() => Math.max(0, totalLines.value - PREVIEW_MAX_LINES))

const pickedRowCount = computed(() =>
  picked.value.reduce((sum, id) => sum + (counts.value[id] ?? 0), 0))

const target = id => `${DD_TABLES[id].targetDb}.${DD_TABLES[id].targetTable}`

function actionVariant(action) {
  if (action === 'INSERT') return 'success'
  if (action === 'UPDATE') return 'warning'
  if (action === 'DELETE') return 'error'
  return 'neutral'
}

function togglePicked(id, checked) {
  picked.value = checked ? [...picked.value, id] : picked.value.filter(p => p !== id)
}

// ── Preview ────────────────────────────────────────────────────────────────
// Nothing is downloaded that has not been offered for reading first, so both
// download buttons open the same preview the Preview button does.

function openPreview(mode, sql) {
  previewMode.value = mode
  previewSql.value = sql
  showPreview.value = true
}

function previewDelta() {
  openPreview('delta', buildDeltaScript())
}

async function previewFull() {
  const sql = await withBuilding('preview', () => buildFullScript(picked.value))
  if (sql != null) openPreview('full', sql)
}

async function copyPreview() {
  try {
    await navigator.clipboard.writeText(previewSql.value)
    toast.success('SQL copied')
  } catch {
    toast.error('The browser blocked clipboard access')
  }
}

function downloadPreview() {
  downloadScript(previewSql.value, previewMode.value)
  toast.success('Downloaded .sql')
}

// ── Downloads ──────────────────────────────────────────────────────────────

function downloadDelta() {
  const sql = buildDeltaScript()
  openPreview('delta', sql)
  downloadScript(sql, 'delta')
  toast.success('Downloaded .sql')
}

async function downloadFull() {
  const sql = await withBuilding('sql', () => buildFullScript(picked.value))
  if (sql == null) return
  openPreview('full', sql)
  downloadScript(sql, 'full')
  toast.success('Downloaded .sql')
}

/**
 * One sheet per selected table, headed with the downstream column names so the
 * workbook and the SQL name the same things. Timestamps are rendered exactly as
 * the SQL renders them rather than by locale, so the two can be diffed.
 */
function xlsxColumns(tableId) {
  return exportColumnPairs(tableId).map((p) => {
    const type = column(tableId, p.local)?.type
    return {
      key: p.local,
      label: p.target,
      textFormula: isTextColumn(tableId, p.local),
      format: (v) => {
        if (v == null) return ''
        if (type === 'timestamp') return toSqlTimestamp(v)
        if (type === 'date') return toSqlDate(v)
        return v
      },
    }
  })
}

async function downloadXlsx() {
  await withBuilding('xlsx', async () => {
    const sheets = []
    for (const id of readableTables.value.filter(t => picked.value.includes(t))) {
      sheets.push({
        // Excel caps a sheet name at 31 characters, which the qualified
        // db.table name would exceed for merchant_whitelist.
        name: DD_TABLES[id].targetTable.slice(0, 31),
        rows: await fetchAll(id),
        columns: xlsxColumns(id),
      })
    }
    exportMultiSheetXlsx(sheets, `dd-export-full-${exportStamp()}`)
    toast.success(`Downloaded ${sheets.length} sheet(s)`)
    return true
  })
}

/** Runs a build with a spinner on the right button, reporting failures once. */
async function withBuilding(kind, fn) {
  building.value = kind
  try {
    return await fn()
  } catch (e) {
    toast.error(e.message)
    return null
  } finally {
    building.value = ''
  }
}

async function doMarkExported() {
  confirmMark.value = false
  await markExported()
  toast.success('Cutoff moved to now')
}

onMounted(() => {
  load()
  if (readableTables.value.length) {
    picked.value = [...readableTables.value]
    loadCounts(readableTables.value)
  }
})
</script>

<style scoped>
.ddexp { display: flex; flex-direction: column; gap: var(--space-md, 16px); }
.ddexp__head { display: flex; align-items: flex-end; justify-content: space-between; gap: 12px; }
.ddexp__title { font-size: 24px; font-weight: 800; margin: 0; letter-spacing: -0.4px; }
.ddexp__sub { font-size: 14px; color: var(--color-gray-500, #8e8ea0); margin: 2px 0 0; }
.ddexp__count { font-size: 13px; color: var(--color-gray-500, #8e8ea0); margin: 0; white-space: nowrap; }

.ddexp__panels {
  display: grid; grid-template-columns: 3fr 2fr;
  gap: var(--space-md, 16px); align-items: start;
}
@media (max-width: 1100px) {
  .ddexp__panels { grid-template-columns: 1fr; }
}

.ddexp__panel {
  display: flex; flex-direction: column; gap: var(--space-sm, 12px);
  background: rgba(255, 255, 255, 0.6);
  border: 1px solid rgba(0, 0, 0, 0.06);
  border-radius: var(--radius-md, 16px);
  padding: 18px 20px;
}
.ddexp__panel-head { display: flex; flex-direction: column; gap: 2px; }
.ddexp__panel-title { font-size: 16px; font-weight: 700; margin: 0; }
.ddexp__panel-lead { font-size: 13px; line-height: 1.55; color: var(--color-gray-500, #8e8ea0); margin: 0; }
.ddexp__panel-foot { display: flex; flex-wrap: wrap; gap: 8px; justify-content: flex-end; }

.ddexp__cutoff { display: grid; grid-template-columns: 1fr auto; gap: var(--space-sm, 12px); align-items: end; }
.ddexp__hint { font-size: 12px; color: var(--color-gray-400, #aaa); margin: 0; }

.ddexp__error {
  font-size: 13px; color: var(--color-red-400, #C83E3B);
  background: rgba(200, 62, 59, 0.08);
  border-radius: var(--radius-sm, 12px); padding: 10px 14px; margin: 0;
}
.ddexp__warn {
  font-size: 13px; color: var(--color-gray-700, #666);
  background: rgba(255, 188, 37, 0.14);
  border-radius: var(--radius-sm, 12px); padding: 10px 14px; margin: 0;
}
.ddexp__warn-list {
  font-size: 12px; color: var(--color-gray-700, #666); margin: 0;
  padding: 10px 14px 10px 30px; list-style: disc;
  background: rgba(255, 188, 37, 0.14); border-radius: var(--radius-sm, 12px);
}

.ddexp__key {
  font-family: var(--font-mono, ui-monospace, monospace); font-size: 12px;
  background: rgba(0, 0, 0, 0.04); border-radius: 5px; padding: 1px 6px;
}
/* A rename means the WHERE clause targets a key that is no longer on screen. */
.ddexp__renamed { font-size: 11px; color: var(--color-gray-400, #aaa); margin-left: 6px; }

.ddexp__tables { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
.ddexp__table {
  display: grid; grid-template-columns: 1fr auto; align-items: center;
  gap: 2px 12px; padding: 8px 0;
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
}
.ddexp__target {
  grid-column: 1; font-family: var(--font-mono, ui-monospace, monospace);
  font-size: 11px; color: var(--color-gray-400, #aaa);
}
.ddexp__rows {
  grid-column: 2; grid-row: 1 / span 2;
  font-size: 12px; color: var(--color-gray-500, #8e8ea0);
  font-variant-numeric: tabular-nums; white-space: nowrap;
}

.ddexp__modal-title { margin: 0; font-size: 17px; font-weight: 700; letter-spacing: -0.2px; }
.ddexp__modal-sub { margin: 2px 0 0; font-size: 12px; color: var(--color-gray-400, #aaa); }
.ddexp__confirm { font-size: 13px; line-height: 1.6; margin: 0; color: var(--color-gray-700, #666); }

.ddexp__code {
  background: var(--color-bg-dark, #212324);
  border-radius: var(--radius-sm, 12px);
  padding: 14px 0; max-height: 55vh; overflow: auto;
}
.ddexp__line { display: flex; align-items: flex-start; gap: 12px; padding: 0 16px; }
/* Not selectable: the Copy button hands over the script, and dragging across
   the gutter must not smuggle line numbers into a production paste. */
.ddexp__ln {
  user-select: none; flex: 0 0 44px; text-align: right;
  font-family: var(--font-mono, ui-monospace, monospace);
  font-size: 11px; line-height: 1.75; color: #5d666f;
}
.ddexp__src {
  flex: 1; font-family: var(--font-mono, ui-monospace, monospace);
  font-size: 12px; line-height: 1.75; color: #E4E7EC;
  white-space: pre-wrap; word-break: break-word;
}
.ddexp__src.is-comment { color: #7C8794; font-style: italic; }
</style>
