<template>
  <LiToast />
  <LiCommandPalette v-model="paletteOpen" :commands="commands" @execute="runCommand" />

  <!-- Login renders full-bleed, without the app shell -->
  <router-view v-if="isBareRoute" />

  <div v-else class="app">
    <!-- Topbar (app.css .topbar): mobile menu, logo, products + ink, search, theme, avatar -->
    <header class="topbar">
      <button class="icon-btn mobile-menu" aria-label="Open navigation menu" @click="menuOpen = true">
        <LiIcon name="menu" size="sm" />
      </button>

      <router-link to="/dashboard" class="topbar__logo" aria-label="SP-lite home">
        <LiLogo size="xs" :show-subtitle="false" />
        <span>Workspace</span>
      </router-link>

      <!-- Products: horizontal module links with a sliding accent ink -->
      <nav ref="productsNav" class="products" aria-label="Modules">
        <router-link
          v-for="mod in modules"
          :key="mod.path"
          :to="mod.path"
          class="products__link"
          :aria-current="isActive(mod.path) ? 'page' : undefined"
        >
          <LiIcon :name="mod.icon" size="sm" />
          <span>{{ mod.label }}</span>
        </router-link>
        <span class="products__ink" :style="inkStyle" />
      </nav>

      <div class="topbar__end">
        <button class="search-trigger" aria-label="Search (Ctrl K)" @click="paletteOpen = true">
          <LiIcon name="search" size="sm" />
          <span class="search-trigger__grow">Search…</span>
          <kbd>Ctrl</kbd><kbd>K</kbd>
        </button>
        <button
          class="icon-btn"
          :aria-label="theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'"
          @click="toggleTheme"
        >
          <LiIcon :name="themeIcon" size="sm" />
        </button>
        <LiDropdown align="right">
          <template #trigger>
            <button class="topbar__avatar" aria-label="Account menu">{{ initials }}</button>
          </template>
          <div class="pop__lbl">{{ profile?.full_name || profile?.username || session?.user?.email }}</div>
          <router-link to="/profile" class="pop__item" role="menuitem">
            <LiIcon name="circle-user" size="sm" /><span>Profile</span>
          </router-link>
          <div class="pop__sep" />
          <button class="pop__item pop__item--danger" role="menuitem" @click="handleLogout">
            <LiIcon name="log-out" size="sm" /><span>Sign out</span>
          </button>
        </LiDropdown>
      </div>
    </header>

    <!-- Layout: persistent sidebar + fluid main (app.css .layout/.sidebar) -->
    <div class="layout">
      <aside v-if="!isMobile" class="sidebar" :class="{ 'sidebar--collapsed': sidebarCollapsed }" aria-label="Workspace">
        <div class="sidebar__project">
          <span class="sidebar__mark"><LiMascot :size="22" :animated="false" /></span>
          <div class="sidebar__label">
            <b>SP-lite</b>
            <div class="sidebar__cap">{{ currentModule?.label || 'Workspace' }}</div>
          </div>
        </div>

        <nav class="sidebar__nav" aria-label="Modules">
          <router-link
            v-for="mod in modules"
            :key="mod.path"
            :to="mod.path"
            class="sidebar__item"
            :aria-current="isActive(mod.path) ? 'page' : undefined"
            :title="mod.label"
          >
            <LiIcon :name="mod.icon" size="sm" />
            <span class="sidebar__label sidebar__label--grow">{{ mod.label }}</span>
          </router-link>

          <template v-if="isAdmin">
            <p class="sidebar__section">Admin</p>
            <router-link to="/admin" class="sidebar__item" :aria-current="isActive('/admin') ? 'page' : undefined" title="Admin">
              <LiIcon name="shield" size="sm" />
              <span class="sidebar__label sidebar__label--grow">Admin</span>
            </router-link>
          </template>
        </nav>

        <div class="sidebar__foot">
          <router-link to="/profile" class="sidebar__settings" :aria-current="isActive('/profile') ? 'page' : undefined">
            <LiIcon name="circle-user" size="sm" />
            <span class="sidebar__label">Profile</span>
          </router-link>
          <button class="icon-btn" :aria-label="sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'" :aria-pressed="sidebarCollapsed" @click="toggleSidebar">
            <LiIcon :name="sidebarCollapsed ? 'chevron-right' : 'chevron-left'" size="sm" />
          </button>
        </div>
      </aside>

      <main class="main">
        <router-view v-slot="{ Component, route: r }">
          <Transition name="page" mode="out-in">
            <component :is="Component" :key="r.path" />
          </Transition>
        </router-view>
      </main>
    </div>

    <!-- Mobile menu sheet (< 900) -->
    <LiBottomSheet v-model="menuOpen" title="SP-lite">
      <nav class="sheet-nav" aria-label="Modules">
        <router-link
          v-for="mod in modules"
          :key="mod.path"
          :to="mod.path"
          class="sheet-nav__item"
          :class="{ 'is-current': isActive(mod.path) }"
          @click="menuOpen = false"
        >
          <LiIcon :name="mod.icon" size="sm" />
          <span>{{ mod.label }}</span>
        </router-link>
        <router-link v-if="isAdmin" to="/admin" class="sheet-nav__item" :class="{ 'is-current': isActive('/admin') }" @click="menuOpen = false">
          <LiIcon name="shield" size="sm" />
          <span>Admin</span>
        </router-link>
        <router-link to="/profile" class="sheet-nav__item" :class="{ 'is-current': isActive('/profile') }" @click="menuOpen = false">
          <LiIcon name="circle-user" size="sm" />
          <span>Profile</span>
        </router-link>
        <button class="sheet-nav__item sheet-nav__item--danger" @click="handleLogout">
          <LiIcon name="log-out" size="sm" />
          <span>Sign out</span>
        </button>
      </nav>
    </LiBottomSheet>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import router from './router/index.js'
