<template>
  <section class="ddsql">
    <header class="ddsql__head">
      <div>
        <h1 class="ddsql__title">SQL Editor</h1>
        <p class="ddsql__sub">Query the tables you are granted, in MySQL syntax, in your browser.</p>
      </div>
      <div class="ddsql__actions">
        <p class="ddsql__count">{{ connectionLabel }}</p>
        <button class="ddsql__reload" type="button" :disabled="mounting" @click="mountAll">
          <LiIcon name="restart_alt" />
          Reload
        </button>
      </div>
    </header>

    <LiEmptyState
      v-if="!canRead"
      icon="lock"
      title="You do not have access to the SQL editor"
      description="Ask an admin for the sql.read permission on the DD module."
    />

    <div v-else class="ddsql__grid">
      <aside class="ddsql__side">
        <!--
          The connection panel is not decoration. A query is refused when it
          names a table that was never mounted, and this list is the only place
          that says which tables those are.
        -->
        <section class="ddsql__panel">
          <p class="ddsql__panel-title">Connection</p>
          <p v-if="mountError" class="ddsql__error">{{ mountError }}</p>
          <p v-if="!mountedList.length && !mounting" class="ddsql__hint">
            No table is mounted, so every query will be refused.
          </p>

          <div v-for="t in mountedList" :key="t.name" class="ddsql__table">
            <button class="ddsql__table-head" type="button" @click="toggle(t.name)">
              <LiIcon name="chevron_right" class="ddsql__chev" :class="{ 'is-open': opened.has(t.name) }" />
              <span class="ddsql__table-name" :title="`${t.db}.${t.name}`">{{ t.name }}</span>
              <span class="ddsql__table-rows">{{ t.rows.length }}</span>
            </button>
            <div v-if="opened.has(t.name)" class="ddsql__cols">
              <button class="ddsql__col ddsql__col--all" type="button" @click="insert(`SELECT * FROM ${t.name} LIMIT 100`)">
                SELECT * FROM {{ t.name }}
              </button>
              <button
                v-for="c in t.columns"
                :key="c"
                class="ddsql__col"
                type="button"
                :title="`Insert ${c}`"
                @click="insert(c)"
              >{{ c }}</button>
            </div>
          </div>

          <p v-if="deniedTables.length" class="ddsql__denied">
            <LiIcon name="lock" />
            {{ deniedTables.join(', ') }} {{ deniedTables.length > 1 ? 'are' : 'is' }} not in your access,
            so {{ deniedTables.length > 1 ? 'they are' : 'it is' }} not mounted and cannot be queried here.
          </p>
        </section>

        <section class="ddsql__panel">
          <p class="ddsql__panel-title">Saved snippets</p>
          <div class="ddsql__save">
            <LiTextField v-model="snippetName" placeholder="Name this query…" />
            <button class="ddsql__save-btn" type="button" :disabled="!snippetName.trim() || !sql.trim()" @click="saveSnippet">
              Save
            </button>
          </div>
          <p v-if="!snippets.length" class="ddsql__hint">Nothing saved yet.</p>
          <div v-for="s in snippets" :key="s.id" class="ddsql__item">
            <button class="ddsql__item-main" type="button" :title="s.sql" @click="sql = s.sql">{{ s.name }}</button>
            <button class="ddsql__item-del" type="button" :aria-label="`Delete snippet ${s.name}`" title="Delete snippet" @click="deleteSnippet(s.id)">
              <LiIcon name="close" />
            </button>
          </div>
        </section>

        <section class="ddsql__panel">
          <p class="ddsql__panel-title">
            History
            <button v-if="history.length" class="ddsql__panel-clear" type="button" @click="clearHistory">Clear</button>
          </p>
          <p v-if="!history.length" class="ddsql__hint">The last {{ HISTORY_LIMIT }} runs land here.</p>
          <div v-for="h in history" :key="h.id" class="ddsql__item">
            <button class="ddsql__item-main" type="button" :title="h.sql" @click="sql = h.sql">
              <span class="ddsql__dot" :class="h.ok ? 'is-ok' : 'is-bad'"></span>
              <span class="ddsql__item-sql">{{ h.sql.replace(/\s+/g, ' ') }}</span>
              <span class="ddsql__item-ms">{{ h.ms }} ms</span>
            </button>
            <button class="ddsql__item-del" type="button" aria-label="Remove query from history" title="Remove from history" @click="deleteHistory(h.id)">
              <LiIcon name="close" />
            </button>
          </div>
        </section>
      </aside>

      <div class="ddsql__main">
        <div class="ddsql__bar">
          <LiButton size="sm" :loading="running" @click="run">Run</LiButton>
          <LiButton variant="secondary" size="sm" @click="format">Format</LiButton>
          <LiButton variant="ghost" size="sm" :disabled="!result?.rows?.length" @click="exportCsv">Export CSV</LiButton>
          <span class="ddsql__bar-hint">
            Ctrl/Cmd+Enter runs · Tab indents · select text to run only that
            <template v-if="!canWrite"> · read-only</template>
          </span>
        </div>

        <textarea
          ref="editorEl"
          v-model="sql"
          class="ddsql__editor"
          spellcheck="false"
          rows="8"
          placeholder="SELECT * FROM merchant_whitelist LIMIT 100"
          @keydown.tab="onTab"
          @keydown.enter="onEnter"
        ></textarea>

        <!--
          Inline, not a toast: a parse error has a character position and needs
          to sit next to the text it is pointing at.
        -->
        <div v-if="problem" class="ddsql__problem">
          <p class="ddsql__problem-msg">{{ problem.message }}</p>
          <pre v-if="problem.caret" class="ddsql__caret">{{ problem.caret }}</pre>
          <p v-if="problem.position != null" class="ddsql__problem-at">at character {{ problem.position + 1 }}</p>
        </div>

        <div v-if="result" class="ddsql__result-head">
          <LiBadge :label="result.action" :variant="actionVariant(result.action)" size="sm" is-pill />
          <span class="ddsql__result-note">{{ resultSummary }}</span>
          <span class="ddsql__result-ms">{{ result.ms }} ms</span>
        </div>

        <p v-if="truncated" class="ddsql__hint">
          Showing the first {{ MAX_DISPLAY_ROWS }} of {{ result.rows.length }} rows. Export CSV for the rest.
        </p>

        <!-- No row-key: a result set has no identity column in the general case,
             and LiTable only uses row-key for its (unused here) selection. -->
        <LiTable v-if="result" :data="displayRows" :columns="resultColumns">
          <template v-for="c in resultColumns" #[c.slot]="{ value }">
            <i v-if="value === null || value === undefined" class="ddsql__null">NULL</i>
            <span v-else class="ddsql__value">{{ value }}</span>
          </template>
        </LiTable>

        <LiEmptyState
          v-else
          icon="terminal"
          title="No query run yet"
          description="Write a statement above and press Run, or hit Ctrl/Cmd+Enter."
          size="sm"
        />
      </div>
    </div>

    <!--
      A write is never applied straight from the Run button. What is shown here
      is the outcome the engine computed against the in-memory copy, so the
      count and the rows below are exactly what will be sent.
    -->
    <LiModal v-model="confirmOpen" title="Confirm this write" size="lg">
      <div v-if="pending" class="ddsql__confirm">
        <pre class="ddsql__stmt">{{ pending.statement }}</pre>
        <dl class="ddsql__facts">
          <div><dt>Table</dt><dd>{{ pending.result.table }} <span class="ddsql__muted">({{ pending.meta.targetDb }})</span></dd></div>
          <div><dt>Statement</dt><dd>{{ pending.result.action }}</dd></div>
          <div>
            <dt>Rows affected</dt>
            <dd>
              {{ pending.result.affected }}
              <span v-if="pending.result.action === 'UPDATE' && pending.result.matched !== pending.result.affected" class="ddsql__muted">
                ({{ pending.result.matched }} matched, {{ pending.result.matched - pending.result.affected }} already had these values)
              </span>
            </dd>
          </div>
        </dl>

        <p v-if="!pending.result.affected" class="ddsql__hint">
          Nothing would change. Applying this is safe but pointless.
        </p>
        <template v-else>
          <p class="ddsql__hint">
            {{ pending.result.action === 'DELETE' ? 'These rows will be deleted' : 'These rows will be written' }}<template v-if="pending.result.rows.length > PREVIEW_ROWS"> (first {{ PREVIEW_ROWS }} shown)</template>:
          </p>
          <LiTable :data="previewRows" :columns="previewColumns">
            <template v-for="c in previewColumns" #[c.slot]="{ value }">
              <i v-if="value === null || value === undefined" class="ddsql__null">NULL</i>
              <span v-else>{{ value }}</span>
            </template>
          </LiTable>
        </template>
      </div>

      <template #footer>
        <LiButton variant="ghost" @click="confirmOpen = false">Cancel</LiButton>
        <LiButton
          variant="danger"
          :loading="applying"
          :disabled="!pending?.result?.affected"
          @click="applyPending"
        >
          Apply to database
        </LiButton>
      </template>
    </LiModal>
  </section>
