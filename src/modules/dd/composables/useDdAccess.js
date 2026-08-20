import { computed } from 'vue'
import { useAccess } from '@/composables/useAccess.js'
import { useAuth } from '@/composables/useAuth.js'
import { DD_TABLES, byTargetTable, targetDbs } from '../lib/schema.js'

// DD's access model has two independent axes, both granted per action:
//
//   menu      bu-accounts, merchants, promos, export, audit, tables, sql, email
//   database  ihybrid_order, ihybrid_discount
//
// SP-lite's computeAccess resolves one flat feature list per module, so both
// axes live under the `dd` module as feature ids and the OR between them is
// applied here rather than in src/lib/access.js — which is a verbatim port of
// SO-Platform's and shared by every other module.
//
// Argument order convention: every public scope predicate below (canMenu,
// canDatabase, canTable) is scope-first with `action` defaulting to 'read' —
// e.g. canDatabase('ihybrid_order') reads, canDatabase('ihybrid_order',
// 'update') checks write. Only the private `can(action, scope)` is action-first.

// Menu -> DD route name, in DD's own precedence order for "first screen this
// person may open" (src/stores/access.js firstAllowedRoute). The dashboard
// itself is checked separately in firstAllowedDdRoute since it is not a
// grantable scope (see canDashboard below).
const MENU_ROUTES = [
  ['promos',      'dd-promos'],
  ['merchants',   'dd-merchants'],
  ['bu-accounts', 'dd-business-units'],
  ['export',      'dd-export'],
  ['audit',       'dd-audit'],
  ['sql',         'dd-sql'],
]

export function useDdAccess() {
  const { canFeature, canModule } = useAccess()
  const { userFeatures } = useAuth()

  const can = (action, scope) => canFeature('dd', `${scope}.${action}`)

  const canMenu = (menu, action = 'read') => can(action, menu)

  const canDatabase = (db, action = 'read') => can(action, `db.${db}`)

  // The dashboard is not a grantable scope: it follows module access, so /dd
  // always has a valid landing screen. Its contents are still filtered per
  // table by canTable(), so someone with one database scope sees only that.
  const canDashboard = () => canModule('dd')

  // Accepts either the internal id (bu_accounts) or the downstream table name
  // (discount_bu_accounts) — the route and sidebar carry the latter.
  const resolveTable = (idOrName) => DD_TABLES[idOrName] ?? byTargetTable(idOrName)

  // DD's rule verbatim: "A sheet is reachable through its menu or through its
  // database." Granting ihybrid_order alone therefore opens
  // discount_bu_accounts as a raw table without opening ihybrid_discount.
  const canTable = (idOrName, action = 'read') => {
    const t = resolveTable(idOrName)
    if (!t) return false
    return can(action, t.menu) || canDatabase(t.targetDb, action)
  }

  const visibleDatabases = computed(() =>
    targetDbs().filter(db => canDatabase(db, 'read')),
  )

  // Any feature id ending in a write verb, on either axis. Derived from the
  // granted list rather than by enumerating scopes, so a scope using a new
  // verb (sql.write does) cannot silently fall outside the check.
  const isReadOnly = computed(() =>
    !(userFeatures.value?.dd ?? []).some(f => /\.(create|update|delete|write)$/.test(f)),
  )

  const firstAllowedDdRoute = computed(() => {
    if (canDashboard()) return { name: 'dd' }
    const hit = MENU_ROUTES.find(([menu]) => canMenu(menu))
    return hit ? { name: hit[1] } : null
  })

  return {
    can, canMenu, canDatabase, canDashboard, canTable,
    visibleDatabases, isReadOnly, firstAllowedDdRoute,
    canModule,
  }
}