import { useAuth } from './composables/useAuth.js'
import { useAccess } from './composables/useAccess.js'
import { useTheme } from './composables/useTheme.js'
import { useToast } from './lib/composables/useToast.js'
import LiToast from './lib/components/LiToast.vue'
import LiLogo from './lib/components/LiLogo.vue'
import LiMascot from './lib/components/LiMascot.vue'
import LiIcon from './lib/components/LiIcon.vue'
import LiDropdown from './lib/components/LiDropdown.vue'
import LiBottomSheet from './lib/components/LiBottomSheet.vue'
import LiCommandPalette from './lib/components/LiCommandPalette.vue'

const route = useRoute()
const routerInstance = useRouter()
const { session, profile, isAdmin, signOut } = useAuth()
const { canModule } = useAccess()
const { theme, toggleTheme } = useTheme()

// Supabase appends ?error=...&error_description=... to the redirect URL when
// an email link (magic link/signup confirmation) is invalid or expired.
// Surface it as a toast instead of leaving the raw params in the URL.
const authError = new URLSearchParams(window.location.search).get('error')
if (authError) {
  const description = new URLSearchParams(window.location.search).get('error_description')
  useToast().error(description?.replace(/\+/g, ' ') || 'Link tidak valid atau sudah kedaluwarsa.')
  window.history.replaceState(null, '', window.location.pathname + window.location.hash)
}

const isBareRoute = computed(() => route.name === 'login')

// Module list — only modules the user's role grants (canModule reads the
// session-resolved set, which already excludes globally-disabled modules).
// 'admin' renders in its own menu slot.
const modules = computed(() =>
  router.options.routes
    .filter(r => r.meta?.module && r.meta.module !== 'admin')
    .filter(r => canModule(r.meta.module))
    .map(r => ({ path: r.path, label: r.meta.label, icon: r.meta.icon }))
)

const currentModule = computed(() =>
  modules.value.find(m => route.path.startsWith(m.path)) ||
  (route.path.startsWith('/admin') ? { label: 'Admin' } : undefined) ||
  (route.path.startsWith('/profile') ? { label: 'Profile' } : undefined),
)

const initials = computed(() => {
  const name = profile.value?.full_name || profile.value?.username || session.value?.user?.email || ''
  return name.slice(0, 2).toUpperCase()
})

const paletteOpen = ref(false)
const menuOpen = ref(false)

const themeIcon = computed(() => (theme.value === 'dark' ? 'sun' : 'moon'))

// Presentation-layer palette only (spec ruling): navigation + static commands.
const commands = computed(() => [
  {
    label: 'Go to',
    items: [
      ...modules.value.map(m => ({ id: `go-${m.path}`, label: m.label, action: () => routerInstance.push(m.path) })),
      { id: 'go-profile', label: 'Profile', action: () => routerInstance.push('/profile') },
      ...(isAdmin.value ? [{ id: 'go-admin', label: 'Admin', action: () => routerInstance.push('/admin') }] : []),
    ],
  },
  {
    label: 'Actions',
    items: [
      { id: 'toggle-theme', label: theme.value === 'dark' ? 'Switch to light theme' : 'Switch to dark theme', action: toggleTheme },
      { id: 'sign-out', label: 'Sign out', action: handleLogout },
    ],
  },
])

