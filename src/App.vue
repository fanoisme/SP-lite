<template>
  <LiToast />

  <!-- Landing/login render full-bleed, without the app shell -->
  <router-view v-if="isBareRoute" />

  <div v-else class="sp-app" :class="{ 'sp-app--sidebar-open': sidebarOpen }">
    <!-- Ambient mesh background -->
    <div class="sp-mesh-bg">
      <div class="mesh-orb mesh-orb--1"></div>
      <div class="mesh-orb mesh-orb--2"></div>
      <div class="mesh-orb mesh-orb--3"></div>
    </div>

    <!-- Mobile overlay -->
    <Transition name="fade">
      <div v-if="sidebarOpen" class="sp-overlay" @click="sidebarOpen = false" />
    </Transition>

    <!-- Sidebar -->
    <aside class="sp-sidebar" :class="{ 'sp-sidebar--open': sidebarOpen }">
      <div class="sp-sidebar__header">
        <LiLogo size="sm" :animate="true" :show-subtitle="true" />
        <button class="sp-sidebar__close" @click="sidebarOpen = false">
          <span class="material-symbols-outlined">close</span>
        </button>
      </div>

      <nav class="sp-sidebar__nav">
        <div class="sp-sidebar__section-label">Tools</div>
        <router-link
          v-for="mod in modules"
          :key="mod.path"
          :to="mod.path"
          class="sp-sidebar__item"
          :class="{ 'sp-sidebar__item--active': isActive(mod.path) }"
          @click="sidebarOpen = false"
        >
          <span class="sp-sidebar__item-indicator"></span>
          <span class="material-symbols-outlined sp-sidebar__item-icon">{{ mod.icon }}</span>
          <span class="sp-sidebar__item-label">{{ mod.label }}</span>
        </router-link>

        <template v-if="isAdmin">
          <div class="sp-sidebar__section-label">Admin</div>
          <router-link
            to="/admin"
            class="sp-sidebar__item"
            :class="{ 'sp-sidebar__item--active': isActive('/admin') }"
            @click="sidebarOpen = false"
          >
            <span class="sp-sidebar__item-indicator"></span>
            <span class="material-symbols-outlined sp-sidebar__item-icon">admin_panel_settings</span>
            <span class="sp-sidebar__item-label">Admin</span>
          </router-link>
        </template>
      </nav>

      <div class="sp-sidebar__footer">
        <div class="sp-sidebar__user">
          <span class="material-symbols-outlined">account_circle</span>
          <span class="sp-sidebar__user-name">{{ profile?.username || session?.user?.email }}</span>
        </div>
        <button class="sp-sidebar__source sp-sidebar__logout" @click="handleLogout">
          <span class="material-symbols-outlined">logout</span>
          <span>Sign out</span>
        </button>
        <a href="https://github.com/fanoisme/SP-lite" target="_blank" rel="noopener" class="sp-sidebar__source">
          <span class="material-symbols-outlined">code</span>
          <span>Source on GitHub</span>
        </a>
      </div>
    </aside>

    <!-- Module content -->
    <main class="sp-main">
      <!-- Mobile header -->
      <div class="sp-mobile-header">
        <button class="sp-hamburger" @click="sidebarOpen = true">
          <span class="material-symbols-outlined">menu</span>
        </button>
        <span class="sp-mobile-title">{{ currentModule?.label || 'SP-lite' }}</span>
      </div>

      <router-view v-slot="{ Component, route: r }">
        <Transition name="page" mode="out-in">
          <component :is="Component" :key="r.path" />
        </Transition>
      </router-view>
    </main>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import router from './router/index.js'
import { useAuth } from './composables/useAuth.js'
import LiToast from './lib/components/LiToast.vue'
import LiLogo from './lib/components/LiLogo.vue'

const route = useRoute()
const routerInstance = useRouter()
const { session, profile, isAdmin, signOut } = useAuth()

const isBareRoute = computed(() => route.name === 'landing' || route.name === 'login')

