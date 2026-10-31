<template>
  <LiToast />
  <LiCommandPalette v-model="paletteOpen" :commands="commands" @execute="runCommand" />

  <!-- Landing/login render full-bleed, without the app shell -->
  <router-view v-if="isBareRoute" />

  <div v-else class="sp-shell">
    <!-- Shell B: product top bar, 56, sticky -->
    <header class="sp-topbar">
      <router-link to="/dashboard" class="sp-topbar__home" aria-label="SP-lite home">
        <LiLogo size="sm" :show-subtitle="false" />
      </router-link>

      <!-- Products dropdown (module switcher) -->
      <nav class="sp-topbar__nav" aria-label="Modules">
        <LiDropdown v-if="modules.length" align="left">
          <template #trigger>
            <button class="sp-products" :aria-expanded="undefined">
              <LiIcon v-if="currentModule?.icon" :name="currentModule.icon" size="sm" />
              <span class="sp-products__label">{{ currentModule?.label || 'Modules' }}</span>
              <LiIcon name="chevron-down" size="sm" />
            </button>
          </template>
          <router-link
            v-for="mod in modules"
            :key="mod.path"
            :to="mod.path"
            class="sp-menu-item"
            :class="{ 'is-current': isActive(mod.path) }"
            role="menuitem"
          >
            <LiIcon :name="mod.icon" size="sm" />
            <span>{{ mod.label }}</span>
          </router-link>
          <router-link v-if="isAdmin" to="/admin" class="sp-menu-item" :class="{ 'is-current': isActive('/admin') }" role="menuitem">
            <LiIcon name="shield" size="sm" />
            <span>Admin</span>
          </router-link>
        </LiDropdown>
      </nav>

      <div class="sp-topbar__end">
        <button class="sp-icon-btn" aria-label="Search (Ctrl K)" title="Search" @click="paletteOpen = true">
          <LiIcon name="search" size="sm" />
          <kbd class="sp-kbd">Ctrl K</kbd>
        </button>
        <button
          class="sp-icon-btn"
          :aria-label="theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'"
          @click="toggleTheme"
        >
          <LiIcon :name="themeIcon" size="sm" />
        </button>
        <router-link to="/profile" class="sp-topbar__avatar" aria-label="Profile">
          <LiAvatar :initials="initials" size="sm" />
        </router-link>
        <button class="sp-icon-btn sp-topbar__menu-btn" aria-label="Open navigation menu" @click="menuOpen = true">
          <LiIcon name="menu" size="sm" />
        </button>
      </div>
    </header>

    <!-- Module content: the one scrolling region -->
    <main class="sp-main">
      <router-view v-slot="{ Component, route: r }">
        <Transition name="page" mode="out-in">
          <component :is="Component" :key="r.path" />
        </Transition>
      </router-view>
    </main>

    <!-- Mobile menu sheet (< 900) -->
    <LiBottomSheet v-model="menuOpen" title="Modules">
      <nav class="sp-sheet-nav" aria-label="Modules">
        <router-link
          v-for="mod in modules"
          :key="mod.path"
          :to="mod.path"
          class="sp-menu-item"
          :class="{ 'is-current': isActive(mod.path) }"
          @click="menuOpen = false"
        >
          <LiIcon :name="mod.icon" size="sm" />
          <span>{{ mod.label }}</span>
        </router-link>
        <router-link v-if="isAdmin" to="/admin" class="sp-menu-item" :class="{ 'is-current': isActive('/admin') }" @click="menuOpen = false">
          <LiIcon name="shield" size="sm" />
          <span>Admin</span>
        </router-link>
        <router-link to="/profile" class="sp-menu-item" :class="{ 'is-current': isActive('/profile') }" @click="menuOpen = false">
          <LiIcon name="circle-user" size="sm" />
          <span>Profile</span>
        </router-link>
        <button class="sp-menu-item sp-menu-item--danger" @click="handleLogout">
          <LiIcon name="log-out" size="sm" />
          <span>Sign out</span>
        </button>
      </nav>
    </LiBottomSheet>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import router from './router/index.js'
import { useAuth } from './composables/useAuth.js'
import { useAccess } from './composables/useAccess.js'
import { useTheme } from './composables/useTheme.js'
import { useToast } from './lib/composables/useToast.js'
import LiToast from './lib/components/LiToast.vue'
import LiLogo from './lib/components/LiLogo.vue'
import LiIcon from './lib/components/LiIcon.vue'
import LiAvatar from './lib/components/LiAvatar.vue'
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

const isBareRoute = computed(() => route.name === 'landing' || route.name === 'login')

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
  (route.path.startsWith('/admin') ? { label: 'Admin', icon: 'shield' } : undefined) ||
  (route.path.startsWith('/profile') ? { label: 'Profile', icon: 'circle-user' } : undefined),
)

