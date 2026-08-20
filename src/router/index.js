import { createRouter, createWebHashHistory } from 'vue-router'
import { useAuth } from '../composables/useAuth.js'
import { useAccess } from '../composables/useAccess.js'
import { useDdAccess } from '../modules/dd/composables/useDdAccess.js'
import { byTargetTable } from '../modules/dd/lib/schema.js'

// SP-lite — hash history so GitHub Pages (no server-side rewrites) can
// serve deep links correctly.
const PUBLIC_ROUTES = ['landing', 'login']

const routes = [
  {
    path: '/',
    name: 'landing',
    component: () => import('../modules/landing/views/LandingView.vue'),
  },
  {
    path: '/login',
    name: 'login',
    component: () => import('../modules/auth/views/LoginView.vue'),
  },
  {
    path: '/dashboard',
    name: 'dashboard',
    meta: { module: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
    component: () => import('../modules/dashboard/views/DashboardView.vue'),
  },
  {
    path: '/qris',
    name: 'qris',
    meta: { module: 'qris', label: 'QRIS Tools', icon: 'qr_code_2' },
    component: () => import('../modules/qris/views/QrisView.vue'),
  },
  {
    path: '/template-tools',
    name: 'template-tools',
    meta: { module: 'template-tools', label: 'Template Tools', icon: 'auto_awesome' },
    component: () => import('../modules/template-tools/views/TemplateToolsView.vue'),
  },
  {
    path: '/video-frames',
    name: 'video-frames',
    meta: { module: 'video-frames', label: 'Video Frames', icon: 'movie' },
    component: () => import('../modules/video-frames/views/VideoFramesView.vue'),
  },
  {
    path: '/dd',
    meta: { module: 'dd', label: 'DD MPM', icon: 'inventory' },
    component: () => import('../modules/dd/views/DdLayout.vue'),
    children: [
      // `name: 'dd'` must stay on the index child: SP-lite's sidebar and
      // firstAccessibleRoute() resolve a module to { name: moduleId }.
      // No ddMenu gate on the index child: the dashboard follows module access,
      // so /dd always has a valid landing screen. `dashboard.read` is not a
      // seeded feature — gating on it would refuse everyone, Admin included.
      { path: '',               name: 'dd',                                                   component: () => import('../modules/dd/views/DdDashboard.vue') },
      { path: 'business-units', name: 'dd-business-units', meta: { ddMenu: 'bu-accounts' },   component: () => import('../modules/dd/views/DdBuAccounts.vue') },
      { path: 'merchants',      name: 'dd-merchants',      meta: { ddMenu: 'merchants' },     component: () => import('../modules/dd/views/DdMerchants.vue') },
      { path: 'promos',         name: 'dd-promos',         meta: { ddMenu: 'promos' },        component: () => import('../modules/dd/views/DdPromos.vue') },
      { path: 'table/:name',    name: 'dd-table',          meta: { ddTableParam: 'name' },    component: () => import('../modules/dd/views/DdTableExplorer.vue') },
      { path: 'export',         name: 'dd-export',         meta: { ddMenu: 'export' },        component: () => import('../modules/dd/views/DdExport.vue') },
      { path: 'audit',          name: 'dd-audit',          meta: { ddMenu: 'audit' },         component: () => import('../modules/dd/views/DdAudit.vue') },
      { path: 'sql',            name: 'dd-sql',            meta: { ddMenu: 'sql' },           component: () => import('../modules/dd/views/DdSqlEditor.vue') },
      { path: 'email',          name: 'dd-email',          meta: { ddMenu: 'email' },         component: () => import('../modules/dd/views/DdEmail.vue') },
    ],
  },
  {
    path: '/admin',
    name: 'admin',
    meta: { module: 'admin', requiresAdmin: true, label: 'Admin', icon: 'admin_panel_settings' },
    component: () => import('../modules/admin/views/AdminView.vue'),
  },
  {
    path: '/profile',
    name: 'profile',
    meta: { label: 'Profile', icon: 'account_circle' },
    component: () => import('../modules/profile/views/ProfileView.vue'),
  },
]

const router = createRouter({
  history: createWebHashHistory(),
  routes,
})

// First route a signed-in user lands on when they have no specific destination
// (post-login, or visiting a public route while authed). Dashboard if they have
// it, else the first granted module, else /profile.
export function firstAccessibleRoute() {
  const { userModules } = useAuth()
  if (userModules.value.includes('dashboard')) return { name: 'dashboard' }
  const mod = userModules.value.find(m => m !== 'admin') || userModules.value[0]
  return mod ? { name: mod } : { name: 'profile' }
}

router.beforeEach(async (to) => {
  const { ensureAuthLoaded, isAuthenticated, isAdmin, profile, signOut } = useAuth()
  const { canModule } = useAccess()
  await ensureAuthLoaded()

  const isPublic = PUBLIC_ROUTES.includes(to.name)

  if (isAuthenticated.value && isPublic) {
    return firstAccessibleRoute()
  }

  if (!isAuthenticated.value && !isPublic) {
    return { name: 'login' }
  }

  // Defense against inactive sessions (e.g. admin deactivated a logged-in
  // user, or a stale session from before activation). Login itself blocks
  // inactive accounts at signInWithPassword; this covers the in-session case.
  if (isAuthenticated.value && profile.value && !profile.value.is_active) {
    await signOut()
    return { name: 'login' }
  }

  // Module-level gate: role must grant the module (covers /admin too — only
  // the Admin role is seeded with the admin module). requiresAdmin is kept as
  // a belt-and-suspenders check.
  if (to.meta.requiresAdmin && !isAdmin.value) {
    return firstAccessibleRoute()
  }
  if (to.meta.module && !canModule(to.meta.module)) {
    return firstAccessibleRoute()
  }

  // DD's second access axis. A guided screen is gated by its menu; a raw table
  // is gated by the database that owns it. Mirrors the DD app's own guard,
  // which special-cases the table route for exactly this reason.
  if (to.matched.some(r => r.meta.module === 'dd')) {
    const { canMenu, canDatabase, firstAllowedDdRoute } = useDdAccess()

    if (to.meta.ddMenu && !canMenu(to.meta.ddMenu)) {
      return firstAllowedDdRoute.value ?? firstAccessibleRoute()
    }

    if (to.meta.ddTableParam) {
      const t = byTargetTable(String(to.params[to.meta.ddTableParam] || ''))
      if (!t || !canDatabase(t.targetDb)) {
        return firstAllowedDdRoute.value ?? firstAccessibleRoute()
      }
    }
  }

  return true
})

export default router
