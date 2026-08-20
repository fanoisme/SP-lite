// DD module — the tabular parsing layer behind the bulk upload.
//
// Kept out of the component because three things want it: the bulk upload
// modal, the raw Table Explorer's paste box, and anything later that has to
// read a spreadsheet a person produced by hand. None of it touches the DOM or
// Supabase, so it is testable on its own.
//
// Every parser returns the same shape:
//
//   { headers: string[], rows: string[][] }
//
// Cells are always trimmed strings — never numbers, never null. Typing is
// columns.js's job (`coerce`), and doing it in one place means an .xlsx and a
// pasted TSV cannot disagree about what "1,500.00" means.

import * as XLSX from 'xlsx'
import { editableColumns, coerce, STAMP_COLUMNS, dateColumns, inferDateOrder, parseDate } from './columns.js'
import { DD_TABLES } from './schema.js'

// ── Delimited text (paste, .csv, .tsv) ──────────────────────────────────────

/**
 * Which delimiter a block of text uses. Counted outside quoted fields, because
 * a quoted merchant name full of commas would otherwise outvote the real tabs.
 *
 * Tabs win ties: an Excel/Sheets paste is tab-separated and its cells routinely
 * contain commas (amounts, "PT ANU, TBK"), while a CSV almost never contains a
 * bare tab.
 */
function detectDelimiter(text) {
  let inQuotes = false
  let tabs = 0
  let commas = 0
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (ch === '"') {
      if (inQuotes && text[i + 1] === '"') { i++; continue }
      inQuotes = !inQuotes
      continue
    }
    if (inQuotes) continue
    if (ch === '\t') tabs++
    else if (ch === ',') commas++
  }
  return tabs > 0 && tabs >= commas ? '\t' : ','
}

/**
 * RFC 4180 enough for real data: doubled quotes escape a quote, and a quoted
 * field may contain the delimiter and line breaks. A multi-line cell is exactly
 * what a pasted "notes" column looks like, and splitting on \n first — which is
 * the obvious implementation — shreds it into unusable half-rows.
 */
function splitGrid(text, delim) {
  const src = String(text).replace(/\r\n?/g, '\n')
  const grid = []
  let row = []
  let field = ''
  let inQuotes = false

  for (let i = 0; i < src.length; i++) {
    const ch = src[i]
    if (inQuotes) {
      if (ch !== '"') { field += ch; continue }
      if (src[i + 1] === '"') { field += '"'; i++ } else inQuotes = false
      continue
    }
    // A quote only opens a field at its start; mid-field it is a literal inch
    // mark, which is how sizes and dimensions come through.
    if (ch === '"' && field === '') { inQuotes = true; continue }
    if (ch === delim) { row.push(field); field = ''; continue }
    if (ch === '\n') { row.push(field); grid.push(row); row = []; field = ''; continue }
    field += ch
  }
  row.push(field)
  grid.push(row)
  return grid
}

const isBlankRow = (cells) => cells.every(c => String(c ?? '').trim() === '')

/**
 * Parses pasted or file text into a header row plus data rows.
 * @param {string} text
 * @returns {{ headers: string[], rows: string[][] }}
 */
export function parseDelimited(text) {
  const raw = String(text ?? '')
  if (!raw.trim()) return { headers: [], rows: [] }

  const grid = splitGrid(raw, detectDelimiter(raw))
    .map(cells => cells.map(c => String(c ?? '').trim()))
    .filter(cells => !isBlankRow(cells))

  if (!grid.length) return { headers: [], rows: [] }
  const headers = grid[0]
  // Short rows are padded so a cell's index always lines up with its header;
  // trailing empties are common when someone deletes the last column's values.
  const rows = grid.slice(1).map(cells => padTo(cells, headers.length))
  return { headers, rows }
}

function padTo(cells, width) {
  const out = cells.slice(0, Math.max(width, cells.length))
  while (out.length < width) out.push('')
  return out
}