</template>

<script setup>
import { ref, computed, onMounted, nextTick } from 'vue'
import LiTable from '@lib/components/LiTable.vue'
import LiModal from '@lib/components/LiModal.vue'
import LiButton from '@lib/components/LiButton.vue'
import LiBadge from '@lib/components/LiBadge.vue'
import LiTextField from '@lib/components/LiTextField.vue'
import LiEmptyState from '@lib/components/LiEmptyState.vue'
import { supabase } from '@/lib/supabase.js'
import { useAuth } from '@/composables/useAuth.js'
import { useToast } from '@lib/composables/useToast.js'
import { DD_TABLES, TABLE_IDS } from '../lib/schema.js'
import { columns as columnsOf, primaryKey, coerce } from '../lib/columns.js'
import { downloadCsv } from '../lib/csv.js'
import { useDdAccess } from '../composables/useDdAccess.js'
import { parse, execute, formatSql, splitStatements, isWrite } from '../lib/sql-engine.js'

const MAX_DISPLAY_ROWS = 500
const PREVIEW_ROWS = 20
const HISTORY_LIMIT = 20

// A confirmed write is applied one PostgREST request per row (see applyPending
// for why), so an accidental five-thousand-row UPDATE would be five thousand
// requests. Refuse instead, and say what to do about it.
const MAX_WRITE_ROWS = 500

