// Minimal CSV writer for the DD module. XLSX export lives in
// @/lib/export-xlsx.js and is for data tables; the audit log is a text log, so
// CSV is the right shape and needs no dependency.

/** RFC 4180 quoting, and nothing else. Quote when the value contains a
 *  delimiter, a quote or a newline; double any embedded quote. */
function csvField(s) {
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

function escapeCell(v) {
  if (v == null) return ''
  let s = String(v)
  // CSV formula injection guard: old_value/new_value/record_key come verbatim
  // from user-typed columns (BU name, merchant name, promo name) entered
  // through the still-live /qrdd forms, and actor comes from
  // profiles.full_name. A value starting with = + - @, a tab or a CR is a
  // formula trigger in Excel/Sheets (e.g. =HYPERLINK("http://evil","click"))
  // and this file deliberately prepends a UTF-8 BOM so Excel opens the file
  // directly, making that live. Prefix a literal apostrophe so it is always
  // read back as text. Do not remove this as noise.
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`
  return csvField(s)
}

/**
 * A cell Excel must store as text rather than reinterpret.
 *
 * Two silent losses this prevents, both of them "the export does not match the
 * database": `2026-08-21 09:14:23` is re-read as a date and reprinted in the
 * reader's locale (often as `21/08/2026 09:14`, seconds gone), and an all-digit
 * id loses a leading zero or, past 15 digits, its tail to float precision.
 * `="…"` is the one form Excel stores verbatim, and it survives the BOM this
 * file writes. Mark a column with `text: true` to route it here.
 *
 * @/lib/export-xlsx.js honours the same flag by a different mechanism — a
 * .xlsx text cell needs the plain string, not the formula. The flag says what
 * the column *is*; each writer decides how to protect it.
 *
 * The injection guard above is deliberately skipped: this branch is the caller
 * asking for a formula, on a column the caller declared, not a value that
 * merely happens to start with `=`.
 */
function textCell(v) {
  if (v == null || v === '') return ''
  return csvField(`="${String(v).replace(/"/g, '""')}"`)
}

export function downloadCsv(rows, columns, filename) {
  const header = columns.map(c => escapeCell(c.label)).join(',')
  const body = rows.map(row =>
    columns.map(c => {
      const raw = row[c.key]
      const value = c.format ? c.format(raw, row) : raw
      return c.text ? textCell(value) : escapeCell(value)
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
