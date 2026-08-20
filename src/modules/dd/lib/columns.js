// DD module — column metadata for the three managed tables.
//
// One declaration serves every surface that needs to know what a column is:
// the manage forms, the bulk upload validator, the raw Table Explorer, the SQL
// exporter and the XLSX export. Adding a column downstream means editing this
// file and nothing else.
//
// This complements lib/schema.js, which owns the *table*-level facts (local
// name, target database, key columns). Columns live here because Phase 4's
// exporter and Phase 5's SQL engine need per-column typing that schema.js was
// never meant to carry.
//
// Field reference:
//   name       local (Supabase) column name
//   label      human label for forms, tables and export headers
//   type       'text' | 'number' | 'integer' | 'enum' | 'date' | 'timestamp' | 'uuid'
//   required   must be filled on every write (the guided forms enforce it)
//   options    allowed values for type 'enum' — mirrors the DB CHECK constraint
//   decimals   fixed decimal places written downstream, null when free-form
//   nullable   a blank is a legitimate SQL NULL rather than a missing value
//   auto       server- or app-filled; hidden from every input surface and from
//              the SQL export column list
//   textCol    varchar downstream even when every value is digits — must export
//              quoted or a leading zero is lost on import
//   fk         { table, column } local referential target, used by the bulk
//              upload preview to explain a 23503 before it happens

import { DD_TABLES } from './schema.js'

// Sentinels. A discount cap needs one because the downstream column is NOT
// NULL, so "no cap" has to be spelled as a number — unlike max_txn_amount and
// budget_amount, which are nullable and use a real NULL.
export const UNLIMITED_AMOUNT = 99999999999.0
export const NO_MINIMUM = 1.0

// A band, not an equality test: the sentinel was 50000000000 before
// 20260820_dd_promo_money_scale_and_sentinel.sql and an export or a downstream
// copy taken before that may still carry the old value. Reading both as
// "Unlimited" costs nothing — no genuine amount in the data comes within two
// orders of magnitude, the largest being a 1,000,000 minimum transaction.
export const UNLIMITED_THRESHOLD = 49999999999

export const isUnlimited = (v) => v != null && Number(v) >= UNLIMITED_THRESHOLD

export const SOF_VALUES = ['PRIME', 'PAYLATER']
export const STATUS_VALUES = ['ACTIVE', 'INACTIVE']
export const DISCOUNT_TYPES = ['PERCENTAGE', 'FIXED']

// Columns the app fills in by itself, on every table. Never offered as an
// input, never exported as data.
export const STAMP_COLUMNS = ['created_by', 'created_at', 'updated_by', 'updated_at']

export const DD_COLUMNS = {
  bu_accounts: [
    { name: 'id', label: 'ID', type: 'uuid', auto: true },
    { name: 'name', label: 'BU Name', type: 'text', required: true },
    { name: 'sof', label: 'Source of Fund', type: 'enum', options: SOF_VALUES, required: true },
    // Bank account numbers: 20+ digits, stored as text. Excel renders a bare
    // one in scientific notation and MySQL would take it as a number, so both
    // export paths must treat it as a string.
    { name: 'account1', label: 'Account 1', type: 'text', required: true, textCol: true },
    { name: 'acctname1', label: 'Account Name 1', type: 'text', required: true },
    { name: 'percentage1', label: 'Percentage 1', type: 'number', required: true, decimals: 4 },
    { name: 'account2', label: 'Account 2', type: 'text', required: true, textCol: true },
    { name: 'acctname2', label: 'Account Name 2', type: 'text', required: true },
    { name: 'percentage2', label: 'Percentage 2', type: 'number', required: true, decimals: 4 },
    { name: 'created_at', label: 'Created At', type: 'timestamp', auto: true },
    { name: 'created_by', label: 'Created By', type: 'text', auto: true },
    { name: 'updated_at', label: 'Updated At', type: 'timestamp', auto: true },
    { name: 'updated_by', label: 'Updated By', type: 'text', auto: true },
  ],

  merchants: [
    // The primary key, not a surrogate. A whitelist row *is* its merchant id.
    { name: 'merchant_id', label: 'Merchant ID', type: 'text', required: true, textCol: true },
    { name: 'merchant_name', label: 'Merchant Name', type: 'text', required: true },
    {
      name: 'bu_name', label: 'BU Name', type: 'text', required: true,
      fk: { table: 'bu_accounts', column: 'name' },
    },
    // Not `required`: the column defaults to ACTIVE, so a spreadsheet that
    // omits it is complete rather than broken. Forms still pre-select a value.
    { name: 'status', label: 'Status', type: 'enum', options: STATUS_VALUES, default: 'ACTIVE' },
    { name: 'created_at', label: 'Created At', type: 'timestamp', auto: true },
    { name: 'created_by', label: 'Created By', type: 'text', auto: true },
    { name: 'updated_at', label: 'Updated At', type: 'timestamp', auto: true },
    { name: 'updated_by', label: 'Updated By', type: 'text', auto: true },
  ],

  promos: [
    // Not `auto`: promo_id is the primary key and is offered on create (with a
    // generator), then locked on edit. Phase 2's form handles that transition.
    { name: 'promo_id', label: 'Promo ID', type: 'text', required: true },
    { name: 'promo_name', label: 'Promo Name', type: 'text', required: true },
    {
      name: 'merchant_id', label: 'Merchant ID', type: 'text', nullable: true, textCol: true,
      // Blank means "all merchants"; a named one has to be whitelisted first.
      fk: { table: 'merchants', column: 'merchant_id' },
    },
    {
      name: 'bu_name', label: 'BU Name', type: 'text', required: true,
      fk: { table: 'bu_accounts', column: 'name' },
    },
    { name: 'start_date', label: 'Start Date', type: 'date', required: true },
    { name: 'end_date', label: 'End Date', type: 'date', required: true },
    // A channel with no type is not eligible, and its value and cap are then
    // genuinely absent rather than zero — 0 is a real discount, and neither a
    // reader nor the SQL exporter could tell the two apart. All three columns
    // are nullable together so the trio can only be wholly set or wholly unset.
    { name: 'prm_discount_type', label: 'PRIME Discount Type', type: 'enum', options: DISCOUNT_TYPES, nullable: true },
    { name: 'prm_discount_value', label: 'PRIME Discount Value', type: 'number', decimals: 2, nullable: true },
    { name: 'prm_max_discount', label: 'PRIME Max Discount', type: 'number', decimals: 2, nullable: true },
    { name: 'pl_discount_type', label: 'PAYLATER Discount Type', type: 'enum', options: DISCOUNT_TYPES, nullable: true },
    { name: 'pl_discount_value', label: 'PAYLATER Discount Value', type: 'number', decimals: 2, nullable: true },
    { name: 'pl_max_discount', label: 'PAYLATER Max Discount', type: 'number', decimals: 2, nullable: true },
    { name: 'min_txn_amount', label: 'Min Txn Amount', type: 'number', required: true, decimals: 2 },
    { name: 'max_txn_amount', label: 'Max Txn Amount', type: 'number', nullable: true, decimals: 2 },
    { name: 'budget_amount', label: 'Budget Amount', type: 'number', nullable: true, decimals: 2 },
    { name: 'priority', label: 'Priority', type: 'integer', required: true },
    { name: 'status', label: 'Status', type: 'enum', options: STATUS_VALUES, required: true },
    { name: 'created_at', label: 'Created At', type: 'timestamp', auto: true },
    { name: 'created_by', label: 'Created By', type: 'text', auto: true },
    { name: 'updated_at', label: 'Updated At', type: 'timestamp', auto: true },
    { name: 'updated_by', label: 'Updated By', type: 'text', auto: true },
  ],
}

