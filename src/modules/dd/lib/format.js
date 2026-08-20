// DD module — display formatting shared by every screen.
//
// Ported from `src/utils/format.js` in the DD repo, trimmed to what SP-lite
// actually renders. Every function is total: a null, an empty string and an
// unparseable value all return a placeholder rather than throwing or printing
// "NaN" / "Invalid Date" into a table cell.

import { isUnlimited, UNLIMITED_AMOUNT, NO_MINIMUM } from './columns.js'

export const EM_DASH = '—'

const idNum = new Intl.NumberFormat('id-ID')
const idMoney = new Intl.NumberFormat('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export function formatNumber(v) {
  if (v == null || v === '') return EM_DASH
  const n = Number(v)
  return Number.isNaN(n) ? String(v) : idNum.format(n)
}

/** Rupiah amounts. The unlimited sentinel prints as a word, not as its digits. */
export function formatAmount(v) {
  if (v == null || v === '') return EM_DASH
  if (isUnlimited(v)) return 'Unlimited'
  const n = Number(v)
  return Number.isNaN(n) ? String(v) : idMoney.format(n)
}

/** Minimum transaction: the floor sentinel prints as a word too. */
export function formatMinAmount(v) {
  if (v == null || v === '') return EM_DASH
  const n = Number(v)
  if (!Number.isNaN(n) && n <= NO_MINIMUM) return 'No Minimum'
  return formatAmount(v)
}

/** A discount value reads differently per type: 15% versus Rp 15.000,00. */
export function formatDiscount(value, type) {
  if (!type) return EM_DASH
  if (value == null || value === '') return EM_DASH
  return type === 'PERCENTAGE' ? `${Number(value)}%` : formatAmount(value)
}

/** 0.7500 -> "75.00%" — the BU split is stored as a fraction, read as a share. */
export function formatPercentage(v, places = 2) {
  if (v == null || v === '') return EM_DASH
  const n = Number(v)
  return Number.isNaN(n) ? String(v) : `${(n * 100).toFixed(places)}%`
}

/** `date` columns. Rendered without a timezone shift: a promo starting on the
 *  1st must not read as the 31st for anyone west of Jakarta. */
export function formatDate(v) {
  if (!v) return EM_DASH
  const s = String(v).slice(0, 10)
  const [y, m, d] = s.split('-')
  if (!y || !m || !d) return String(v)
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const mi = Number(m) - 1
  return `${d} ${months[mi] ?? m} ${y}`
}

export const TZ = 'Asia/Jakarta'

/**
 * "now" as a naive WIB wall-clock string, `YYYY-MM-DD HH:mm:ss`.
 *
 * The DD tables store created_at/updated_at as `timestamp` without a zone,
 * meaning WIB. `new Date().toISOString()` would write UTC wall-clock into them
 * and land every new row seven hours in the past — the same fault the import
 * hit before 20260821_dd_timestamps_are_wib.sql. Built from formatted parts
 * rather than by adding an offset so it stays correct without assuming the
 * browser's own timezone.
 */
export function nowWib() {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: TZ, hour12: false,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    }).formatToParts(new Date()).map(x => [x.type, x.value]),
  )
  // Intl renders midnight as hour 24 in some engines.
  const hour = p.hour === '24' ? '00' : p.hour
  return `${p.year}-${p.month}-${p.day} ${hour}:${p.minute}:${p.second}`
}

/**
 * Row timestamps. These columns are naive WIB, so the value is already the
 * reading we want — parsing it through Date would reinterpret it in the
 * browser's zone and shift it for anyone outside Jakarta. Reformat the parts
 * instead, and only fall back to Date for a value that still carries a zone
 * (dd_audit_log.ts and dd_email_log.ts are still timestamptz on purpose).
 */
export function formatTimestamp(v) {
  if (!v) return EM_DASH
  const s = String(v)
  const naive = s.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/)
  if (naive && !/[Zz]|[+-]\d{2}:?\d{2}$/.test(s)) {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    const [, y, m, d, hh, mm] = naive
    return `${d} ${months[Number(m) - 1] ?? m} ${y} ${hh}:${mm}`
  }
  const d = new Date(s)
  if (Number.isNaN(+d)) return s
  return d.toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: TZ,
  })
}

/** "3 minutes ago". Used by the stale banner and the dashboard's recent list. */
export function formatRelative(v) {
  if (!v) return EM_DASH
  const then = new Date(v)
  if (Number.isNaN(+then)) return String(v)
  const secs = Math.round((Date.now() - then.getTime()) / 1000)
  if (secs < 45) return 'just now'
  const units = [
    ['minute', 60], ['hour', 3600], ['day', 86400], ['week', 604800],
    ['month', 2629800], ['year', 31557600],
  ]
  let label = 'second'
  let size = 1
  for (const [u, s] of units) {
    if (secs < s) break
    label = u
    size = s
  }
  const n = Math.round(secs / size)
  return `${n} ${label}${n === 1 ? '' : 's'} ago`
}

/** Days from today until a date column. Negative when already past. */
export function daysUntil(v) {
  if (!v) return null
  const target = new Date(`${String(v).slice(0, 10)}T00:00:00`)
  if (Number.isNaN(+target)) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.round((target - today) / 86400000)
}

export function isExpired(endDate) {
  const d = daysUntil(endDate)
  return d != null && d < 0
}

/** The value a form should show for an amount that may hold the sentinel. */
export function amountInputValue(v) {
  return isUnlimited(v) ? '' : (v ?? '')
}

export { UNLIMITED_AMOUNT, NO_MINIMUM, isUnlimited }
