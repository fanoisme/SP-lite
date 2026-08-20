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
import { editableColumns, coerce } from './columns.js'

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
export function mapHeaders(tableId, headers) {
  const cols = editableColumns(tableId)
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
  const taken = new Set()

  ;(headers || []).forEach((h) => {
    const key = normalizeHeader(h)
    // Trailing empty header cells are an artefact of the export, not a mistake
    // worth reporting.
    if (!key) { mapping.push(null); return }
    const col = lookup.get(key)
    if (!col || taken.has(col)) { mapping.push(null); unknown.push(String(h).trim()); return }
    taken.add(col)
    mapping.push(col)
  })

  const missingRequired = cols.filter(c => c.required && !taken.has(c.name)).map(c => c.name)
  return { mapping, unknown, missingRequired }
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