// ── Workbooks (.xlsx / .xls) ────────────────────────────────────────────────

/**
 * Reads the first sheet of a workbook. Only the first: the DD upload is
 * per-table and picking a sheet by name would silently import nothing when
 * someone renames the tab, which is the failure the qrdd importer had.
 *
 * @param {ArrayBuffer} arrayBuffer
 * @returns {{ headers: string[], rows: string[][] }}
 */
export function parseWorkbook(arrayBuffer) {
  const wb = XLSX.read(new Uint8Array(arrayBuffer), {
    type: 'array',
    // Excel stores a date as a serial number. Without these two it arrives as
    // "45901" or "9/1/26" depending on the cell format, and a `date` column
    // needs YYYY-MM-DD.
    cellDates: true,
    dateNF: 'yyyy-mm-dd',
  })
  const first = wb.SheetNames[0]
  if (!first) return { headers: [], rows: [] }

  // raw:false renders every cell through its display format, so what we read is
  // what the person saw when they filled the sheet in.
  const grid = XLSX.utils.sheet_to_json(wb.Sheets[first], {
    header: 1, raw: false, defval: '', blankrows: false, dateNF: 'yyyy-mm-dd',
  }).map(cells => (cells || []).map(c => String(c ?? '').trim()))
    .filter(cells => !isBlankRow(cells))

  if (!grid.length) return { headers: [], rows: [] }
  const headers = grid[0]
  return { headers, rows: grid.slice(1).map(cells => padTo(cells, headers.length)) }
}

// ── Header mapping ──────────────────────────────────────────────────────────

/**
 * `Merchant_ID`, `merchant id`, ` MERCHANT-ID ` and `merchant_id` are the same
 * header. People retype these by hand and a case difference must not cost them
 * a column.
 */