function runCommand(command) {
  command?.action?.()
}

function isActive(path) {
  return route.path.startsWith(path)
}

async function handleLogout() {
  menuOpen.value = false
  await signOut()
  routerInstance.push({ name: 'login' })
}

// ── Products ink: accent underline glides under the current product link ──
const productsNav = ref(null)
const inkStyle = ref({ opacity: 0 })

async function placeInk() {
  await nextTick()
  const nav = productsNav.value
  if (!nav) return
  const active = nav.querySelector('[aria-current="page"]')
  if (!active) {
    inkStyle.value = { opacity: 0 }
    return
  }
  inkStyle.value = {
    left: `${active.offsetLeft}px`,
    width: `${active.offsetWidth}px`,
    opacity: 1,
  }
}

watch(() => route.path, placeInk)
watch(modules, placeInk)
onMounted(() => {
  placeInk()
  window.addEventListener('resize', placeInk)
})
onBeforeUnmount(() => window.removeEventListener('resize', placeInk))

// ── Sidebar collapse (persisted like DD's) ──
const SIDEBAR_KEY = 'sp-sidebar'
const sidebarCollapsed = ref(false)
try {
  sidebarCollapsed.value = localStorage.getItem(SIDEBAR_KEY) === 'collapsed'
} catch { /* blocked storage: default expanded */ }

function toggleSidebar() {
  sidebarCollapsed.value = !sidebarCollapsed.value
  try {
    localStorage.setItem(SIDEBAR_KEY, sidebarCollapsed.value ? 'collapsed' : 'expanded')
  } catch { /* blocked storage: session-only choice */ }
}

// ── Responsive: sidebar becomes a sheet below 900 ──
const isMobile = ref(false)
let mq = null
function syncMobile() {
  isMobile.value = window.matchMedia('(max-width: 899px)').matches
}
onMounted(() => {
  mq = window.matchMedia('(max-width: 899px)')
  syncMobile()
  mq.addEventListener('change', syncMobile)
})
onBeforeUnmount(() => {
  mq?.removeEventListener('change', syncMobile)
})

watch(() => route.path, () => {
  menuOpen.value = false
})
</script>

<style scoped>
/* ── App shell, ported from app.css .app/.topbar/.layout/.sidebar ── */
.app {
  min-height: 100vh;
  display: grid;
  grid-template-rows: 56px 1fr;
}

.topbar {
  position: sticky;
  top: 0;
  z-index: var(--z-header);
  display: flex;
  align-items: center;
  gap: var(--space-4);
  padding: 0 var(--space-4);
  height: 56px;
  background: color-mix(in srgb, var(--color-bg) 88%, transparent);
  backdrop-filter: saturate(1.4) blur(12px);
  -webkit-backdrop-filter: saturate(1.4) blur(12px);
  border-bottom: 1px solid var(--color-border);
  box-shadow: var(--shadow-header);
}

.topbar__logo {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex: none;
  text-decoration: none;
}

.topbar__logo span {
  padding-left: var(--space-2);
  border-left: 1px solid var(--color-border-strong);
  font-weight: 600;
  color: var(--color-text-muted);
  font-size: var(--text-sm);
}

/* Products + sliding ink */
.products {
  display: flex;
  gap: var(--space-1);
  height: 100%;
  position: relative;
  min-width: 0;
  overflow: hidden;
}

.products__link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 0 var(--space-2);
  color: var(--color-text-muted);
  white-space: nowrap;
  text-decoration: none;
  font-size: var(--text-sm);
  transition: color var(--dur-quick);
}

.products__link:hover,
.products__link[aria-current='page'] { color: var(--color-text); }
.products__link[aria-current='page'] { font-weight: 600; }
.products__link:focus-visible { outline: 2px solid var(--color-focus); outline-offset: -4px; }

.products__ink {
  position: absolute;
  bottom: 0;
  height: 3px;
  border-radius: 3px 3px 0 0;
  background: var(--color-accent);
  transition: left var(--dur-medium) var(--ease-spring), width var(--dur-medium) var(--ease-spring), opacity var(--dur-quick);
}

