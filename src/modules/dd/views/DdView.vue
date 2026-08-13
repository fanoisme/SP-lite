<template>
  <div class="dd">
    <header class="dd__header">
      <div class="dd__header-content">
        <div class="dd__title-group">
          <div class="dd__icon-badge">
            <span class="material-symbols-outlined">inventory</span>
          </div>
          <div>
            <h1 class="dd__title">DD MPM</h1>
            <p class="dd__subtitle">Business units, merchants, promo rules, audit and exports</p>
          </div>
        </div>
      </div>
    </header>

    <nav class="dd__tabs-wrapper">
      <div class="dd__tabs">
        <button
          v-for="(tab, index) in visibleTabs"
          :key="tab.id"
          class="dd__tab"
          :class="{ 'dd__tab--active': activeTab === tab.id }"
          @click="switchTab(tab.id, index)"
        >
          <span class="material-symbols-outlined dd__tab-icon">{{ tab.icon }}</span>
          <span class="dd__tab-label">{{ tab.label }}</span>
          <span class="dd__tab-desc">{{ tab.desc }}</span>
        </button>
        <div class="dd__tab-indicator" :style="indicatorStyle" />
      </div>
    </nav>

    <Transition name="panel-slide" mode="out-in">
      <div :key="activeTab" class="dd__panel-wrap">
        <DdPlaceholder
          v-if="activeTab !== 'audit'"
          :title="currentTab?.label ?? ''"
          :phase="currentTab?.phase ?? 'a later phase'"
          :icon="currentTab?.icon ?? 'construction'"
        />
        <DdPlaceholder
          v-else
          title="Audit Log"
          phase="the next step of Phase 1"
          icon="history"
        />
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useAccess } from '@/composables/useAccess.js'
import DdPlaceholder from '../components/DdPlaceholder.vue'

const { canFeature } = useAccess()
function can(feature) { return canFeature('dd', feature) }

// Every phase's tab is declared now so the shell needs no restructuring five
// more times. `phase` is what the placeholder tells the user.
const allTabDefs = [
  { id: 'dashboard',   label: 'Dashboard',   desc: 'Reports & stats',    icon: 'monitoring',      gate: null,           phase: 'Phase 3' },
  { id: 'bu-accounts', label: 'BU Accounts', desc: 'Manage accounts',    icon: 'account_balance', gate: 'bu-accounts.read', phase: 'Phase 2' },
  { id: 'merchants',   label: 'Merchants',   desc: 'Whitelist',          icon: 'store',           gate: 'merchants.read',   phase: 'Phase 2' },
  { id: 'promos',      label: 'Promo Rules', desc: 'Discount rules',     icon: 'percent',         gate: 'promos.read',      phase: 'Phase 2' },
  { id: 'audit',       label: 'Audit Log',   desc: 'Who changed what',   icon: 'history',         gate: 'audit.read',       phase: 'Phase 1' },
  { id: 'export',      label: 'Export',      desc: 'SQL & XLSX',         icon: 'file_save',       gate: 'export.read',      phase: 'Phase 4' },
  { id: 'tables',      label: 'Tables',      desc: 'Raw table browser',  icon: 'table',           gate: 'tables.read',      phase: 'Phase 5' },
  { id: 'sql',         label: 'SQL',         desc: 'Query workspace',    icon: 'terminal',        gate: 'sql.read',         phase: 'Phase 5' },
]

const visibleTabs = computed(() => allTabDefs.filter(t => !t.gate || can(t.gate)))

// Audit Log is the only tab that does anything in Phase 1, so open on it when
// it is granted.
const activeTab = ref(
  visibleTabs.value.find(t => t.id === 'audit')?.id ?? visibleTabs.value[0]?.id,
)
const currentTab = computed(() => allTabDefs.find(t => t.id === activeTab.value))
const indicatorStyle = ref({})

watch(visibleTabs, (list) => {
  if (list.length && !list.find(t => t.id === activeTab.value)) {
    activeTab.value = list[0].id
    nextTick(() => updateIndicator())
  }
})

function switchTab(id, index) {
  activeTab.value = id
  nextTick(() => updateIndicator(index))
}

function updateIndicator(targetIndex) {
  const idx = targetIndex ?? visibleTabs.value.findIndex(t => t.id === activeTab.value)
  const tabEl = document.querySelectorAll('.dd__tab')[idx]
  if (tabEl) {
    indicatorStyle.value = {
      left: `${tabEl.offsetLeft}px`,
      width: `${tabEl.offsetWidth}px`,
    }
  }
}

