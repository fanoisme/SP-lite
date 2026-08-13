import { computed } from 'vue'
import { useAccess } from '@/composables/useAccess.js'
import { DD_TABLES, targetDbs } from '../lib/schema.js'

// DD's access model has two independent axes, both granted per action:
//
//   menu      dashboard, bu-accounts, merchants, promos, export, audit, sql, email
//   database  ihybrid_order, ihybrid_discount
//
// SP-lite's computeAccess resolves one flat feature list per module, so both
// axes live under the `dd` module as feature ids and the OR between them is
// applied here rather than in src/lib/access.js — which is a verbatim port of
// SO-Platform's and shared by every other module.

export const DD_MENUS = [
  'dashboard', 'bu-accounts', 'merchants', 'promos',
  'export', 'audit', 'sql', 'email',
]

const WRITE_ACTIONS = ['create', 'update', 'delete']

// Menu -> DD route name, in DD's own precedence order for "first screen this
// person may open" (src/stores/access.js firstAllowedRoute).
const MENU_ROUTES = [
  ['dashboard',   'dd'],
  ['promos',      'dd-promos'],
  ['merchants',   'dd-merchants'],
  ['bu-accounts', 'dd-business-units'],
  ['export',      'dd-export'],
  ['audit',       'dd-audit'],
  ['sql',         'dd-sql'],
]

export function useDdAccess() {
  const { canFeature, canModule } = useAccess()

  const can = (action, scope) => canFeature('dd', `${scope}.${action}`)

  const canMenu = (menu, action = 'read') => can(action, menu)

  const canDatabase = (action, db) => can(action, `db.${db}`)

  // DD's rule verbatim: "A sheet is reachable through its menu or through its
  // database." Granting ihybrid_order alone therefore opens
  // discount_bu_accounts as a raw table without opening ihybrid_discount.
  const canTable = (action, tableId) => {
    const t = DD_TABLES[tableId]
    if (!t) return false
    return can(action, t.menu) || canDatabase(action, t.targetDb)
  }

  const visibleDatabases = computed(() =>
    targetDbs().filter(db => canDatabase('read', db)),
  )

  // No write scope on either axis. DD uses this to render whole screens
  // read-only rather than offering buttons that would fail.
  const isReadOnly = computed(() =>
    !WRITE_ACTIONS.some(action =>
      DD_MENUS.some(m => can(action, m)) ||
      targetDbs().some(db => canDatabase(action, db)),
    ),
  )

  const firstAllowedDdRoute = computed(() => {
    const hit = MENU_ROUTES.find(([menu]) => canMenu(menu))
    return hit ? { name: hit[1] } : null
  })

  return {
    can, canMenu, canDatabase, canTable,
    visibleDatabases, isReadOnly, firstAllowedDdRoute,
    canModule,
  }
}
