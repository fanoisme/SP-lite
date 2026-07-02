import { createRouter, createWebHashHistory } from 'vue-router'
import { useAuth } from '../composables/useAuth.js'

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
    meta: { requiresAdmin: true, label: 'Admin', icon: 'admin_panel_settings' },
    component: () => import('../modules/admin/views/AdminView.vue'),
  },
]

const router = createRouter({
  history: createWebHashHistory(),
  routes,
})

router.beforeEach(async (to) => {
  const { ensureAuthLoaded, isAuthenticated, isAdmin } = useAuth()
  await ensureAuthLoaded()

  const isPublic = PUBLIC_ROUTES.includes(to.name)

  if (isAuthenticated.value && isPublic) {
    return { name: 'qris' }
  }

  if (!isAuthenticated.value && !isPublic) {
    return { name: 'login' }
  }

  if (to.meta.requiresAdmin && !isAdmin.value) {
    return { name: 'qris' }
  }

  return true
})

export default router
