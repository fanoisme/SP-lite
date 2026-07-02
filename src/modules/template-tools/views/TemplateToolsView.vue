<template>
  <div class="tpl-tools">
    <!-- Hero Header -->
    <header class="tpl-tools__header">
      <div class="tpl-tools__header-content">
        <div class="tpl-tools__title-group">
          <div class="tpl-tools__icon-badge">
            <span class="material-symbols-outlined">auto_awesome</span>
          </div>
          <div>
            <h1 class="tpl-tools__title">Template Tools</h1>
            <p class="tpl-tools__subtitle">Convert, preview, and validate your document templates</p>
          </div>
        </div>
      </div>
    </header>

    <!-- Tab Navigation -->
    <nav class="tpl-tools__tabs-wrapper">
      <div class="tpl-tools__tabs">
        <button
          v-for="(tab, index) in tabs"
          :key="tab.id"
          class="tpl-tools__tab"
          :class="{ 'tpl-tools__tab--active': activeTab === index }"
          @click="switchTab(index)"
        >
          <span class="material-symbols-outlined tpl-tools__tab-icon">{{ tab.icon }}</span>
          <span class="tpl-tools__tab-label">{{ tab.label }}</span>
          <span class="tpl-tools__tab-desc">{{ tab.desc }}</span>
        </button>
        <!-- Animated indicator -->
        <div
          class="tpl-tools__tab-indicator"
          :style="indicatorStyle"
        />
      </div>
    </nav>

    <!-- Tab Content -->
    <main class="tpl-tools__content">
      <Transition name="panel-slide" mode="out-in">
        <div :key="activeTab" class="tpl-tools__panel-wrap">
          <div class="tpl-tools__card">
            <component :is="activeComponent" />
          </div>
        </div>
      </Transition>
    </main>
  </div>
</template>

<script setup>
import { ref, computed, defineAsyncComponent, nextTick, onMounted, watch } from 'vue'
import { useAccess } from '@/composables/useAccess.js'

const DocxToHtmlPanel = defineAsyncComponent(() => import('../components/DocxToHtmlPanel.vue'))
const HtmlToFtlPanel = defineAsyncComponent(() => import('../components/HtmlToFtlPanel.vue'))
const HtmlPreviewPanel = defineAsyncComponent(() => import('../components/HtmlPreviewPanel.vue'))
const FtlPreviewPanel = defineAsyncComponent(() => import('../components/FtlPreviewPanel.vue'))

const { canFeature } = useAccess()

const tabs = computed(() =>
  [
    { id: 'docx-html', feature: 'docx-to-html', label: 'DOCX → HTML', desc: 'Convert Word documents', icon: 'upload_file', component: DocxToHtmlPanel },
    { id: 'html-ftl', feature: 'html-to-ftl', label: 'HTML → FTL', desc: 'Generate FreeMarker templates', icon: 'transform', component: HtmlToFtlPanel },
    { id: 'html-preview', feature: 'html-preview', label: 'HTML Preview', desc: 'Preview with variables', icon: 'preview', component: HtmlPreviewPanel },
    { id: 'ftl-preview', feature: 'ftl-preview', label: 'FTL Preview', desc: 'PDF-style preview', icon: 'picture_as_pdf', component: FtlPreviewPanel },
  ].filter(t => canFeature('template-tools', t.feature))
)

const activeTab = ref(0)
const tabRefs = ref([])
const indicatorStyle = ref({})

const activeComponent = computed(() => tabs.value[activeTab.value]?.component)

watch(tabs, (list) => {
  if (list.length && activeTab.value >= list.length) {
    activeTab.value = 0
  }
})

function switchTab(index) {
  activeTab.value = index
  updateIndicator()
}

function updateIndicator() {
  nextTick(() => {
    const tabEl = document.querySelectorAll('.tpl-tools__tab')[activeTab.value]
    if (tabEl) {
      indicatorStyle.value = {
        left: `${tabEl.offsetLeft}px`,
        width: `${tabEl.offsetWidth}px`,
      }
    }
  })
}

onMounted(() => {
  updateIndicator()
  window.addEventListener('resize', updateIndicator)
})
</script>

<style scoped>
.tpl-tools {
  max-width: 1280px;
  margin: 0 auto;
  padding: var(--space-lg, 24px) var(--space-xl, 32px);
  display: flex;
  flex-direction: column;
  gap: var(--space-lg, 24px);
}

/* ── Header ── */
.tpl-tools__header {
  animation: headerReveal 0.6s var(--ease-out, cubic-bezier(0.16, 1, 0.3, 1)) both;
}

@keyframes headerReveal {
  from { opacity: 0; transform: translateY(-16px); }
  to { opacity: 1; transform: translateY(0); }
}

