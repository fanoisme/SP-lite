import { createRouter, createWebHashHistory } from 'vue-router'

// SP-lite — public, static, no auth. Hash history so GitHub Pages
// (no server-side rewrites) can serve deep links correctly.
const routes = [
  {
    path: '/',
    redirect: '/qris',
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
]

const router = createRouter({
  history: createWebHashHistory(),
  routes,
})

export default router
