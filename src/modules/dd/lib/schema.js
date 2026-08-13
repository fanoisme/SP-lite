// DD module — mapping between SP-lite's local storage and the downstream
// MySQL databases the exports target.
//
// The three tables keep their qrdd_* storage names from the module this
// replaces; only the module, its routes and its new database objects use `dd`.
//
// Phase 1 reads `label`, `local`, `targetDb` and `keyColumns`. Everything else
// is declared for Phase 4 (Export Center / SQL export) so the exporter and the
// UI can never disagree about a table name or a key.

export const DD_TABLES = {
  bu_accounts: {
    id: 'bu_accounts',
    label: 'BU Accounts',
    local: 'qrdd_bu_accounts',
    targetDb: 'ihybrid_order',
    targetTable: 'discount_bu_accounts',
    // Downstream has no surrogate id, so UPDATE/DELETE match on name AND sof.
    keyColumns: ['name', 'sof'],
    // Local column -> downstream column. This table is the odd one out.
    timestamps: { created_at: 'created_datetime', updated_at: 'last_modified' },
    textColumns: [],
    // Menu scope name for the access axis. Spelled with hyphens to match the
    // seeded feature ids (`bu-accounts.read`), which differ from this object's
    // underscored key — so it cannot be derived and is stated instead.
    menu: 'bu-accounts',
  },
  merchants: {
    id: 'merchants',
    label: 'Merchants',
    local: 'qrdd_merchant_whitelist',
    targetDb: 'ihybrid_discount',
    targetTable: 'merchant_whitelist',
    keyColumns: ['merchant_id'],
    timestamps: { created_at: 'created_time', updated_at: 'updated_time' },
    // merchant_id is varchar downstream — always export it quoted, never as a
    // bare number, or a leading zero is lost and the import mismatches.
    textColumns: ['merchant_id'],
    menu: 'merchants',
  },
  promos: {
    id: 'promos',
    label: 'Promo Rules',
    local: 'qrdd_promo_rules',
    targetDb: 'ihybrid_discount',
    // The sheet was promo_rule; the table downstream is promo_info.
    targetTable: 'promo_info',
    keyColumns: ['promo_id'],
    timestamps: { created_at: 'created_time', updated_at: 'updated_time' },
    textColumns: ['merchant_id'],
    menu: 'promos',
  },
}

// Apply order for a full export. Each database is closed by one cache-reset
// statement against app_instances, emitted once however many rows moved.
export const EXPORT_ORDER = ['bu_accounts', 'merchants', 'promos']
export const CACHE_RESET_TABLE = 'app_instances'
export const CACHE_RESET_COLUMN = 'static_data_refresh_time'

export const TABLE_IDS = Object.keys(DD_TABLES)

export function byLocal(localName) {
  return Object.values(DD_TABLES).find(t => t.local === localName)
}

export function byTargetTable(name) {
  return Object.values(DD_TABLES).find(t => t.targetTable === name)
}

export function targetDbs() {
  return [...new Set(Object.values(DD_TABLES).map(t => t.targetDb))]
}

export function tableLabel(id) {
  return DD_TABLES[id]?.label ?? id
}