// Primary key of the *local* table, which is not the downstream key. Updates
// and deletes issued by the app address a row by this; exported SQL addresses
// it by DD_TABLES[id].keyColumns instead, because downstream has no surrogate.
// Only bu_accounts still carries a surrogate: a business unit is `name` AND
// `sof` downstream, which PostgREST cannot address as a single key, so the uuid
// earns its place there. The other two are keyed on the column that identifies
// the record everywhere else in the module.
export const PRIMARY_KEY = {
  bu_accounts: 'id',
  merchants: 'merchant_id',
  promos: 'promo_id',
}

export const primaryKey = (tableId) => PRIMARY_KEY[tableId] ?? 'id'

export function columns(tableId) {
  return DD_COLUMNS[tableId] ?? []
}

export function column(tableId, name) {
  return columns(tableId).find(c => c.name === name) ?? null
}

/** Columns a person may type into — everything the app does not fill itself. */
export function editableColumns(tableId) {
  return columns(tableId).filter(c => !c.auto)
}

/** Column names carrying data downstream, in declaration order. */
export function exportColumns(tableId) {
  return columns(tableId).filter(c => !c.auto).map(c => c.name)
}

/** Free-text search targets: text and enum columns only. */
export function searchableColumns(tableId) {
  return columns(tableId)
    .filter(c => !c.auto && (c.type === 'text' || c.type === 'enum'))
    .map(c => c.name)
}

export const isTextColumn = (tableId, name) => !!column(tableId, name)?.textCol

/**
 * Coerces a form or spreadsheet value to what the column's Postgres type will
 * accept. A blank on a nullable column becomes null rather than '' — Postgres
 * rejects '' for numeric and date, and '' is not the same fact as "not set".
 */
export function coerce(tableId, name, value) {
  const col = column(tableId, name)
  if (!col) return value
  const s = typeof value === 'string' ? value.trim() : value
  if (s === '' || s == null) return col.nullable ? null : (col.type === 'text' || col.type === 'enum' ? '' : null)
  switch (col.type) {
    case 'number': {
      const n = Number(String(s).replace(/,/g, ''))
      return Number.isNaN(n) ? null : n
    }
    case 'integer': {
      const n = parseInt(String(s).replace(/,/g, ''), 10)
      return Number.isNaN(n) ? null : n
    }
    case 'date':
      // Postgres `date` wants YYYY-MM-DD; an ISO timestamp would be truncated
      // silently in one direction and rejected in another.
      return String(s).slice(0, 10)
    default:
      return String(s)
  }
}

/** Every column of every table, keyed by table id — for the Table Explorer. */
export function allColumns() {
  return Object.fromEntries(Object.keys(DD_TABLES).map(id => [id, columns(id)]))
}