const SNIPPET_KEY = 'dd.sql.snippets'
const HISTORY_KEY = 'dd.sql.history'

// SQL verb -> the feature action the two-axis model grants per table.
const ACTION_FEATURE = { INSERT: 'create', UPDATE: 'update', DELETE: 'delete' }

const { canMenu, canTable } = useDdAccess()
const { session, profile } = useAuth()
const toast = useToast()

const canRead = computed(() => canMenu('sql', 'read'))
const canWrite = computed(() => canMenu('sql', 'write'))

const sql = ref('SELECT bu_name, COUNT(*) AS merchants\nFROM merchant_whitelist\nGROUP BY bu_name\nORDER BY merchants DESC;')
const editorEl = ref(null)

const mounted = ref({})
const mounting = ref(false)
const mountError = ref('')
const opened = ref(new Set())

const running = ref(false)
const result = ref(null)
const problem = ref(null)

const confirmOpen = ref(false)
const applying = ref(false)
const pending = ref(null)

const snippets = ref(readStore(SNIPPET_KEY))
const snippetName = ref('')
const history = ref(readStore(HISTORY_KEY))

// The audit trigger derives its own actor server-side from auth.uid(); these
// columns are the tables' own convention, kept for continuity with the forms.
const actor = computed(() => profile.value?.full_name || session.value?.user?.email || 'SYSTEM')

// ── Mounting ────────────────────────────────────────────────────────────────

const mountedList = computed(() => Object.values(mounted.value))

const deniedTables = computed(() =>
  TABLE_IDS.filter(id => !canTable(id, 'read')).map(id => DD_TABLES[id].targetTable),
)

const connectionLabel = computed(() => {
  if (mounting.value) return 'mounting tables…'
  const tables = mountedList.value.length
  if (!tables) return 'nothing mounted'
  const rows = mountedList.value.reduce((a, t) => a + t.rows.length, 0)
  return `${tables} ${tables === 1 ? 'table' : 'tables'} · ${rows} rows`
})

/**
 * Fetches every table this person may read and mounts it under its
 * *downstream* name (discount_bu_accounts, merchant_whitelist, promo_rule),
 * because that is what someone writing SQL against this data would type. The
 * columns stay the local Supabase ones — this is SP-lite's data, not a mirror
 * of the MySQL schema, so `id` exists and `created_at` is not `last_modified`.
 *
 * A table the person cannot read is never fetched and never mounted, which is
 * what makes the engine's "Not available in this connection" refusal real
 * rather than cosmetic.
 */
