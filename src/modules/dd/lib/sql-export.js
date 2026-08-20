// DD module — MySQL statement generator for the Export Center.
//
// Pure and side-effect free. Everything here takes plain data and returns a
// string: no network, no DOM, no localStorage. The output is pasted by a DBA
// into a production MySQL client, so the script carries its own header, fences
// each database in a comment block and abbreviates nothing. A mistake in this
// file corrupts a live table and there is no undo — precision beats features.
//
// ── Shapes ──────────────────────────────────────────────────────────────────
//
//   row      a Supabase row from one of the qrdd_* tables, keyed by *local*
//            column name (`created_at`, `updated_at`, `id`, …). Renaming to the
//            downstream column names happens here, not at the call site.
//
//   change   { tableId, action: 'INSERT' | 'UPDATE' | 'DELETE', row, where? }
//            `where` is an optional { keyColumn: value } map that overrides the
//            key values taken from `row` — see buildUpdate for why a rename
//            needs it.
//
//   script   one '\n'-joined string, ready to be written straight to a .sql
//            file or shown in the preview modal.
//
// ── Two things to settle with the DBA ───────────────────────────────────────
//
// 1. promo_rule vs promo_info. DD's own src/api/schema.js maps the `promo_rule`
//    sheet to a downstream table named `promo_info` (SHEET_TARGET_TABLE), while
//    SP-lite's lib/schema.js declares `targetTable: 'promo_rule'` for the same
//    data. The disagreement is deliberate and already settled: SP-lite is the
//    correct one, and `promo_rule` is what these statements should target. DD
//    is the app being replaced, not the authority. Do not "fix" this to
//    promo_info on the strength of the DD source alone.
//
// 2. Cache reset sentinel. NULL, matching DD — `src/utils/exporters.js` and
//    `gas/Mailer.gs` both emit `SET static_data_refresh_time = NULL`. An
//    earlier draft of this file used NOW(), which reads as the opposite
//    instruction: NULL tells the instance its static data is stale and must be
//    reloaded, whereas a fresh timestamp tells it the cache was just refreshed
//    and may well suppress the reload the export exists to trigger. Do not
//    "fix" this back to NOW().
//
// Also worth knowing: `created_by` / `updated_by` are marked `auto` in
// lib/columns.js and are therefore absent from exportColumns(), so they are not
// written. DD used to send them as the literal 'SYSTEM'. Unlike the two
// timestamps, they have no declared downstream name in DD_TABLES[id], so there
// is nothing here to rename them to; if downstream declares either NOT NULL
// without a default, that has to be fixed in lib/columns.js and schema.js, not
// papered over here.

import {
  DD_TABLES, EXPORT_ORDER, CACHE_RESET_TABLE, CACHE_RESET_COLUMN,
} from './schema.js'
import { exportColumns, isTextColumn, column } from './columns.js'

// Columns that exist only in Supabase. exportColumns() already drops all three
// (they are `auto`), and this second filter means un-marking one of them in
// lib/columns.js some day cannot silently start leaking a surrogate id — or an
// actor name with no downstream column — into production SQL.
const LOCAL_ONLY_COLUMNS = ['id', 'created_by', 'updated_by']

const RULE = '-- ' + '='.repeat(74)
const SUB_RULE = '-- ' + '-'.repeat(74)

// ── Literals ────────────────────────────────────────────────────────────────

// Metacharacters MySQL reads specially inside a quoted string. \Z is the one
// that surprises people: a literal Ctrl-Z ends the file on Windows clients.
// The two control characters are named rather than written as literals, because
// a raw Ctrl-Z or NUL byte in this source would make git and grep call the file
// binary.
const CTRL_SUB = String.fromCharCode(26)
const CTRL_NUL = String.fromCharCode(0)

const SQL_CONTROL = {
  '\\': '\\\\',
  '\n': '\\n',
  '\r': '\\r',
  '\t': '\\t',
  [CTRL_SUB]: '\\Z',
  [CTRL_NUL]: '\\0',
}