export function normalizeHeader(h) {
  return String(h ?? '').trim().toLowerCase()
    .replace(/[\s.\-]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

/**
 * Resolves a file's headers against a table's editable columns.
 *
 * @returns {{
 *   mapping: (string|null)[],   // parallel to `headers`: column name, or null when ignored
 *   unknown: string[],          // headers that matched nothing (or repeat a column already taken)
 *   missingRequired: string[],  // required columns with no header at all — a hard stop
 * }}
 */
/**
 * Headers we recognise and deliberately refuse, as distinct from headers we do
 * not recognise at all. A straight DD export carries all of these, so treating
 * them as mistakes meant every upload opened with a warning about columns that
 * were never wanted — and a warning that fires every time is a warning people
 * stop reading.
 *
 *  - `id`             the source system's surrogate key. Ours is merchant_id /
 *                     promo_id, or a uuid we generate; theirs means nothing here.
 *  - the auto columns created_by / created_at / updated_by / updated_at, which
 *    the app stamps itself so a file cannot backdate or misattribute a write.
 *  - the downstream spellings of those timestamps (created_time / updated_time,
 *    created_datetime / last_modified) — same columns, DD's names for them.
 */
function ignorableHeaders(tableId) {
  const t = DD_TABLES[tableId]
  return new Set([
    'id',
    ...STAMP_COLUMNS,
    ...Object.values(t?.timestamps ?? {}),
  ].map(normalizeHeader))
}

export function mapHeaders(tableId, headers) {
  const cols = editableColumns(tableId)
  const ignorable = ignorableHeaders(tableId)
  const lookup = new Map()
  // Column names first, then labels, so a label that normalises onto another
  // column's name can never steal it — bu_accounts' "BU Name" label and
  // merchants' `bu_name` column both normalise to `bu_name`.
  cols.forEach(c => lookup.set(normalizeHeader(c.name), c.name))
  cols.forEach(c => {
    const k = normalizeHeader(c.label)
    if (!lookup.has(k)) lookup.set(k, c.name)
  })

  const mapping = []
  const unknown = []
  const ignored = []
  const taken = new Set()

  ;(headers || []).forEach((h) => {
    const key = normalizeHeader(h)
    // Trailing empty header cells are an artefact of the export, not a mistake
    // worth reporting.
    if (!key) { mapping.push(null); return }
    const col = lookup.get(key)
    if (!col || taken.has(col)) {
      mapping.push(null)
      // A recognised-but-unwanted column is reported separately from one we
      // cannot place at all: only the second is likely to be a typo.
      ;(ignorable.has(key) && !taken.has(col) ? ignored : unknown).push(String(h).trim())
      return
    }
    taken.add(col)
    mapping.push(col)
  })

  const missingRequired = cols.filter(c => c.required && !taken.has(c.name)).map(c => c.name)
  return { mapping, unknown, ignored, missingRequired }
}

// ── Records ─────────────────────────────────────────────────────────────────

/**
 * Turns positional cells into column-keyed objects, coerced to the types
 * Postgres will accept.
 *
 * A column the file never mentioned is left off the object entirely rather than
 * set to null: useDdTable's `toRow` skips keys that are absent, so an import of
 * three columns updates three columns instead of blanking the rest of the row.
 *
 * @returns {object[]} one object per row, keyed by local column name
 */
export function toRecords(tableId, headers, rows) {
  const { mapping } = mapHeaders(tableId, headers)
  return (rows || []).map((cells) => {
    const rec = {}
    mapping.forEach((col, i) => {
      if (col) rec[col] = coerce(tableId, col, cells[i])
    })
    return rec
  })
}


/**
 * Rewrites every date column to YYYY-MM-DD, deciding each column's order from
 * the whole column rather than value by value.
 *
 * A CSV saved out of Google Sheets carries the author's locale, so 2026-08-25
 * arrives as 25/08/2026 or 25-08-26 and Postgres answers "date/time field value
 * out of range". Converting is easy; converting *safely* is the point. `05-08-26`
 * reads equally well as 5 August and 8 May, and choosing wrong moves a promo's
 * period by months with nothing downstream to catch it.
 *
 * So the column is the unit of evidence: one row containing 25 in the first
 * position proves the whole column is day-first, and that verdict is then
 * applied to its ambiguous neighbours. When a column offers no such proof
 * anywhere, this refuses to guess and hands back a `blocked` entry for the
 * caller to show.
 *
 * @returns {{ records: object[], orders: Record<string,string>,
 *             blocked: {column: string, reason: string}[],
 *             rowIssues: Map<number, string[]> }}
 */
export function resolveDates(tableId, records) {
  const cols = dateColumns(tableId)
  const orders = {}
  const blocked = []
  const rowIssues = new Map()
  if (!cols.length || !records.length) return { records, orders, blocked, rowIssues }

  for (const col of cols) {
    const present = records.some(r => col in r)
    if (!present) continue

    const order = inferDateOrder(records.map(r => r[col]))
    orders[col] = order

    if (order === 'ambiguous') {
      blocked.push({
        column: col,
        reason: 'every value could be read as either day-first or month-first, and reading it wrong would shift the date by months',
      })
      continue
    }
    if (order === 'mixed') {
      blocked.push({
        column: col,
        reason: 'some rows are day-first and others month-first, so no single reading fits the column',
      })
      continue
    }

    records.forEach((r, i) => {
      const raw = r[col]
      if (raw == null || String(raw).trim() === '') return
      const iso = parseDate(raw, order)
      if (iso) { r[col] = iso; return }
      const list = rowIssues.get(i) ?? []
      list.push(`${col} is not a date this can read: "${raw}"`)
      rowIssues.set(i, list)
    })
  }

  return { records, orders, blocked, rowIssues }
}

/** How a resolved column was read, for telling the person what was assumed. */
export const DATE_ORDER_LABEL = {
  iso: 'YYYY-MM-DD',
  day: 'day first (DD/MM/YYYY)',
  month: 'month first (MM/DD/YYYY)',
}
