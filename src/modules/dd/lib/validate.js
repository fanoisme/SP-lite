// DD module — business validation, shared by every write surface: the three
// manage forms, the bulk upload preview, and the raw insert form under
// Databases.
//
// Ported from `src/api/validate.js` in the DD repo. Two deliberate departures:
//
//  - DD ran the same checks a second time server-side in gas/Code.gs, so a
//    stale tab could not bypass them. SP-lite has no server tier, so the
//    database CHECK constraints and foreign keys are the real gate and these
//    functions are the explanation layer. Every rule below that is not also a
//    CHECK constraint is noted as such.
//  - Amount sentinels use SP-lite's values (see lib/columns.js), not DD's.
//
// Each validator takes a row keyed by column name and returns an array of
// human-readable problems, empty when the row is acceptable.

import { UNLIMITED_AMOUNT, NO_MINIMUM, isUnlimited } from './columns.js'

const num = (v) => Number(String(v ?? '').replace(/,/g, ''))

// A blank is a blank. Sheets written before DD adopted this rule may still hold
// the literal text "NULL", so reads tolerate it — writing it back would export
// as the four-character string and be imported as data.
export const LEGACY_NULL_TEXT = 'NULL'

export function isBlank(v) {
  const s = String(v ?? '').trim()
  return s === '' || s.toUpperCase() === LEGACY_NULL_TEXT
}

const filled = (v) => !isBlank(v)

export const BU_REQUIRED = [
  'name', 'sof', 'account1', 'acctname1', 'percentage1', 'account2', 'acctname2', 'percentage2',
]

export function validateBuAccount(row) {
  const errors = []
  BU_REQUIRED.forEach((col) => {
    if (!filled(row[col])) errors.push(`${col} is required`)
  })

  if (filled(row.sof) && !['PRIME', 'PAYLATER'].includes(String(row.sof).trim().toUpperCase())) {
    errors.push('sof must be PRIME or PAYLATER')
  }

  const p1 = num(row.percentage1)
  const p2 = num(row.percentage2)
  if (filled(row.percentage1) && Number.isNaN(p1)) errors.push('percentage1 must be a number')
  if (filled(row.percentage2) && Number.isNaN(p2)) errors.push('percentage2 must be a number')

  // Mirrors the CHECK constraints on the table.
  if (!Number.isNaN(p1) && filled(row.percentage1) && (p1 < 0 || p1 > 1)) {
    errors.push('percentage1 must be between 0 and 1')
  }
  if (!Number.isNaN(p2) && filled(row.percentage2) && (p2 < 0 || p2 > 1)) {
    errors.push('percentage2 must be between 0 and 1')
  }

  // The split has to land exactly on 1.0000. No CHECK constraint enforces this
  // — it is the one BU rule that lives only here, so the form must not let a
  // row through without it.
  if (!Number.isNaN(p1) && !Number.isNaN(p2) && filled(row.percentage1) && filled(row.percentage2)) {
    if (Math.abs(p1 + p2 - 1) > 0.00005) {
      errors.push(`percentage1 + percentage2 must add up to 1.0000 (currently ${(p1 + p2).toFixed(4)})`)
    }
  }
  return errors
}

export function validateMerchant(row) {
  const errors = []
  ;['merchant_id', 'merchant_name', 'bu_name'].forEach((col) => {
    if (!filled(row[col])) errors.push(`${col} is required`)
  })
  if (filled(row.status) && !['ACTIVE', 'INACTIVE'].includes(String(row.status).trim().toUpperCase())) {
    errors.push('status must be ACTIVE or INACTIVE')
  }
  return errors
}

/**
 * Promos. The conditional rules mirror what the form offers:
 *  - the period is always required and must not run backwards
 *  - a channel with a discount type set needs its value and its cap
 *  - min_txn_amount is required; max and budget are optional (blank = no limit)
 *  - priority is required and cannot be negative
 */
