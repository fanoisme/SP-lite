import * as XLSX from 'xlsx'

// Wrap an all-digit id as ="…" so Excel stores it as text.
//
// Two distinct failure modes, both silent: a value past 15 digits loses its
// tail to float precision, and a value with a leading zero loses the zero at
// any length. The length threshold alone caught only the first, so a merchant
// id like 0812 came back as 812 and no longer matched downstream.
function textFormula(v) {
  if (v == null) return ''
  const s = String(v)
  if (/^\d{10,}$/.test(s) || /^0\d+$/.test(s)) return `="${s}"`
  return s
}

export function exportToXlsx(rows, columns, filename) {
  const data = rows.map(row => {
    const obj = {}
    for (const col of columns) {
      const raw = row[col.key]
      const v = col.format ? col.format(raw, row) : raw
      obj[col.label] = col.textFormula ? textFormula(v) : (v != null ? v : '')
    }
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
    const data = sh.rows.map(row => {
      const obj = {}
      for (const col of sh.columns) {
        const raw = row[col.key]
        const v = col.format ? col.format(raw, row) : raw
        obj[col.label] = col.textFormula ? textFormula(v) : (v != null ? v : '')
      }
      return obj
    })
    const ws = XLSX.utils.json_to_sheet(data)
    XLSX.utils.book_append_sheet(wb, ws, sh.name)
  }
  XLSX.writeFile(wb, `${filename}.xlsx`)
}