.topbar__end {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: var(--space-1);
}

/* Search trigger pill */
.search-trigger {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  height: 32px;
  width: 220px;
  padding: 0 6px 0 12px;
  border-radius: var(--radius-pill);
  border: 1px solid var(--color-border-input);
  background: var(--color-surface);
  color: var(--color-text-placeholder);
  font: inherit;
  font-size: var(--text-sm);
  cursor: pointer;
  transition: border-color var(--dur-quick), box-shadow var(--dur-quick);
}

.search-trigger:hover { border-color: var(--color-text-muted); }
.search-trigger:hover, .search-trigger:focus-visible { box-shadow: 0 0 0 4px rgba(255, 188, 37, 0.18); }
.search-trigger:focus-visible { outline: none; border-color: var(--color-focus); }

.search-trigger__grow {
  flex: 1;
  text-align: left;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

kbd {
  display: inline-grid;
  place-items: center;
  min-width: 20px;
  height: 20px;
  padding: 0 4px;
  border: 1px solid var(--color-border-strong);
  border-bottom-width: 2px;
  border-radius: var(--radius-xs);
  background: var(--color-bg);
  font: 600 var(--text-micro)/1 var(--font-sans);
  color: var(--color-text-muted);
}

/* Icon buttons (app.css .icon-btn) */
.icon-btn {
  position: relative;
  display: inline-grid;
  place-items: center;
  width: 32px;
  height: 32px;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-text-muted);
  cursor: pointer;
  transition: background var(--dur-quick), color var(--dur-quick), transform var(--dur-instant);
}

.icon-btn:hover { background: var(--color-hover); color: var(--color-text-strong); }
.icon-btn:active { transform: scale(0.92); }
.icon-btn:focus-visible { outline: 2px solid var(--color-focus); outline-offset: 2px; }

/* Avatar chip */
.topbar__avatar {
  display: inline-grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: none;
  cursor: pointer;
  background: var(--color-accent-soft);
  color: var(--color-accent-text);
  font: inherit;
  font-size: var(--text-xs);
  font-weight: 700;
  box-shadow: 0 0 0 2px var(--color-bg);
  margin-left: var(--space-1);
}

.topbar__avatar:focus-visible { outline: 2px solid var(--color-focus); outline-offset: 2px; }

/* Pop menu items (dropdown + sheet) */
.pop__lbl {
  padding: var(--space-2) var(--space-2) var(--space-1);
  font-size: var(--text-xs);
  font-weight: 700;
  color: var(--color-text-muted);
  white-space: nowrap;
}

.pop__item {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  width: 100%;
  height: 32px;
  padding: 0 var(--space-2);
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-text);
  font: inherit;
  font-size: var(--text-sm);
  text-align: left;
  text-decoration: none;
  cursor: pointer;
}

.pop__item :deep(.li-icon) { color: var(--color-text-muted); }
.pop__item:hover { background: var(--color-hover); }
.pop__item:focus-visible { outline: 2px solid var(--color-focus); outline-offset: -2px; }
.pop__sep { height: 1px; margin: var(--space-1) 0; background: var(--color-border); }
.pop__item--danger { color: var(--color-danger); }
.pop__item--danger :deep(.li-icon) { color: var(--color-danger); }

/* ── Layout: sidebar + main ── */
.layout {
  display: grid;
  grid-template-columns: auto 1fr;
  min-height: 0;
}

.sidebar {
  position: sticky;
  top: 56px;
  height: calc(100vh - 56px);
  width: 248px;
  display: flex;
  flex-direction: column;
  background: var(--color-surface);
  border-right: 1px solid var(--color-border);
  transition: width var(--dur-medium) var(--ease-move);
  overflow: hidden;
}

.sidebar__label {
  transition: opacity var(--dur-short) var(--ease-out), transform var(--dur-short) var(--ease-out);
  white-space: nowrap;
}

/* Collapse is sequenced: labels fade + slide out first, then the width closes */
.sidebar--collapsed { width: 56px; transition-delay: 80ms; }
.sidebar--collapsed .sidebar__label {
  opacity: 0;
  transform: translateX(-6px);
  pointer-events: none;
}

.sidebar__project {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: var(--space-4) var(--space-3) var(--space-2);
}

.sidebar__mark {
  width: 32px;
  height: 32px;
  flex: none;
  border-radius: var(--radius-sm);
  display: grid;
  place-items: center;
  background: var(--color-accent);
}

