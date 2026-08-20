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

/** `timestamptz` columns, in the reader's local zone — these are event times,
 *  so the local reading is the correct one. */
export function formatTimestamp(v) {
  if (!v) return EM_DASH
  const d = new Date(v)
  if (Number.isNaN(+d)) return String(v)
  return d.toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
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