function onResize() { nextTick(() => updateIndicator()) }

onMounted(() => {
  nextTick(() => updateIndicator())
  window.addEventListener('resize', onResize)
})
onBeforeUnmount(() => window.removeEventListener('resize', onResize))
</script>

<style scoped>
.dd {
  max-width: 1280px;
  margin: 0 auto;
  padding: var(--space-lg, 24px) var(--space-xl, 32px);
  display: flex;
  flex-direction: column;
  gap: var(--space-lg, 24px);
}

.dd__header-content { display: flex; justify-content: space-between; align-items: center; }
.dd__title-group { display: flex; align-items: center; gap: var(--space-l, 16px); }
.dd__icon-badge {
  width: 48px; height: 48px;
  display: flex; align-items: center; justify-content: center;
  background: linear-gradient(135deg, #6366F1, #8B5CF6);
  border-radius: var(--radius-sm, 12px);
  box-shadow: 0 4px 16px rgba(99, 102, 241, 0.3);
}
.dd__icon-badge .material-symbols-outlined { font-size: 26px; color: #fff; }
.dd__title { font-size: 26px; font-weight: 800; margin: 0; letter-spacing: -0.5px; }
.dd__subtitle { font-size: 14px; color: var(--color-gray-500, #8e8ea0); margin: 2px 0 0; }

.dd__tabs {
  display: flex; position: relative;
  background: rgba(255,255,255,0.5); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(0,0,0,0.06); border-radius: var(--radius-md, 16px);
  padding: 5px; gap: 2px;
}
.dd__tab {
  flex: 1; display: flex; flex-direction: column; align-items: center; gap: 2px;
  padding: 14px 12px; border: none; border-radius: var(--radius-sm, 12px);
  background: transparent; cursor: pointer;
  font-family: var(--font-body, 'Inter', sans-serif);
  transition: all 300ms ease-out;
  position: relative; z-index: 1;
}
.dd__tab:hover { background: rgba(255,255,255,0.5); }
.dd__tab--active { color: var(--color-on-surface, #1a1a2e); }
.dd__tab-icon { font-size: 22px; color: var(--color-gray-500, #8e8ea0); transition: color 300ms ease-out, transform 300ms cubic-bezier(0.34, 1.56, 0.64, 1); }
.dd__tab--active .dd__tab-icon { color: #6366F1; transform: scale(1.1); }
.dd__tab-label { font-size: 13px; font-weight: 600; color: var(--color-gray-700, #555); transition: color 300ms ease-out; }
.dd__tab--active .dd__tab-label { color: var(--color-on-surface, #1a1a2e); }
.dd__tab-desc { font-size: 11px; color: var(--color-gray-400, #aaa); font-weight: 400; transition: color 300ms ease-out; }
.dd__tab--active .dd__tab-desc { color: var(--color-gray-500, #8e8ea0); }
.dd__tab-indicator {
  position: absolute; top: 5px; height: calc(100% - 10px);
  background: #fff; border-radius: var(--radius-sm, 12px);
  box-shadow: 0 2px 8px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.02);
  transition: all 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
  z-index: 0;
}

.panel-slide-enter-active { transition: all 0.35s cubic-bezier(0.16, 1, 0.3, 1); }
.panel-slide-leave-active { transition: all 0.2s ease-in; }
.panel-slide-enter-from { opacity: 0; transform: translateY(12px); }
.panel-slide-leave-to { opacity: 0; transform: translateY(-8px); }

@media (max-width: 768px) {
  .dd { padding: var(--space-md, 16px); gap: var(--space-md, 16px); }
  .dd__title { font-size: 20px; }
  .dd__icon-badge { width: 40px; height: 40px; }
  .dd__icon-badge .material-symbols-outlined { font-size: 22px; }
  .dd__tab { padding: 10px 8px; min-width: 0; flex-shrink: 0; }
  .dd__tab-desc { display: none; }
  .dd__tabs { overflow-x: auto; -webkit-overflow-scrolling: touch; scrollbar-width: none; }
  .dd__tabs::-webkit-scrollbar { display: none; }
}
@media (max-width: 480px) {
  .dd__icon-badge { display: none; }
  .dd__tab-label { font-size: 12px; }
  .dd__tab-icon { font-size: 18px; }
}
@media (prefers-reduced-motion: reduce) {
  .dd__tab-indicator { transition: none; }
  .dd__tab-icon { transition: none; }
  .panel-slide-enter-active, .panel-slide-leave-active { transition-duration: 0.01ms; }
}
</style>
