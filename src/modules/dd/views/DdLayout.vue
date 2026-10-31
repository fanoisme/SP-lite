<template>
  <div class="ddlayout" :class="{ 'ddlayout--collapsed': collapsed }">
    <!-- Project sidebar: 248 / 56 collapsed (LAYOUTS.md Shell B); below 900 a sheet -->
    <aside v-if="!isMobile" class="ddlayout__side">
      <DdSidebar :collapsed="collapsed" />
      <button
        class="ddlayout__collapse"
        :aria-label="collapsed ? 'Expand sidebar' : 'Collapse sidebar'"
        :aria-pressed="collapsed"
        @click="toggleCollapsed"
      >
        <LiIcon :name="collapsed ? 'chevron-right' : 'chevron-left'" size="sm" />
      </button>
    </aside>

    <button v-else class="ddlayout__sheetbtn" @click="sheetOpen = true">
      <LiIcon name="menu" size="sm" />
      <span>DD MPM menu</span>
      <LiIcon name="chevron-down" size="sm" />
    </button>

    <LiBottomSheet v-model="sheetOpen" title="DD MPM">
      <DdSidebar @navigate="sheetOpen = false" />
    </LiBottomSheet>

    <main class="ddlayout__main">
      <RouterView v-slot="{ Component }">
        <Transition name="dd-fade" mode="out-in">
          <component :is="Component" />
        </Transition>
      </RouterView>
    </main>
  </div>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { RouterView } from 'vue-router'
import DdSidebar from '../components/DdSidebar.vue'
import LiBottomSheet from '@/lib/components/LiBottomSheet.vue'
import LiIcon from '@/lib/components/LiIcon.vue'

const STORAGE_KEY = 'dd-sidebar'
const collapsed = ref(false)
const sheetOpen = ref(false)
const isMobile = ref(false)

try {
  collapsed.value = localStorage.getItem(STORAGE_KEY) === 'collapsed'
} catch { /* blocked storage: default expanded */ }

function toggleCollapsed() {
  collapsed.value = !collapsed.value
  try {
    localStorage.setItem(STORAGE_KEY, collapsed.value ? 'collapsed' : 'expanded')
  } catch { /* blocked storage: session-only choice */ }
}

function syncMobile() {
  isMobile.value = window.matchMedia('(max-width: 899px)').matches
}

let mq = null
onMounted(() => {
  mq = window.matchMedia('(max-width: 899px)')
  syncMobile()
  mq.addEventListener('change', syncMobile)
})
onBeforeUnmount(() => {
  mq?.removeEventListener('change', syncMobile)
})
</script>

<style scoped>
/* Shell B nested project sidebar (board.html): sidebar pins, content scrolls. */
.ddlayout {
  display: flex;
  align-items: flex-start;
  gap: var(--space-6);
  width: 100%;
}

.ddlayout__side {
  position: sticky;
  top: 72px;
  display: flex;
  gap: var(--space-1);
  flex-shrink: 0;
  max-height: calc(100vh - 96px);
}

.ddlayout__collapse {
  align-self: stretch;
  width: 24px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg);
  color: var(--color-text-muted);
  cursor: pointer;
  display: grid;
  place-items: center;
  transition: background var(--dur-quick), color var(--dur-quick);
}

.ddlayout__collapse:hover {
  background: var(--color-hover);
  color: var(--color-text-strong);
}

.ddlayout__collapse:focus-visible {
  outline: 2px solid var(--color-focus);
  outline-offset: 2px;
}

.ddlayout__sheetbtn {
  display: none;
}

.ddlayout__main {
  flex: 1;
  min-width: 0;
}

.dd-fade-enter-active { transition: opacity var(--dur-short) var(--ease-enter), transform var(--dur-short) var(--ease-enter); }
.dd-fade-leave-active { transition: opacity 120ms var(--ease-exit); }
.dd-fade-enter-from { opacity: 0; transform: translateY(8px); }
.dd-fade-leave-to { opacity: 0; }

@media (max-width: 899px) {
  .ddlayout { flex-direction: column; gap: var(--space-4); }
  .ddlayout__side { display: none; }
  .ddlayout__sheetbtn {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    height: 32px;
    padding: 0 var(--space-3);
    border: 1px solid var(--color-border-strong);
    border-radius: var(--radius-pill);
    background: var(--color-bg);
    color: var(--color-text);
    font: inherit;
    font-size: var(--text-sm);
    font-weight: 600;
    cursor: pointer;
  }
}

@media (prefers-reduced-motion: reduce) {
  .dd-fade-enter-active, .dd-fade-leave-active { transition-duration: 0.01ms; }
}
</style>
