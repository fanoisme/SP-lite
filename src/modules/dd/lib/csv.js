// Minimal CSV writer for the DD module. XLSX export lives in
// @/lib/export-xlsx.js and is for data tables; the audit log is a text log, so
// CSV is the right shape and needs no dependency.

function escapeCell(v) {
  if (v == null) return ''
  const s = String(v)
  // Quote when the value contains a delimiter, a quote or a newline; double any
  // embedded quote. That is the whole of RFC 4180 that matters here.
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

export function downloadCsv(rows, columns, filename) {
  const header = columns.map(c => escapeCell(c.label)).join(',')
  const body = rows.map(row =>
    columns.map(c => {
      const raw = row[c.key]
      return escapeCell(c.format ? c.format(raw, row) : raw)
    }).join(','),
  )
  // The BOM makes Excel open a UTF-8 CSV without mangling accented names.
  const csv = '﻿' + [header, ...body].join('\r\n')

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${filename}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