// Derived from the map's own keys, as \xNN escapes, so adding a metacharacter
// above is enough and the two can never drift apart.
const SQL_CONTROL_RE = new RegExp(
  `[${Object.keys(SQL_CONTROL)
    .map(ch => `\\x${ch.charCodeAt(0).toString(16).padStart(2, '0')}`)
    .join('')}]`,
  'g',
)

/**
 * Escapes the body of a MySQL string literal (no surrounding quotes).
 *
 * The single quote is doubled rather than backslash-escaped because doubling is
 * the one form that is also correct under sql_mode=NO_BACKSLASH_ESCAPES, and
 * `O'Brien's 50%` has to round-trip. The remaining metacharacters do assume
 * MySQL's default sql_mode, which the generated header states outright so a
 * server running NO_BACKSLASH_ESCAPES is caught by a person, not by a corrupted
 * row. Quotes are doubled first: after that the string holds no backslash the
 * second pass could double a second time.
 */
export function escapeSqlString(value) {
  return String(value)
    .replace(/'/g, "''")
    .replace(SQL_CONTROL_RE, ch => SQL_CONTROL[ch])
}

const quote = s => `'${escapeSqlString(s)}'`

const pad2 = n => String(n).padStart(2, '0')

/** A Date as MySQL's DATETIME shape, in UTC. */
function utcStamp(d) {
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())} `
    + `${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}:${pad2(d.getUTCSeconds())}`
}

/** A `date` column: the calendar day only, never shifted by a timezone. */
export function toSqlDate(v) {
  if (v instanceof Date) {
    return `${v.getUTCFullYear()}-${pad2(v.getUTCMonth() + 1)}-${pad2(v.getUTCDate())}`
  }
  // Postgres hands `date` back as 'YYYY-MM-DD' already. Slicing it is safer
  // than round-tripping through Date, which would drag the local zone in and
  // could move a promo's start date by a day.
  return String(v).slice(0, 10)
}

/** A `timestamptz` column as MySQL DATETIME, in UTC. Exported so the XLSX sheets
 *  can render the same instant the SQL does, rather than a locale's idea of it. */
export function toSqlTimestamp(v) {
  if (v instanceof Date) return utcStamp(v)
  const d = new Date(String(v))
  if (!Number.isNaN(+d)) return utcStamp(d)
  // Unparseable: reshape what we were given rather than invent a date.
  return String(v).replace('T', ' ').slice(0, 19)
}

/**
 * One value rendered as a complete MySQL literal — never a fragment needing
 * further quoting by the caller.
 *
 * @param {*} value                 a JS value straight off a Supabase row
 * @param {object}  [opts]
 * @param {boolean} [opts.text]     the column is varchar downstream, so quote
 *                                  it even when every character is a digit
 *                                  (merchant_id). Comes from isTextColumn(),
 *                                  never from looking at the value.
 * @param {string}  [opts.type]     the column's declared type from
 *                                  lib/columns.js when the caller knows it
 * @returns {string}
 */
export function escapeSqlValue(value, { text = false, type = null } = {}) {
  // A JS null is the NULL keyword. The four-character string 'NULL' typed into
  // a form is data and stays quoted — conflating the two turns a real value
  // into a missing one, and it is not recoverable afterwards.
  if (value === null || value === undefined) return 'NULL'

  if (text) return quote(value)

  if (type === 'date') return quote(toSqlDate(value))
  if (type === 'timestamp') return quote(toSqlTimestamp(value))
  if (value instanceof Date) return quote(toSqlTimestamp(value))

  if (type === 'number' || type === 'integer' || typeof value === 'number') {
    const n = Number(value)
    // NaN and Infinity have no MySQL literal; NULL is the only honest answer.
    return Number.isFinite(n) ? String(n) : 'NULL'
  }

  if (typeof value === 'boolean') return value ? '1' : '0'

  // Everything else — text, enum, uuid, and any column whose type the caller
  // did not pass — is quoted. Deciding by the declared type rather than by
  // whether the value looks numeric is the whole point: a bank account number
  // that happens to have no leading zero must not export as an integer.
  return quote(value)
}

/**
 * Identifiers are backtick-quoted, MySQL's own form. Bare names would work for
 * every column DD has today, but not for one added later that collides with a
 * reserved word — and a DBA reading the script should not have to check.
 */
export function sqlIdent(name) {
  return '`' + String(name).replace(/`/g, '``') + '`'
}

/** Every statement is fully qualified, so it cannot land in the wrong schema. */
export function sqlQualified(db, table) {
  return `${sqlIdent(db)}.${sqlIdent(table)}`
}

// ── Column plan ─────────────────────────────────────────────────────────────

function requireTable(tableId) {
  const meta = DD_TABLES[tableId]
  if (!meta) throw new Error(`dd sql-export: unknown table "${tableId}"`)
  return meta
}

/**
 * The columns one statement writes, as { local, target } pairs in the order
 * lib/columns.js declares them, with the two timestamps appended under the
 * downstream names DD_TABLES[id].timestamps gives them.
 *
 * That rename is the silent one: discount_bu_accounts wants
 * created_datetime / last_modified while the other two want
 * created_time / updated_time, and sending `created_at` downstream fails at
 * import time with nothing in this app to show for it.
 *
 * @param {string} tableId
 * @param {{ withCreated?: boolean }} [opts] pass false on UPDATE — an edit must
 *        not rewrite the row's creation time downstream
 * @returns {{ local: string, target: string }[]}
 */
export function exportColumnPairs(tableId, { withCreated = true } = {}) {
  const meta = requireTable(tableId)
  const pairs = exportColumns(tableId)
    .filter(name => !LOCAL_ONLY_COLUMNS.includes(name))
    .map(name => ({ local: name, target: name }))

  const ts = meta.timestamps || {}
  if (withCreated && ts.created_at) pairs.push({ local: 'created_at', target: ts.created_at })
  if (ts.updated_at) pairs.push({ local: 'updated_at', target: ts.updated_at })
  return pairs
}

/** A row's value for one local column, rendered with that column's own rules. */
function literal(tableId, localName, value) {
  return escapeSqlValue(value, {
    text: isTextColumn(tableId, localName),
    type: column(tableId, localName)?.type ?? null,
  })
}

/**
 * WHERE clause matching exactly one downstream row.
 *
 * Built from DD_TABLES[id].keyColumns — the *downstream* key (`name AND sof`
 * for BU accounts), not SP-lite's surrogate `id`, which downstream has never
 * seen.
 *
 * A missing key value throws rather than being skipped: an UPDATE or DELETE
 * with a hole in its WHERE clause is the one mistake this module must never
 * make, and a loud failure in the browser is cheaper than a quiet one in
 * production. buildScript() catches it and reports the change as skipped.
 */
function whereClause(tableId, source) {
  const meta = requireTable(tableId)
  return meta.keyColumns.map((k) => {
    const v = source?.[k]
    if (v === null || v === undefined || v === '') {
      throw new Error(
        `${meta.label}: key column "${k}" is empty — refusing to build an unbounded statement`,
      )
    }
    return `${sqlIdent(k)} = ${literal(tableId, k, v)}`
  }).join(' AND ')
}

// ── Statement builders ──────────────────────────────────────────────────────

/**
 * @param {string} tableId  a key of DD_TABLES
 * @param {object} row      Supabase row, keyed by local column name
 * @returns {string} one `INSERT INTO db.table (…) VALUES (…);`
 */
export function buildInsert(tableId, row) {
  const meta = requireTable(tableId)
  const pairs = exportColumnPairs(tableId)
  const cols = pairs.map(p => sqlIdent(p.target)).join(', ')
  const vals = pairs.map(p => literal(tableId, p.local, row?.[p.local])).join(', ')
  return `INSERT INTO ${sqlQualified(meta.targetDb, meta.targetTable)} (${cols}) VALUES (${vals});`
}

/**
 * @param {string} tableId
 * @param {object} row                the row's *current* values
 * @param {object} [opts]
 * @param {object|null} [opts.where]  key values to match on instead of the
 *        row's own. Needed when a key column was itself edited: downstream
 *        still holds the old key, so matching on the new one would update
 *        nothing at all. dd_audit_log records the old key in `detail` for
 *        exactly this case. When `where` is given the key columns are also
 *        SET, so the rename actually lands.
 * @returns {string} one `UPDATE db.table SET … WHERE …;`
 */
export function buildUpdate(tableId, row, { where = null } = {}) {
  const meta = requireTable(tableId)
  const renaming = !!where
  const keys = meta.keyColumns

  const pairs = exportColumnPairs(tableId, { withCreated: false })
    .filter(p => renaming || !(keys.includes(p.local) || keys.includes(p.target)))

  if (!pairs.length) {
    throw new Error(`${meta.label}: nothing to SET — every exportable column is part of the key`)
  }

  const sets = pairs.map(p => `${sqlIdent(p.target)} = ${literal(tableId, p.local, row?.[p.local])}`)
  return `UPDATE ${sqlQualified(meta.targetDb, meta.targetTable)} SET ${sets.join(', ')}`
    + ` WHERE ${whereClause(tableId, where || row)};`
}

/**
 * @param {string} tableId
 * @param {object} row  needs only the key columns; the Export Center passes a
 *        key-only stub reconstructed from dd_audit_log, since the real row is
 *        gone by the time a delete is exported
 * @returns {string} one `DELETE FROM db.table WHERE …;`
 */
export function buildDelete(tableId, row) {
  const meta = requireTable(tableId)
  return `DELETE FROM ${sqlQualified(meta.targetDb, meta.targetTable)}`
    + ` WHERE ${whereClause(tableId, row)};`
}

/**
 * One statement per database, closing that database's block. Emitted once
 * however many rows moved, because it invalidates the whole instance cache
 * rather than anything row-shaped.
 */
export function buildCacheReset(targetDb) {
  // NULL, not NOW() — see note 2 in the header. NULL means "stale, reload";
  // a timestamp means "just refreshed" and would suppress the very reload
  // this statement exists to force.
  return `UPDATE ${sqlQualified(targetDb, CACHE_RESET_TABLE)}`
    + ` SET ${sqlIdent(CACHE_RESET_COLUMN)} = NULL;`
}

/** Dispatches one change to the right builder. Throws on an unknown action. */
export function buildStatement(change) {
  const { tableId, action, row, where } = change
  if (action === 'INSERT') return buildInsert(tableId, row)
  if (action === 'UPDATE') return buildUpdate(tableId, row, { where })
  if (action === 'DELETE') return buildDelete(tableId, row)
  throw new Error(`dd sql-export: unknown action "${action}"`)
}

// ── Script ──────────────────────────────────────────────────────────────────

/** EXPORT_ORDER first; a table added to schema.js but not to it still exports. */
function orderedTableIds() {
  const rest = Object.keys(DD_TABLES).filter(id => !EXPORT_ORDER.includes(id))
  return [...EXPORT_ORDER, ...rest]
}

/** Counts for the UI, without building the script twice. */
export function describeChanges(changes) {
  const out = { INSERT: 0, UPDATE: 0, DELETE: 0, total: 0, byTable: {} }
  for (const c of changes || []) {
    if (!(c.action in out)) continue
    out[c.action]++
    out.total++
    out.byTable[c.tableId] = (out.byTable[c.tableId] || 0) + 1
  }
  return out
}

// A comment line must stay one line: a newline inside `note` or an actor name
// would push the rest of the header out into executable position.
const commentSafe = s => String(s).replace(/[\r\n]+/g, ' ')

/**
 * The whole script: header block, one fenced block per target database in
 * EXPORT_ORDER, each closed by its single cache reset.
 *
 * Within a database, tables follow EXPORT_ORDER — parent before child, which is
 * the right direction for INSERT and UPDATE. Within a table, statements keep
 * the order they were handed in.
 *
 * @param {{tableId: string, action: string, row: object, where?: object}[]} changes
 * @param {object} [options]
 * @param {string} [options.mode]         labels the header: 'delta' | 'full'
 * @param {Date}   [options.generatedAt]  injectable so the output is testable
 * @param {string} [options.actor]        who asked for it, for the header
 * @param {string} [options.note]         one line of context, e.g. the cutoff
 * @returns {string}
 */
export function buildScript(changes, options = {}) {
  const {
    mode = 'delta',
    generatedAt = new Date(),
    actor = '',
    note = '',
  } = options

  const list = Array.isArray(changes) ? changes : []
  const problems = []
  const counts = { INSERT: 0, UPDATE: 0, DELETE: 0 }
  const perTable = new Map()

  for (const tableId of orderedTableIds()) {
    const mine = list.filter(c => c.tableId === tableId)
    if (!mine.length) continue
    const statements = []
    for (const change of mine) {
      try {
        statements.push(buildStatement(change))
        counts[change.action] = (counts[change.action] ?? 0) + 1
      } catch (e) {
        // A change that cannot be expressed safely is left out and named in the
        // header, never emitted half-formed.
        problems.push(e.message)
      }
    }
    if (statements.length) perTable.set(tableId, statements)
  }

  // Database order is EXPORT_ORDER's, by first appearance.
  const dbs = []
  for (const tableId of perTable.keys()) {
    const db = DD_TABLES[tableId].targetDb
    if (!dbs.includes(db)) dbs.push(db)
  }

  const total = counts.INSERT + counts.UPDATE + counts.DELETE
  const out = []

  out.push(RULE)
  out.push(`-- DD export — ${commentSafe(mode)}`)
  out.push(`-- Generated ${utcStamp(generatedAt)} UTC${actor ? ` by ${commentSafe(actor)}` : ''}`)
  if (note) out.push(`-- ${commentSafe(note)}`)
  out.push('--')
  out.push(`-- ${total} statement(s): ${counts.INSERT} INSERT, ${counts.UPDATE} UPDATE, ${counts.DELETE} DELETE`)
  for (const [tableId, statements] of perTable) {
    const meta = DD_TABLES[tableId]
    out.push(`--   ${meta.targetDb}.${meta.targetTable} — ${statements.length}`)
  }
  out.push('--')
  out.push('-- Datetime literals are UTC.')
  out.push('-- The local surrogate `id` is never exported; downstream assigns its own.')
  out.push('-- UPDATE and DELETE match on the downstream key, not on that id.')
  out.push(`-- Each database block ends with one ${CACHE_RESET_TABLE} cache reset, emitted`)
  out.push('-- once however many rows moved: it invalidates the whole instance cache.')
  out.push('-- Written for MySQL default sql_mode (backslash escapes enabled).')

  if (problems.length) {
    out.push('--')
    out.push(`-- !! ${problems.length} change(s) could NOT be turned into a statement and are`)
    out.push('-- !! absent below. Fix these by hand or re-check the record:')
    problems.forEach(p => out.push(`-- !!   ${commentSafe(p)}`))
  }
  out.push(RULE)

  if (!perTable.size) {
    out.push('')
    out.push('-- Nothing to export for this selection.')
    return `${out.join('\n')}\n`
  }

  for (const db of dbs) {
    out.push('')
    out.push(SUB_RULE)
    out.push(`-- ${db}`)
    out.push(SUB_RULE)
    for (const [tableId, statements] of perTable) {
      const meta = DD_TABLES[tableId]
      if (meta.targetDb !== db) continue
      out.push(`-- ${meta.targetTable} (${statements.length} statement(s))`)
      out.push(...statements)
      out.push('')
    }
    out.push(`-- ${db}: invalidate the instance cache so the rows above go live`)
    out.push(buildCacheReset(db))
  }

  return `${out.join('\n')}\n`
}

// ── Filenames ───────────────────────────────────────────────────────────────

/**
 * 20260820-1432, in the reader's own clock. Deliberately local while the
 * statements themselves are UTC: the filename is how a person finds the file
 * again later, the literals are what a server reads.
 */
export function exportStamp(d = new Date()) {
  return `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}`
    + `-${pad2(d.getHours())}${pad2(d.getMinutes())}`
}

/** dd-export-delta-20260820-1432.sql */
export function sqlFilename(mode, d = new Date()) {
  return `dd-export-${String(mode).replace(/[^\w.-]+/g, '_')}-${exportStamp(d)}.sql`
}