const modules = router.options.routes
  .filter(r => r.meta?.module)
  .map(r => ({ path: r.path, label: r.meta.label, icon: r.meta.icon }))

const sidebarOpen = ref(false)

const currentModule = computed(() =>
  modules.find(m => route.path.startsWith(m.path)) ||
  (route.path.startsWith('/admin') ? { label: 'Admin' } : undefined),
)

function isActive(path) {
  return route.path.startsWith(path)
}

async function handleLogout() {
  await signOut()
  routerInstance.push({ name: 'landing' })
}

watch(() => route.path, () => {
  sidebarOpen.value = false
})
</script>

<style scoped>
.sp-app {
  position: relative;
  min-height: 100vh;
  display: flex;
}

/* ── Mesh Background ── */
.sp-mesh-bg {
  position: fixed;
  inset: 0;
  overflow: hidden;
  z-index: 0;
  pointer-events: none;
}

.mesh-orb {
  position: absolute;
  border-radius: 50%;
  filter: blur(40px);
  opacity: 0.25;
  animation: mesh-drift 25s ease-in-out infinite alternate;
  contain: layout style;
}

.mesh-orb--1 {
  width: 600px;
  height: 600px;
  background: radial-gradient(circle, var(--color-yellow-100, #FFF3D6), transparent 70%);
  top: -15%;
  right: -10%;
  animation-duration: 22s;
}

.mesh-orb--2 {
  width: 450px;
  height: 450px;
  background: radial-gradient(circle, var(--color-blue-100, #E6E6FF), transparent 70%);
  bottom: -15%;
  left: 15%;
  animation-duration: 28s;
  animation-delay: -5s;
}

.mesh-orb--3 {
  width: 350px;
  height: 350px;
  background: radial-gradient(circle, var(--color-yellow-100, #FFF3D6), transparent 70%);
  top: 40%;
  left: 40%;
  opacity: 0.15;
  animation-duration: 32s;
  animation-delay: -10s;
}

@keyframes mesh-drift {
  0% { transform: translate(0, 0) scale(1); }
  33% { transform: translate(30px, -20px) scale(1.05); }
  66% { transform: translate(-20px, 15px) scale(0.95); }
  100% { transform: translate(10px, -10px) scale(1.02); }
}

/* ── Overlay ── */
.sp-overlay {
  display: none;
}

/* ── Sidebar ── */
.sp-sidebar {
  position: fixed;
  top: 0;
  left: 0;
  bottom: 0;
  width: 250px;
  z-index: var(--z-sticky, 30);
  display: flex;
  flex-direction: column;
  background: rgba(255, 255, 255, 0.92);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-right: 1px solid rgba(0, 0, 0, 0.06);
  box-shadow: 1px 0 4px rgba(0, 0, 0, 0.03);
  transition: transform 0.35s cubic-bezier(0.16, 1, 0.3, 1);
}

.sp-sidebar__header {
  padding: 20px 16px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.04);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.sp-sidebar__close {
  display: none;
  background: none;
  border: none;
  cursor: pointer;
  padding: 6px;
  border-radius: 8px;
  color: #888;
  transition: all 0.2s ease;
}

.sp-sidebar__close:hover {
  background: rgba(0, 0, 0, 0.05);
  color: #333;
}

.sp-sidebar__nav {
  flex: 1;
  padding: 12px 10px;
  overflow-y: auto;
}

.sp-sidebar__section-label {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: #b0b0c0;
  padding: 8px 12px 8px;
}

.sp-sidebar__item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 12px;
  font-size: 13px;
  font-weight: 500;
  color: #6b6b80;
  text-decoration: none;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  cursor: pointer;
  margin-bottom: 2px;
  position: relative;
}

.sp-sidebar__item-indicator {
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 3px;
  height: 0;
  background: var(--cta-primary-bg, #FFBC25);
  border-radius: 0 3px 3px 0;
  transition: height 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.sp-sidebar__item:hover {
  color: var(--color-gray-900, #1a1a2e);
  background: rgba(0, 0, 0, 0.03);
}

.sp-sidebar__item--active {
  color: var(--color-gray-900, #1a1a2e);
  background: rgba(255, 188, 37, 0.1);
  font-weight: 600;
}

.sp-sidebar__item--active .sp-sidebar__item-indicator {
  height: 20px;
}

.sp-sidebar__item--active .sp-sidebar__item-icon {
  color: var(--cta-primary-bg, #FFBC25);
}

.sp-sidebar__item-icon {
  font-size: 20px;
  flex-shrink: 0;
  transition: color 0.25s ease;
}

.sp-sidebar__footer {
  padding: 12px 14px;
  border-top: 1px solid rgba(0, 0, 0, 0.04);
}

.sp-sidebar__user {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  font-size: 12px;
  font-weight: 600;
  color: var(--color-gray-900, #1a1a2e);
}

.sp-sidebar__user .material-symbols-outlined {
  font-size: 20px;
  color: var(--cta-primary-bg, #FFBC25);
}

.sp-sidebar__user-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sp-sidebar__logout {
  background: none;
  border: none;
  cursor: pointer;
  width: 100%;
  text-align: left;
  font-family: inherit;
}

.sp-sidebar__source {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  font-weight: 500;
  color: #8e8ea0;
  text-decoration: none;
  padding: 8px 10px;
  border-radius: 10px;
  transition: background 0.2s ease;
}

.sp-sidebar__source:hover {
  background: rgba(0, 0, 0, 0.03);
  color: var(--color-gray-900, #1a1a2e);
}

.sp-sidebar__source .material-symbols-outlined {
  font-size: 16px;
}

/* ── Mobile Header ── */
.sp-mobile-header {
  display: none;
}

/* ── Page Transition ── */
.page-enter-active { transition: all 0.35s cubic-bezier(0.16, 1, 0.3, 1); }
.page-leave-active { transition: all 0.15s ease-in; }
.page-enter-from { opacity: 0; transform: translateY(10px); }
.page-leave-to { opacity: 0; transform: translateY(-4px); }

.fade-enter-active { transition: opacity 0.25s ease; }
.fade-leave-active { transition: opacity 0.2s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

/* ── Main Content ── */
.sp-main {
  position: relative;
  z-index: var(--z-content, 10);
  flex: 1;
  margin-left: 250px;
  padding: 24px;
  min-height: 100vh;
}

/* ── Responsive ── */
@media (max-width: 900px) {
  .sp-sidebar { transform: translateX(-100%); }
  .sp-sidebar--open { transform: translateX(0); }
  .sp-sidebar__close { display: flex; }

  .sp-overlay {
    display: block;
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.3);
    backdrop-filter: blur(2px);
    -webkit-backdrop-filter: blur(2px);
    z-index: 25;
  }

  .sp-main {
    margin-left: 0;
    padding: 16px;
    padding-top: 72px;
  }

  .sp-mobile-header {
    display: flex;
    align-items: center;
    gap: 12px;
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    height: 56px;
    padding: 0 16px;
    background: rgba(255, 255, 255, 0.92);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    border-bottom: 1px solid rgba(0, 0, 0, 0.04);
    z-index: 20;
  }

  .sp-hamburger {
    background: none;
    border: none;
    cursor: pointer;
    padding: 8px;
    border-radius: 10px;
    color: var(--color-gray-700, #333);
    transition: background 0.2s ease;
  }

  .sp-hamburger:hover { background: rgba(0, 0, 0, 0.04); }
  .sp-hamburger .material-symbols-outlined { font-size: 24px; }

  .sp-mobile-title {
    font-size: 16px;
    font-weight: 700;
    color: var(--color-gray-900, #1a1a2e);
  }
}

@media (prefers-reduced-motion: reduce) {
  .mesh-orb { animation: none; }
  .page-enter-active, .page-leave-active { transition-duration: 0ms; }
}
</style>
