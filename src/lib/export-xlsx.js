import * as XLSX from 'xlsx'

// Prefix numeric IDs ≥10 digits with ="" so Excel treats them as text
function textFormula(v) {
  if (v == null) return ''
  const s = String(v)
  if (/^\d{10,}$/.test(s)) return `="${s}"`
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