async function mountAll() {
  mounting.value = true
  mountError.value = ''
  const next = {}
  for (const id of TABLE_IDS) {
    if (!canTable(id, 'read')) continue
    const meta = DD_TABLES[id]
    const { data, error } = await supabase.from(meta.local).select('*')
    // One unreadable table does not sink the connection: the rest stays usable
    // for someone with partial access.
    if (error) { mountError.value = `${meta.targetTable}: ${error.message}`; continue }
    next[meta.targetTable] = {
      name: meta.targetTable,
      db: meta.targetDb,
      tableId: id,
      columns: columnsOf(id).map(c => c.name),
      rows: data || [],
    }
  }
  mounted.value = next
  mounting.value = false
}

async function remount(tableId) {
  const meta = DD_TABLES[tableId]
  const { data, error } = await supabase.from(meta.local).select('*')
  if (error) { mountError.value = `${meta.targetTable}: ${error.message}`; return }
  mounted.value = { ...mounted.value, [meta.targetTable]: { ...mounted.value[meta.targetTable], rows: data || [] } }
}

function toggle(name) {
  const next = new Set(opened.value)
  next.has(name) ? next.delete(name) : next.add(name)
  opened.value = next
}

// ── Editor ──────────────────────────────────────────────────────────────────

function onTab(e) {
  // Shift+Tab still moves focus out — trapping Tab entirely would leave a
  // keyboard user stuck in the textarea.
  if (e.shiftKey) return
  e.preventDefault()
  const el = e.target
  const start = el.selectionStart
  const end = el.selectionEnd
  sql.value = sql.value.slice(0, start) + '  ' + sql.value.slice(end)
  nextTick(() => { el.selectionStart = el.selectionEnd = start + 2 })
}

function onEnter(e) {
  if (!e.ctrlKey && !e.metaKey) return
  e.preventDefault()
  run()
}

function insert(text) {
  const el = editorEl.value
  if (!el) { sql.value += text; return }
  const start = el.selectionStart
  const end = el.selectionEnd
  sql.value = sql.value.slice(0, start) + text + sql.value.slice(end)
  nextTick(() => {
    el.focus()
    el.selectionStart = el.selectionEnd = start + text.length
  })
}

function format() {
  const t = sql.value.trim()
  if (t) sql.value = formatSql(t)
}

/** The selection if there is one, otherwise the whole buffer. */
function activeText() {
  const el = editorEl.value
  if (el && el.selectionStart !== el.selectionEnd) {
    return sql.value.slice(el.selectionStart, el.selectionEnd)
  }
  return sql.value
}

// ── Running ─────────────────────────────────────────────────────────────────

function fail(message, position = null, statement = '') {
  // A caret line under the offending character, rendered in the same monospace
  // block, so the position is visible rather than arithmetic.
  let caret = ''
  if (position != null && statement) {
    const before = statement.slice(0, position)
    const line = statement.slice(before.lastIndexOf('\n') + 1).split('\n')[0]
    const col = position - (before.lastIndexOf('\n') + 1)
    caret = `${line}\n${' '.repeat(Math.max(0, col))}^`
  }
  problem.value = { message, position, caret }
  result.value = null
}

async function run() {
  problem.value = null
  const text = activeText().trim()
  if (!text) return

  const parts = splitStatements(text)
  if (parts.length > 1) {
    // Deliberately one at a time. A write needs a confirmation of its own, and
    // a batch that stops half way through is worse than a batch that never ran.
    fail('Run one statement at a time — select the one you want and press Ctrl/Cmd+Enter.')
    return
  }
  const statement = parts[0]

  let ast
  try {
    ast = parse(statement)
  } catch (e) {
    fail(e.message, e.position, statement)
    record(statement, false, 0)
    return
  }

  const target = ast.from ? mounted.value[Object.keys(mounted.value).find(
    n => n.toLowerCase() === String(ast.from.name).toLowerCase(),
  )] : null

  // Permission is checked only once the table is known to be mounted. An
  // ungranted name must fall through to the engine so it gets DD's
  // "Not available in this connection" rather than a lecture about permissions
  // on a table this person was never told exists.
  if (isWrite(ast.action) && target) {
    if (!canWrite.value) {
      fail(`${ast.action} needs the "sql.write" permission on the DD module, which you do not have.`)
      record(statement, false, 0)
      return
    }
    const need = ACTION_FEATURE[ast.action]
    // Holding sql.write must not grant write on a table this person could not
    // otherwise write — both gates have to pass.
    if (!canTable(target.tableId, need)) {
      const meta = DD_TABLES[target.tableId]
      fail(
        `You cannot ${need} rows in ${target.name}. That needs "${meta.menu}.${need}" `
        + `or "db.${meta.targetDb}.${need}" on the DD module.`,
      )
      record(statement, false, 0)
      return
    }
  }

  running.value = true
  const t0 = performance.now()
  let res
  try {
    res = execute(ast, mounted.value)
  } catch (e) {
    running.value = false
    fail(e.message, e.position, statement)
    record(statement, false, Math.round(performance.now() - t0))
    return
  }
  const ms = Math.round(performance.now() - t0)
  running.value = false

  if (!isWrite(res.action)) {
    result.value = { ...res, ms }
    record(statement, true, ms)
    return
  }

  // Nothing is committed yet — res is what the engine computed against the
  // in-memory copy. The modal decides whether it reaches Postgres.
  pending.value = { statement, result: res, ms, meta: DD_TABLES[target.tableId], tableId: target.tableId }
  confirmOpen.value = true
}