export function validatePromo(row) {
  const errors = []

  if (!filled(row.promo_id)) errors.push('promo_id is required')
  else if (String(row.promo_id).trim().length > PROMO_ID_MAX) {
    errors.push(`promo_id cannot exceed ${PROMO_ID_MAX} characters`)
  }

  if (!filled(row.promo_name)) errors.push('promo_name is required')
  if (!filled(row.bu_name)) errors.push('bu_name is required')

  if (!filled(row.start_date)) errors.push('start_date is required')
  if (!filled(row.end_date)) errors.push('end_date is required')
  if (filled(row.start_date) && filled(row.end_date)) {
    const s = new Date(String(row.start_date).replace(' ', 'T'))
    const e = new Date(String(row.end_date).replace(' ', 'T'))
    if (!Number.isNaN(+s) && !Number.isNaN(+e) && s > e) {
      errors.push('start_date cannot be after end_date')
    }
  }

  // A channel is "eligible" when it carries a discount type at all. DD keyed
  // this off PERCENTAGE only, because FIXED did not exist in its schema; the
  // qrdd_promo_rules CHECK allows both, so both need a value and a cap.
  const channel = (label, typeCol, valueCol, capCol) => {
    if (!filled(row[typeCol])) return
    if (!filled(row[valueCol])) {
      errors.push(`${label} has a discount type, so ${valueCol} is required`)
    } else if (Number.isNaN(num(row[valueCol]))) {
      errors.push(`${valueCol} must be a number`)
    }
    if (!filled(row[capCol])) {
      errors.push(`${label} has a discount type, so ${capCol} is required (use the unlimited option for no cap)`)
    } else if (Number.isNaN(num(row[capCol]))) {
      errors.push(`${capCol} must be a number`)
    }
  }
  channel('PRIME', 'prm_discount_type', 'prm_discount_value', 'prm_max_discount')
  channel('PAYLATER', 'pl_discount_type', 'pl_discount_value', 'pl_max_discount')

  if (!filled(row.min_txn_amount)) errors.push('min_txn_amount is required')
  else if (Number.isNaN(num(row.min_txn_amount))) errors.push('min_txn_amount must be a number')
  else if (num(row.min_txn_amount) < NO_MINIMUM) errors.push(`min_txn_amount cannot be below ${NO_MINIMUM}`)

  // Blank means no limit; a non-numeric value is always wrong.
  ;['max_txn_amount', 'budget_amount'].forEach((col) => {
    if (filled(row[col]) && Number.isNaN(num(row[col]))) errors.push(`${col} must be a number`)
  })

  if (filled(row.min_txn_amount) && filled(row.max_txn_amount)) {
    const lo = num(row.min_txn_amount)
    const hi = num(row.max_txn_amount)
    if (!Number.isNaN(lo) && !Number.isNaN(hi) && !isUnlimited(hi) && hi < lo) {
      errors.push('max_txn_amount cannot be below min_txn_amount')
    }
  }

  if (!filled(row.priority)) errors.push('priority is required')
  else if (Number.isNaN(num(row.priority))) errors.push('priority must be a number')
  else if (num(row.priority) < 0) errors.push('priority cannot be below 0')

  if (filled(row.status) && !['ACTIVE', 'INACTIVE'].includes(String(row.status).trim().toUpperCase())) {
    errors.push('status must be ACTIVE or INACTIVE')
  }

  return errors
}

const VALIDATORS = {
  bu_accounts: validateBuAccount,
  merchants: validateMerchant,
  promos: validatePromo,
}

/** Validates a column-keyed object. Keys are lowercased first, so a header
 *  pasted as "Merchant_ID" from a spreadsheet validates the same as the DB. */
export function validateRow(tableId, values) {
  const fn = VALIDATORS[tableId]
  if (!fn) return []
  const lowered = {}
  Object.keys(values || {}).forEach((k) => { lowered[String(k).trim().toLowerCase()] = values[k] })
  return fn(lowered)
}

export const PROMO_ID_MAX = 32

/**
 * `{promo_name}_{yy_MM}_{seq}`, truncated so the result never exceeds 32 chars.
 * `taken` is a Set of promo ids already in use.
 */
export function generatePromoId(promoName, taken = new Set()) {
  const base = String(promoName || 'promo').trim().toLowerCase()
    .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'promo'
  const d = new Date()
  const ym = String(d.getFullYear()).slice(2) + '_' + String(d.getMonth() + 1).padStart(2, '0')
  for (let seq = 1; seq < 10000; seq++) {
    const suffix = `_${ym}_${seq}`
    const id = base.slice(0, Math.max(1, PROMO_ID_MAX - suffix.length)).replace(/_+$/, '') + suffix
    if (!taken.has(id)) return id
  }
  throw new Error('Could not generate a unique promo_id')
}

export { UNLIMITED_AMOUNT, NO_MINIMUM }