const initials = computed(() => {
  const name = profile.value?.full_name || profile.value?.username || session.value?.user?.email || ''
  return name.slice(0, 2).toUpperCase()
})

const paletteOpen = ref(false)
const menuOpen = ref(false)

const themeIcon = computed(() => (theme.value === 'dark' ? 'sun' : 'moon'))

// Presentation-layer palette only (spec §Ruling 6): navigation + static commands.
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
  routerInstance.push({ name: 'landing' })
}

watch(() => route.path, () => {
  menuOpen.value = false
})
</script>

<style scoped>
/* Shell B (LAYOUTS.md): sticky top bar 56, one soft header shadow, fluid content. */
.sp-shell {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.sp-topbar {
  position: sticky;
  top: 0;
  z-index: var(--z-header);
  height: 56px;
  display: flex;
  align-items: center;
  gap: var(--space-6);
  padding: 0 var(--space-4);
  background: var(--color-bg);
  box-shadow: var(--shadow-header);
}

.sp-topbar__home {
  display: inline-flex;
  align-items: center;
  flex: none;
  text-decoration: none;
}

.sp-topbar__nav {
  display: none;
  min-width: 0;
}

.sp-topbar__end {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: var(--space-1);
}

.sp-icon-btn {
  position: relative;
  display: inline-grid;
  place-items: center;
  height: 32px;
  min-width: 32px;
  padding: 0 var(--space-2);
  gap: var(--space-2);
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-text-muted);
  cursor: pointer;
  font: inherit;
  font-size: var(--text-xs);
  transition: background var(--dur-quick), color var(--dur-quick), transform var(--dur-instant);
}

.sp-icon-btn:hover {
  background: var(--color-hover);
  color: var(--color-text-strong);
}

.sp-icon-btn:active { transform: scale(0.92); }

.sp-icon-btn:focus-visible {
  outline: 2px solid var(--color-focus);
  outline-offset: 2px;
}

.sp-kbd {
  font-family: var(--font-sans);
  font-size: var(--text-micro);
  font-weight: 700;
  color: var(--color-text-muted);
  background: var(--color-surface-2);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xs);
  padding: 1px 5px;
}

.sp-topbar__avatar {
  display: inline-flex;
  margin-left: var(--space-1);
  border-radius: 50%;
}

.sp-topbar__avatar:focus-visible {
  outline: 2px solid var(--color-focus);
  outline-offset: 2px;
}

.sp-topbar__menu-btn { display: inline-grid; }

/* Products switcher */
.sp-products {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  height: 32px;
  padding: 0 var(--space-3);
  border: none;
  border-radius: var(--radius-pill);
  background: var(--color-accent-tint);
  color: var(--color-text);
  font: inherit;
  font-size: var(--text-sm);
  font-weight: 600;
  cursor: pointer;
  max-width: 220px;
  transition: background var(--dur-quick);
}

.sp-products:hover { background: var(--color-accent-soft); }

.sp-products:focus-visible {
  outline: 2px solid var(--color-focus);
  outline-offset: 2px;
}

.sp-products__label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Menu items (dropdown + sheet) */
.sp-menu-item {
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

.sp-menu-item :deep(.li-icon) { color: var(--color-text-muted); }

.sp-menu-item:hover {
  background: var(--color-hover);
}

.sp-menu-item:focus-visible {
  outline: 2px solid var(--color-focus);
  outline-offset: -2px;
}

.sp-menu-item.is-current {
  background: var(--color-selected);
  font-weight: 700;
  box-shadow: inset 3px 0 0 var(--color-accent-strong);
}

.sp-menu-item--danger { color: var(--color-danger); }
.sp-menu-item--danger :deep(.li-icon) { color: var(--color-danger); }

.sp-sheet-nav {
  display: grid;
  gap: 2px;
  padding-bottom: var(--space-4);
}

/* Content */
.sp-main {
  flex: 1;
  padding: var(--space-6) var(--space-6) var(--space-12);
  max-width: 1240px;
  width: 100%;
  margin: 0 auto;
}

/* Page transition — state change only, short */
.page-enter-active { transition: opacity var(--dur-short) var(--ease-enter), transform var(--dur-short) var(--ease-enter); }
.page-leave-active { transition: opacity 120ms var(--ease-exit); }
.page-enter-from { opacity: 0; transform: translateY(8px); }
.page-leave-to { opacity: 0; }

@media (min-width: 900px) {
  .sp-topbar__nav { display: block; }
  .sp-topbar__menu-btn { display: none; }
  .sp-topbar { padding: 0 var(--space-6); }
}

@media (max-width: 899px) {
  .sp-main {
    padding: var(--space-4) var(--space-4) var(--space-8);
  }
}

@media (prefers-reduced-motion: reduce) {
  .page-enter-active, .page-leave-active { transition-duration: 0ms; }
}
</style>