// ── Applying a write ────────────────────────────────────────────────────────

/**
 * Applies the confirmed change set row by row, keyed on the table's local
 * primary key.
 *
 * DD rewrote the whole sheet on every write because Apps Script had no other
 * way to address a row. Do not "fix" this back into a bulk replace: a targeted
 * per-row UPDATE is what lets dd_audit_row() record a proper per-column diff.
 * A table-wide rewrite would land in the audit log as one opaque REPLACE and
 * the history of who changed which value would be gone.
 */
/**
 * Values leave the engine typed by the SQL text, not by the column. coerce() is
 * the same normalisation the guided forms use, so `SET max_txn_amount = ''`
 * becomes a real NULL instead of a 22P02 from Postgres. An explicit SQL NULL is
 * passed through untouched: a NOT NULL violation should be reported as one, not
 * quietly rewritten to ''.
 */
const normalise = (tableId, row) => Object.fromEntries(
  Object.entries(row).map(([k, v]) => [k, v === null ? null : coerce(tableId, k, v)]),
)

async function applyPending() {
  const p = pending.value
  if (!p) return
  const { result: res, tableId, meta } = p
  const pk = primaryKey(tableId)

  if (res.affected > MAX_WRITE_ROWS) {
    toast.error(`${res.affected} rows is beyond what this editor will write at once (${MAX_WRITE_ROWS}). Narrow the WHERE clause.`)
    return
  }

  applying.value = true
  const now = new Date().toISOString()
  const failures = []
  let done = 0

  try {
    if (res.action === 'INSERT') {
      // One request for the batch: an INSERT addresses no existing row, so
      // there is nothing per-row to key on and the audit trigger fires per row
      // regardless.
      const rows = res.changes.map(c => ({
        created_by: actor.value,
        ...normalise(tableId, c.after),
        updated_by: actor.value,
        updated_at: now,
      }))
      const { error } = await supabase.from(meta.local).insert(rows)
      if (error) failures.push(error.message)
      else done = rows.length
    } else if (res.action === 'UPDATE') {
      for (const change of res.changes) {
        const { error } = await supabase
          .from(meta.local)
          .update({ ...normalise(tableId, change.set), updated_by: actor.value, updated_at: now })
          .eq(pk, change.before[pk])
        if (error) failures.push(`${change.before[pk]}: ${error.message}`)
        else done++
      }
    } else {
      for (const change of res.changes) {
        const { error } = await supabase.from(meta.local).delete().eq(pk, change.before[pk])
        if (error) failures.push(`${change.before[pk]}: ${error.message}`)
        else done++
      }
    }
  } finally {
    applying.value = false
  }

  // Re-read whatever actually landed, so the editor and the database cannot
  // disagree — including after a partial failure.
  await remount(tableId)

  confirmOpen.value = false
  record(p.statement, !failures.length, p.ms)

  if (failures.length) {
    toast.error(`${failures.length} of ${res.affected} row(s) were rejected`)
    fail(`Rejected by the database:\n${failures.slice(0, 5).join('\n')}`)
  } else {
    result.value = { ...res, affected: done, ms: p.ms }
    toast.success(`${done} row(s) ${res.action === 'DELETE' ? 'deleted' : 'written'} to ${meta.label}`)
  }
  pending.value = null
}

// ── Results ─────────────────────────────────────────────────────────────────

