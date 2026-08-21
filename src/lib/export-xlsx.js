import * as XLSX from 'xlsx'

// A value Excel must store as text rather than as a number.
//
// Two silent failure modes for an all-digit id: a value past 15 digits loses
// its tail to float precision, and a value with a leading zero loses the zero
// at any length. Both are fixed by handing SheetJS a string — json_to_sheet
// types a string as `t:'s'` and Excel does not re-read a text cell as a number.
//
// This deliberately does NOT wrap the value as `="…"`. That form is a CSV
// trick: Excel parses a CSV field, so a leading `=` becomes a formula there,
// but SheetJS writes `="0812"` into a .xlsx as the literal nine-character
// string and Excel then displays it verbatim, quotes and all. Every .xlsx this
// module produced showed `="0812"` in the Merchant ID column for that reason.
// Mark such a column with `text: true` and pass the plain value.
function asText(v) {
  return v == null ? '' : String(v)
}

function cellValue(row, col) {
  const raw = row[col.key]
  const v = col.format ? col.format(raw, row) : raw
  return col.text ? asText(v) : (v != null ? v : '')
}

export function exportToXlsx(rows, columns, filename) {
  const data = rows.map((row) => {
    const obj = {}
    for (const col of columns) obj[col.label] = cellValue(row, col)
    return obj
  })
  const ws = XLSX.utils.json_to_sheet(data)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1')
  XLSX.writeFile(wb, `${filename}.xlsx`)
}

// Multi-sheet export for dashboard
export function exportMultiSheetXlsx(sheets, filename) {
  const wb = XLSX.utils.book_new()
  for (const sh of sheets) {
    const data = sh.rows.map((row) => {
      const obj = {}
      for (const col of sh.columns) obj[col.label] = cellValue(row, col)
      return obj
    })
    const ws = XLSX.utils.json_to_sheet(data)
    XLSX.utils.book_append_sheet(wb, ws, sh.name)
  }
  XLSX.writeFile(wb, `${filename}.xlsx`)
}