.tpl-tools__header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.tpl-tools__title-group {
  display: flex;
  align-items: center;
  gap: 16px;
}

.tpl-tools__icon-badge {
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, var(--cta-primary-bg, #FFBC25), #FF9500);
  border-radius: 14px;
  box-shadow: 0 4px 16px rgba(255, 188, 37, 0.3);
}

.tpl-tools__icon-badge .material-symbols-outlined {
  font-size: 26px;
  color: #fff;
}

.tpl-tools__title {
  font-size: 26px;
  font-weight: 800;
  color: var(--color-on-surface, #1a1a2e);
  margin: 0;
  letter-spacing: -0.5px;
  font-family: 'Inter', sans-serif;
}

.tpl-tools__subtitle {
  font-size: 14px;
  color: #8e8ea0;
  margin: 2px 0 0;
  font-weight: 400;
}

/* ── Tabs ── */
.tpl-tools__tabs-wrapper {
  animation: tabsReveal 0.6s 0.1s var(--ease-out, cubic-bezier(0.16, 1, 0.3, 1)) both;
}

@keyframes tabsReveal {
  from { opacity: 0; transform: translateY(-8px); }
  to { opacity: 1; transform: translateY(0); }
}

.tpl-tools__tabs {
  display: flex;
  position: relative;
  background: rgba(255, 255, 255, 0.5);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(0, 0, 0, 0.06);
  border-radius: 16px;
  padding: 5px;
  gap: 2px;
}

.tpl-tools__tab {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 14px 12px;
  border: none;
  border-radius: 12px;
  background: transparent;
  cursor: pointer;
  font-family: inherit;
  transition: all 0.3s var(--ease-smooth, cubic-bezier(0.4, 0, 0.2, 1));
  position: relative;
  z-index: 1;
}

.tpl-tools__tab:hover {
  background: rgba(255, 255, 255, 0.5);
}

.tpl-tools__tab--active {
  color: var(--color-on-surface, #1a1a2e);
}

.tpl-tools__tab-icon {
  font-size: 22px;
  color: #8e8ea0;
  transition: color 0.3s ease, transform 0.3s var(--ease-spring, cubic-bezier(0.34, 1.56, 0.64, 1));
}

.tpl-tools__tab--active .tpl-tools__tab-icon {
  color: var(--cta-primary-bg, #FFBC25);
  transform: scale(1.1);
}

.tpl-tools__tab-label {
  font-size: 13px;
  font-weight: 600;
  color: #555;
  transition: color 0.3s ease;
}

.tpl-tools__tab--active .tpl-tools__tab-label {
  color: var(--color-on-surface, #1a1a2e);
}

.tpl-tools__tab-desc {
  font-size: 11px;
  color: #aaa;
  font-weight: 400;
  transition: color 0.3s ease;
}

.tpl-tools__tab--active .tpl-tools__tab-desc {
  color: #8e8ea0;
}

.tpl-tools__tab-indicator {
  position: absolute;
  top: 5px;
  height: calc(100% - 10px);
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06), 0 1px 2px rgba(0, 0, 0, 0.04);
  transition: all 0.35s var(--ease-spring, cubic-bezier(0.34, 1.56, 0.64, 1));
  z-index: 0;
}

/* ── Content ── */
.tpl-tools__content {
  min-height: 0;
}

.tpl-tools__panel-wrap {
  width: 100%;
  height: fit-content;
}

.tpl-tools__card {
  background: rgba(255, 255, 255, 0.65);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border: 1px solid rgba(255, 255, 255, 0.5);
  border-radius: 20px;
  padding: var(--space-lg, 24px);
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.04), 0 1px 4px rgba(0, 0, 0, 0.02);
  transition: box-shadow 0.4s ease;
}

.tpl-tools__card:hover {
  box-shadow: 0 8px 40px rgba(0, 0, 0, 0.06), 0 2px 8px rgba(0, 0, 0, 0.03);
}

/* ── Panel Transition ── */
.panel-slide-enter-active {
  transition: all 0.35s var(--ease-out, cubic-bezier(0.16, 1, 0.3, 1));
}
.panel-slide-leave-active {
  transition: all 0.2s ease-in;
}
.panel-slide-enter-from {
  opacity: 0;
  transform: translateY(12px);
}
.panel-slide-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

@media (max-width: 768px) {
  .tpl-tools {
    padding: var(--space-md, 16px);
  }

  .tpl-tools__title {
    font-size: 20px;
  }

  .tpl-tools__tabs {
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }

  .tpl-tools__tab {
    padding: 10px 8px;
    min-width: 0;
  }

  .tpl-tools__tab-desc {
    display: none;
  }

  .tpl-tools__card {
    padding: var(--space-md, 16px);
  }
}
</style>