// `slot` is precomputed so the template can write #[c.slot] rather than build a
// template literal inside an attribute.
const resultColumns = computed(() =>
  (result.value?.columns ?? []).map(c => ({ key: c, label: c, slot: `cell-${c}` })),
)

const displayRows = computed(() => (result.value?.rows ?? []).slice(0, MAX_DISPLAY_ROWS))
const truncated = computed(() => (result.value?.rows?.length ?? 0) > MAX_DISPLAY_ROWS)

const resultSummary = computed(() => {
  const r = result.value
  if (!r) return ''
  if (r.action === 'SELECT' || r.action === 'SHOW' || r.action === 'DESCRIBE') {
    return `${r.rows.length} ${r.rows.length === 1 ? 'row' : 'rows'} · ${r.columns.length} columns`
  }
  return `${r.affected} ${r.affected === 1 ? 'row' : 'rows'} affected in ${r.table}`
})

const previewColumns = computed(() => {
  const p = pending.value
  if (!p) return []
  let keys
  if (p.result.action === 'UPDATE') {
    // Only the key and what actually changes — an UPDATE preview showing forty
    // untouched columns hides the three that matter.
    const changed = new Set()
    p.result.changes.forEach(c => Object.keys(c.set).forEach(k => changed.add(k)))
    keys = [primaryKey(p.tableId), ...[...changed].filter(k => k !== primaryKey(p.tableId))]
  } else {
    keys = p.result.columns.slice(0, 8)
  }
  return keys.map(k => ({ key: k, label: k, slot: `cell-${k}` }))
})

const previewRows = computed(() => (pending.value?.result.rows ?? []).slice(0, PREVIEW_ROWS))

function actionVariant(action) {
  if (action === 'INSERT') return 'success'
  if (action === 'UPDATE') return 'warning'
  if (action === 'DELETE') return 'error'
  return 'neutral'
}

function exportCsv() {
  const r = result.value
  if (!r?.rows?.length) return
  downloadCsv(r.rows, r.columns.map(c => ({ key: c, label: c })), 'dd-query-result')
}

// ── Snippets and history ────────────────────────────────────────────────────

function readStore(key) {
  try {
    const raw = localStorage.getItem(key)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    // Private-mode Safari throws on localStorage; the editor still works.
    return []
  }
}

function writeStore(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* nothing to do */ }
}

function saveSnippet() {
  const name = snippetName.value.trim()
  if (!name || !sql.value.trim()) return
  snippets.value = [{ id: `${Date.now()}`, name, sql: sql.value.trim() }, ...snippets.value]
  writeStore(SNIPPET_KEY, snippets.value)
  snippetName.value = ''
}

function deleteSnippet(id) {
  snippets.value = snippets.value.filter(s => s.id !== id)
  writeStore(SNIPPET_KEY, snippets.value)
}

function record(statement, ok, ms) {
  history.value = [{ id: `${Date.now()}-${Math.random()}`, sql: statement, ok, ms }, ...history.value]
    .slice(0, HISTORY_LIMIT)
  writeStore(HISTORY_KEY, history.value)
}

function deleteHistory(id) {
  history.value = history.value.filter(h => h.id !== id)
  writeStore(HISTORY_KEY, history.value)
}

function clearHistory() {
  history.value = []
  writeStore(HISTORY_KEY, history.value)
}

onMounted(() => { if (canRead.value) mountAll() })
</script>