.sidebar__project b { font-size: var(--text-sm); color: var(--color-text-strong); }
.sidebar__cap { font-size: var(--text-xs); color: var(--color-text-muted); }

.sidebar__nav {
  padding: var(--space-2);
  display: grid;
  gap: 2px;
  align-content: start;
}

.sidebar__section {
  margin: var(--space-3) var(--space-3) var(--space-1);
  font-size: var(--text-micro);
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--color-text-muted);
}

.sidebar__item {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  height: 32px;
  padding: 0 var(--space-3);
  border-radius: var(--radius-sm);
  color: var(--color-text);
  text-decoration: none;
  font-size: var(--text-sm);
  transition: background var(--dur-quick);
}

.sidebar__item :deep(.li-icon) {
  color: var(--color-text-muted);
  transition: color var(--dur-quick), transform var(--dur-short) var(--ease-spring);
}

.sidebar__item:hover { background: var(--color-surface-2); }
.sidebar__item:hover :deep(.li-icon) { color: var(--color-text); transform: scale(1.08); }
.sidebar__item:focus-visible { outline: 2px solid var(--color-focus); outline-offset: -2px; }

.sidebar__item[aria-current='page'] {
  background: var(--color-selected);
  font-weight: 600;
}

.sidebar__item[aria-current='page']::before {
  content: '';
  position: absolute;
  left: 0;
  top: 6px;
  bottom: 6px;
  width: 3px;
  border-radius: 3px;
  background: var(--color-accent-strong);
  animation: sidebar-grow-y var(--dur-medium) var(--ease-spring);
}

@keyframes sidebar-grow-y { from { transform: scaleY(0); } }

.sidebar__label--grow { flex: 1; overflow: hidden; text-overflow: ellipsis; }

.sidebar__foot {
  margin-top: auto;
  border-top: 1px solid var(--color-border);
  padding: var(--space-2);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.sidebar--collapsed .sidebar__foot { justify-content: center; }

.sidebar__settings {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: var(--space-2);
  border-radius: var(--radius-sm);
  color: var(--color-text-muted);
  text-decoration: none;
  font-size: var(--text-sm);
}

.sidebar__settings:hover { background: var(--color-surface-2); color: var(--color-text); }

/* Main */
.main { min-width: 0; }

:deep(.main > *) {
  padding: var(--space-6) var(--space-8) 64px;
  max-width: 1240px;
}

/* Mobile menu button lives only under 900 */
.mobile-menu { display: none; }

@media (max-width: 899px) {
  .mobile-menu { display: inline-grid; }
  .sidebar { display: none; }
  .search-trigger { width: auto; }
  .search-trigger__grow, .search-trigger kbd { display: none; }
  .topbar { gap: var(--space-2); padding: 0 var(--space-2); }
  .topbar__logo span { display: none; }
  .products { display: none; }
  :deep(.main > *) { padding: var(--space-4) var(--space-4) var(--space-8); }
}

/* Sheet nav */
.sheet-nav { display: grid; gap: 2px; padding-bottom: var(--space-4); }

.sheet-nav__item {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  width: 100%;
  height: 32px;
  padding: 0 var(--space-2);
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-text);
  font: inherit;
  font-size: var(--text-sm);
  text-align: left;
  text-decoration: none;
  cursor: pointer;
}

.sheet-nav__item :deep(.li-icon) { color: var(--color-text-muted); }
.sheet-nav__item:hover { background: var(--color-hover); }
.sheet-nav__item.is-current { background: var(--color-selected); font-weight: 700; box-shadow: inset 3px 0 0 var(--color-accent-strong); }
.sheet-nav__item--danger { color: var(--color-danger); }
.sheet-nav__item--danger :deep(.li-icon) { color: var(--color-danger); }

/* Page transition — state change only, short */
.page-enter-active { transition: opacity var(--dur-short) var(--ease-enter), transform var(--dur-short) var(--ease-enter); }
.page-leave-active { transition: opacity 120ms var(--ease-exit); }
.page-enter-from { opacity: 0; transform: translateY(8px); }
.page-leave-to { opacity: 0; }

@media (prefers-reduced-motion: reduce) {
  .page-enter-active, .page-leave-active { transition-duration: 0ms; }
  .sidebar__item[aria-current='page']::before { animation: none; }
}
</style>
