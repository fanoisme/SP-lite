import { createRouter, createWebHashHistory } from 'vue-router'
import { useAuth } from '../composables/useAuth.js'
import { useAccess } from '../composables/useAccess.js'

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
// (post-login, or visiting a public route while authed). Picks the first module
// their role grants, falling back to /profile.
export function firstAccessibleRoute() {
  const { userModules } = useAuth()
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

  return true
})

export default router