<style scoped>
.ddsql { display: flex; flex-direction: column; gap: var(--space-md, 16px); }
.ddsql__head { display: flex; align-items: flex-end; justify-content: space-between; gap: 12px; }
.ddsql__title { font-size: 24px; font-weight: 800; margin: 0; letter-spacing: -0.4px; }
.ddsql__sub { font-size: 14px; color: var(--color-gray-500, #8e8ea0); margin: 2px 0 0; }
.ddsql__actions { display: flex; align-items: center; gap: 12px; }
.ddsql__count { font-size: 13px; color: var(--color-gray-500, #8e8ea0); margin: 0; white-space: nowrap; }

.ddsql__reload {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 8px 16px; border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: var(--radius-pill, 999px); background: transparent;
  font-family: var(--font-body, 'Inter', sans-serif);
  font-size: 13px; font-weight: 600; color: var(--color-gray-700, #666);
  cursor: pointer; transition: all 200ms; white-space: nowrap;
}
.ddsql__reload:hover:not(:disabled) { background: rgba(0, 0, 0, 0.04); }
.ddsql__reload:disabled { opacity: 0.45; cursor: not-allowed; }
.ddsql__reload .li-icon { font-size: 17px; }

.ddsql__grid { display: grid; grid-template-columns: 250px 1fr; gap: var(--space-md, 16px); align-items: start; }
@media (max-width: 1000px) {
  .ddsql__grid { grid-template-columns: 1fr; }
}

/* ── sidebar ── */
.ddsql__side { display: flex; flex-direction: column; gap: var(--space-sm, 12px); min-width: 0; }
.ddsql__panel {
  border: 1px solid rgba(0, 0, 0, 0.07);
  border-radius: var(--radius-sm, 12px);
  padding: 12px; min-width: 0;
}
.ddsql__panel-title {
  display: flex; align-items: center; justify-content: space-between;
  margin: 0 0 8px; font-size: 11px; font-weight: 700; letter-spacing: 0.08em;
  text-transform: uppercase; color: var(--color-gray-500, #8e8ea0);
}
.ddsql__panel-clear {
  border: none; background: transparent; padding: 0; cursor: pointer;
  font: inherit; font-size: 10px; letter-spacing: 0.04em;
  color: var(--color-gray-500, #8e8ea0); text-decoration: underline;
}
.ddsql__hint { margin: 0; font-size: 12px; line-height: 1.5; color: var(--color-gray-400, #aaa); }

.ddsql__table-head {
  width: 100%; display: flex; align-items: center; gap: 4px;
  padding: 5px 6px; border: none; background: transparent;
  border-radius: var(--radius-xs, 8px); cursor: pointer; text-align: left;
  font-family: var(--font-mono, ui-monospace, monospace); font-size: 12px;
  color: var(--color-gray-700, #666); transition: background 200ms;
}
.ddsql__table-head:hover { background: rgba(0, 0, 0, 0.04); }
.ddsql__table-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ddsql__table-rows { font-size: 11px; color: var(--color-gray-400, #aaa); }
.ddsql__chev { font-size: 16px; transition: transform 200ms; color: var(--color-gray-400, #aaa); }
.ddsql__chev.is-open { transform: rotate(90deg); }

.ddsql__cols { padding: 2px 0 6px; }
.ddsql__col {
  display: block; width: 100%; padding: 3px 6px 3px 24px;
  border: none; background: transparent; border-radius: var(--radius-xs, 8px);
  font-family: var(--font-mono, ui-monospace, monospace); font-size: 11.5px;
  color: var(--color-gray-500, #8e8ea0); text-align: left; cursor: pointer;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  transition: all 200ms;
}
.ddsql__col:hover { background: rgba(0, 0, 0, 0.05); color: var(--color-gray-900, #1a1a1a); }
.ddsql__col--all { color: var(--color-gray-400, #aaa); font-style: italic; }

.ddsql__denied {
  display: flex; gap: 6px; margin: 10px 0 0; padding: 8px;
  border-radius: var(--radius-xs, 8px); background: rgba(0, 0, 0, 0.04);
  font-size: 11px; line-height: 1.5; color: var(--color-gray-500, #8e8ea0);
}
.ddsql__denied .li-icon { font-size: 15px; flex: none; }

.ddsql__save { display: flex; align-items: center; gap: 6px; margin-bottom: 8px; }
.ddsql__save > :first-child { flex: 1; min-width: 0; }
.ddsql__save-btn {
  flex: none; padding: 8px 12px; border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: var(--radius-pill, 999px); background: transparent;
  font-family: var(--font-body, 'Inter', sans-serif); font-size: 12px; font-weight: 600;
  color: var(--color-gray-700, #666); cursor: pointer; transition: all 200ms;
}
.ddsql__save-btn:hover:not(:disabled) { background: rgba(0, 0, 0, 0.04); }
.ddsql__save-btn:disabled { opacity: 0.4; cursor: not-allowed; }

.ddsql__item { display: flex; align-items: center; gap: 2px; }
.ddsql__item-main {
  flex: 1; min-width: 0; display: flex; align-items: center; gap: 6px;
  padding: 5px 6px; border: none; background: transparent;
  border-radius: var(--radius-xs, 8px); cursor: pointer; text-align: left;
  font-family: var(--font-body, 'Inter', sans-serif); font-size: 12px;
  color: var(--color-gray-700, #666); transition: background 200ms;
}
.ddsql__item-main:hover { background: rgba(0, 0, 0, 0.04); }
.ddsql__item-sql {
  flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  font-family: var(--font-mono, ui-monospace, monospace); font-size: 11px;
}
.ddsql__item-ms { flex: none; font-size: 10px; color: var(--color-gray-400, #aaa); }
.ddsql__item-del {
  flex: none; display: flex; padding: 3px; border: none; background: transparent;
  border-radius: 50%; cursor: pointer; color: var(--color-gray-400, #aaa);
  opacity: 0; transition: opacity 200ms, background 200ms;
}
.ddsql__item:hover .ddsql__item-del { opacity: 1; }
.ddsql__item-del:hover { background: rgba(0, 0, 0, 0.06); color: var(--color-red-400, #C83E3B); }
.ddsql__item-del .li-icon { font-size: 15px; }

.ddsql__dot { flex: none; width: 6px; height: 6px; border-radius: 50%; }
.ddsql__dot.is-ok { background: var(--color-green-500, #059669); }
.ddsql__dot.is-bad { background: var(--color-red-400, #C83E3B); }

/* ── editor ── */
.ddsql__main { display: flex; flex-direction: column; gap: var(--space-sm, 12px); min-width: 0; }
.ddsql__bar { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.ddsql__bar-hint {
  margin-left: auto; font-size: 11px; color: var(--color-gray-400, #aaa);
  font-family: var(--font-mono, ui-monospace, monospace);
}

.ddsql__editor {
  width: 100%; box-sizing: border-box; resize: vertical;
  padding: 14px; border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: var(--radius-sm, 12px); background: var(--color-gray-0, #fff);
  font-family: var(--font-mono, ui-monospace, 'JetBrains Mono', monospace);
  font-size: 13px; line-height: 1.7; color: var(--color-gray-900, #1a1a1a);
  /* Tab is bound to indentation, so the caret stays inside the query. */
  tab-size: 2; outline: none; transition: border-color 200ms;
}
.ddsql__editor:focus { border-color: var(--color-orange-400, #FF6B00); }

.ddsql__problem {
  background: rgba(200, 62, 59, 0.08); border-radius: var(--radius-sm, 12px);
  padding: 10px 14px; color: var(--color-red-400, #C83E3B);
}
.ddsql__problem-msg { margin: 0; font-size: 13px; line-height: 1.55; white-space: pre-wrap; }
.ddsql__problem-at { margin: 4px 0 0; font-size: 11px; opacity: 0.8; }
.ddsql__caret {
  margin: 6px 0 0; font-family: var(--font-mono, ui-monospace, monospace);
  font-size: 12px; line-height: 1.4; white-space: pre; overflow-x: auto;
}
.ddsql__error {
  font-size: 12px; color: var(--color-red-400, #C83E3B);
  background: rgba(200, 62, 59, 0.08); border-radius: var(--radius-xs, 8px);
  padding: 6px 10px; margin: 0 0 8px;
}

.ddsql__result-head { display: flex; align-items: center; gap: 10px; }
.ddsql__result-note { font-size: 13px; color: var(--color-gray-500, #8e8ea0); }
.ddsql__result-ms { margin-left: auto; font-size: 11px; color: var(--color-gray-400, #aaa); }

.ddsql__value { font-family: var(--font-mono, ui-monospace, monospace); font-size: 12px; }
/* A NULL must not look like an empty string — the difference matters here. */
.ddsql__null {
  font-style: normal; font-size: 11px; letter-spacing: 0.4px;
  color: var(--color-gray-400, #aaa);
}

/* ── confirm modal ── */
.ddsql__confirm { display: flex; flex-direction: column; gap: 14px; }
.ddsql__stmt {
  margin: 0; padding: 12px; border-radius: var(--radius-sm, 12px);
  background: rgba(0, 0, 0, 0.05);
  font-family: var(--font-mono, ui-monospace, monospace);
  font-size: 12.5px; line-height: 1.6; white-space: pre-wrap; word-break: break-word;
}
.ddsql__facts { display: flex; flex-wrap: wrap; gap: 20px; margin: 0; }
.ddsql__facts dt {
  font-size: 11px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase;
  color: var(--color-gray-500, #8e8ea0); margin-bottom: 2px;
}
.ddsql__facts dd { margin: 0; font-size: 14px; font-weight: 600; }
.ddsql__muted { color: var(--color-gray-400, #aaa); font-weight: 400; font-size: 12px; }
</style>
