<template>
  <div class="qris">
    <!-- Hero Header -->
    <header class="qris__header">
      <div class="qris__header-content">
        <div class="qris__title-group">
          <div class="qris__icon-badge">
            <span class="material-symbols-outlined">qr_code_2</span>
          </div>
          <div>
            <h1 class="qris__title">QRIS Tools</h1>
            <p class="qris__subtitle">Generate and analyze EMVCo QRIS codes</p>
          </div>
        </div>
      </div>
    </header>

    <!-- Tab Navigation -->
    <nav class="qris__tabs-wrapper">
      <div class="qris__tabs">
        <button
          v-for="(tab, index) in tabs"
          :key="tab.id"
          class="qris__tab"
          :class="{ 'qris__tab--active': activeTabIndex === index }"
          @click="switchTab(index)"
        >
          <span class="material-symbols-outlined qris__tab-icon">{{ tab.icon }}</span>
          <span class="qris__tab-label">{{ tab.label }}</span>
          <span class="qris__tab-desc">{{ tab.desc }}</span>
        </button>
        <!-- Animated sliding indicator -->
        <div
          class="qris__tab-indicator"
          :style="indicatorStyle"
        />
      </div>
    </nav>

    <!-- Tab Content -->
    <main class="qris__content">
      <Transition name="panel-fade" mode="out-in">
        <div :key="activeTab" class="qris__panel-wrap">

          <!-- Generator Tab -->
          <div v-if="activeTab === 'generator' && canFeature('qris','generator')" class="qris__split">
            <div class="qris__left">
              <div class="qris__section-header">
                <span class="material-symbols-outlined qris__section-icon">tune</span>
                <span class="qris__section-label">Configuration</span>
              </div>
              <QrisGenerator @generated="onResult" />
            </div>
            <div class="qris__right">
              <div class="qris__section-header">
                <span class="material-symbols-outlined qris__section-icon">visibility</span>
                <span class="qris__section-label">Output</span>
              </div>
              <div v-if="result" class="qris__result">
                <div class="qris__qr-wrap">
                  <img
                    v-if="result.dataUrl"
                    :src="result.dataUrl"
                    alt="QR Code"
                    class="qris__qr-img"
                  />
                </div>
                <QrisTagViewer
                  :qrValue="result.qrValue"
                  :tags="result.tags"
                  :highlights="result.highlights"
                  :crcValid="result.crcValid"
                  :crcProvided="result.crcProvided"
                  :crcComputed="result.crcComputed"
                />
              </div>
              <div v-else class="qris__placeholder">
                <div class="qris__placeholder-icon">
                  <span class="material-symbols-outlined">qr_code_2</span>
                </div>
                <p class="qris__placeholder-title">No QR Generated</p>
                <p class="qris__placeholder-desc">Configure parameters and generate a QRIS code to see the result here</p>
              </div>
            </div>
          </div>

          <!-- Reader Tab -->
          <div v-if="activeTab === 'reader' && canFeature('qris','reader')" class="qris__split">
            <div class="qris__left">
              <div class="qris__section-header">
                <span class="material-symbols-outlined qris__section-icon">upload_file</span>
                <span class="qris__section-label">Input</span>
              </div>
              <QrisReader @parsed="onResult" />
            </div>
            <div class="qris__right">
              <div class="qris__section-header">
                <span class="material-symbols-outlined qris__section-icon">visibility</span>
                <span class="qris__section-label">Analysis</span>
              </div>
              <div v-if="result" class="qris__result">
                <div class="qris__qr-wrap">
                  <img
                    v-if="result.dataUrl"
                    :src="result.dataUrl"
                    alt="QR Code"
                    class="qris__qr-img"
                  />
                </div>
                <QrisTagViewer
                  :qrValue="result.qrValue"
                  :tags="result.tags"
                  :highlights="result.highlights"
                  :crcValid="result.crcValid"
                  :crcProvided="result.crcProvided"
                  :crcComputed="result.crcComputed"
                />
              </div>
              <div v-else class="qris__placeholder">
                <div class="qris__placeholder-icon">
                  <span class="material-symbols-outlined">qr_code_scanner</span>
                </div>
                <p class="qris__placeholder-title">No QR Scanned</p>
                <p class="qris__placeholder-desc">Upload or paste a QR code image to analyze its contents</p>
              </div>
            </div>
          </div>

          <!-- History Tab -->
          <div v-if="activeTab === 'history' && canFeature('qris','history')" class="qris__history-view">
            <QrisHistory
              :history="history"
              :loading="historyLoading"
              @detail="onHistoryDetail"
              @delete="onDeleteHistory"
            />
          </div>

        </div>
      </Transition>
    </main>

    <!-- History Detail Modal -->
    <QrisHistoryDetail
      :entry="selectedHistoryEntry"
      @close="selectedHistoryEntry = null"
      @load-to-generator="onLoadFromHistory"
    />
  </div>
</template>

<script setup>
import { ref, computed, nextTick, onMounted, onUnmounted, watch } from 'vue'
import { useAccess } from '@/composables/useAccess.js'
import { useQris } from '../composables/useQris.js'
import QrisGenerator from '../components/QrisGenerator.vue'
import QrisReader from '../components/QrisReader.vue'
import QrisHistory from '../components/QrisHistory.vue'
import QrisTagViewer from '../components/QrisTagViewer.vue'
import QrisHistoryDetail from '../components/QrisHistoryDetail.vue'

const { canFeature } = useAccess()
const { result, history, historyLoading, loadHistory, deleteHistory, loadFromHistory, clearResult } = useQris()

const tabs = computed(() =>
  [
    { id: 'generator', label: 'Generator', desc: 'Create QRIS codes', icon: 'qr_code_2' },
    { id: 'reader', label: 'Reader', desc: 'Analyze existing codes', icon: 'qr_code_scanner' },
    { id: 'history', label: 'History', desc: 'Past generations', icon: 'history' },
  ].filter(t => canFeature('qris', t.id))
)

const activeTabIndex = ref(0)
const activeTab = computed(() => tabs.value[activeTabIndex.value]?.id)
const selectedHistoryEntry = ref(null)
const indicatorStyle = ref({})

watch(tabs, (list) => {
  if (list.length && activeTabIndex.value >= list.length) {
    activeTabIndex.value = 0
  }
})

function switchTab(index) {
  activeTabIndex.value = index
  updateIndicator()
  if (tabs.value[index]?.id === 'history') {
    loadHistory()
  }
}

function updateIndicator() {
  nextTick(() => {
    const tabEl = document.querySelectorAll('.qris__tab')[activeTabIndex.value]
    if (tabEl) {
      indicatorStyle.value = {
        left: `${tabEl.offsetLeft}px`,
        width: `${tabEl.offsetWidth}px`,
      }
    }
  })
}

function onResult(data) {
  result.value = data
}

function onHistoryDetail(entry) {
  selectedHistoryEntry.value = entry
}

function onLoadFromHistory(entry) {
  loadFromHistory(entry)
  selectedHistoryEntry.value = null
  switchTab(0)
}

async function onDeleteHistory(id) {
  await deleteHistory(id)
}

onMounted(() => {
  loadHistory()
  updateIndicator()
  window.addEventListener('resize', updateIndicator)
})

onUnmounted(() => {
  window.removeEventListener('resize', updateIndicator)
})
</script>

<style scoped>
.qris {
  max-width: 1280px;
  margin: 0 auto;
  padding: var(--space-lg, 24px) var(--space-xl, 32px);
  display: flex;
  flex-direction: column;
  gap: var(--space-lg, 24px);
  animation: qris-reveal 0.6s var(--ease-smooth, cubic-bezier(0.16, 1, 0.3, 1)) both;
}

@keyframes qris-reveal {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}

/* ── Header ── */
.qris__header {
  animation: header-reveal 0.6s var(--ease-smooth, cubic-bezier(0.16, 1, 0.3, 1)) both;
}

@keyframes header-reveal {
  from { opacity: 0; transform: translateY(-16px); }
  to { opacity: 1; transform: translateY(0); }
}

.qris__header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.qris__title-group {
  display: flex;
  align-items: center;
  gap: var(--space-l, 16px);
}

.qris__icon-badge {
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, var(--cta-primary-bg, #FFBC25), var(--color-orange-400, #FF6B00));
  border-radius: var(--radius-sm, 12px);
  box-shadow: 0 4px 16px rgba(255, 188, 37, 0.3);
  transition: transform var(--dur-medium, 300ms) var(--ease-spring, cubic-bezier(0.34, 1.56, 0.64, 1));
}

.qris__icon-badge:hover {
  transform: scale(1.08) rotate(-3deg);
}

.qris__icon-badge .material-symbols-outlined {
  font-size: 26px;
  color: var(--color-gray-0, #fff);
}

.qris__title {
  font-size: 26px;
  font-weight: 800;
  color: var(--color-on-surface, #1a1a2e);
  margin: 0;
  letter-spacing: -0.5px;
  font-family: var(--font-display, 'Inter', sans-serif);
}

.qris__subtitle {
  font-size: 14px;
  color: var(--color-gray-500, #8e8ea0);
  margin: 2px 0 0;
  font-weight: 400;
  font-family: var(--font-body, 'Inter', sans-serif);
}

/* ── Tabs ── */
.qris__tabs-wrapper {
  animation: tabs-reveal 0.6s 0.1s var(--ease-smooth, cubic-bezier(0.16, 1, 0.3, 1)) both;
}

@keyframes tabs-reveal {
  from { opacity: 0; transform: translateY(-8px); }
  to { opacity: 1; transform: translateY(0); }
}

.qris__tabs {
  display: flex;
  position: relative;
  background: var(--glass-bg-light, rgba(255, 255, 255, 0.5));
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid var(--glass-border, rgba(0, 0, 0, 0.06));
  border-radius: var(--radius-md, 16px);
  padding: 5px;
  gap: 2px;
}

.qris__tab {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 14px 12px;
  border: none;
  border-radius: var(--radius-sm, 12px);
  background: transparent;
  cursor: pointer;
  font-family: var(--font-body, 'Inter', sans-serif);
  transition: all var(--dur-medium, 300ms) var(--ease-out, cubic-bezier(0.4, 0, 0.2, 1));
  position: relative;
  z-index: 1;
}

.qris__tab:hover {
  background: rgba(255, 255, 255, 0.5);
}

.qris__tab--active {
  color: var(--color-on-surface, #1a1a2e);
}

.qris__tab-icon {
  font-size: 22px;
  color: var(--color-gray-500, #8e8ea0);
  transition:
    color var(--dur-medium, 300ms) var(--ease-out, cubic-bezier(0.4, 0, 0.2, 1)),
    transform var(--dur-medium, 300ms) var(--ease-spring, cubic-bezier(0.34, 1.56, 0.64, 1));
}

.qris__tab--active .qris__tab-icon {
  color: var(--cta-primary-bg, #FFBC25);
  transform: scale(1.1);
}

.qris__tab-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-gray-700, #555);
  transition: color var(--dur-medium, 300ms) var(--ease-out, cubic-bezier(0.4, 0, 0.2, 1));
}

.qris__tab--active .qris__tab-label {
  color: var(--color-on-surface, #1a1a2e);
}

.qris__tab-desc {
  font-size: 11px;
  color: var(--color-gray-400, #aaa);
  font-weight: 400;
  transition: color var(--dur-medium, 300ms) var(--ease-out, cubic-bezier(0.4, 0, 0.2, 1));
}

.qris__tab--active .qris__tab-desc {
  color: var(--color-gray-500, #8e8ea0);
}

.qris__tab-indicator {
  position: absolute;
  top: 5px;
  height: calc(100% - 10px);
  background: var(--color-gray-0, #fff);
  border-radius: var(--radius-sm, 12px);
  box-shadow: var(--shadow-sm, 0 2px 8px rgba(0, 0, 0, 0.04), 0 4px 16px rgba(0, 0, 0, 0.02));
  transition: all 0.35s var(--ease-spring, cubic-bezier(0.34, 1.56, 0.64, 1));
  z-index: 0;
}

/* ── Content ── */
.qris__content {
  min-height: 400px;
}

.qris__panel-wrap {
  width: 100%;
}

/* ── Panel Fade Transition ── */
.panel-fade-enter-active {
  transition: all 0.35s var(--ease-smooth, cubic-bezier(0.16, 1, 0.3, 1));
}

.panel-fade-leave-active {
  transition: all 0.2s ease-in;
}

.panel-fade-enter-from {
  opacity: 0;
  transform: translateY(12px);
}

.panel-fade-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

/* ── Section Headers ── */
.qris__section-header {
  display: flex;
  align-items: center;
  gap: var(--space-s, 8px);
  margin-bottom: var(--space-l, 16px);
  padding-bottom: var(--space-m, 12px);
  border-bottom: 1px solid var(--color-outline-variant, rgba(0, 0, 0, 0.06));
}

.qris__section-icon {
  font-size: 18px;
  color: var(--cta-primary-bg, #FFBC25);
}

.qris__section-label {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.8px;
  color: var(--color-gray-500, #8e8ea0);
  font-family: var(--font-body, 'Inter', sans-serif);
}

/* ── Split Layout ── */
.qris__split {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-xl, 24px);
  align-items: start;
}

.qris__left,
.qris__right {
  background: rgba(255, 255, 255, 0.65);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border: 1px solid var(--glass-border, rgba(255, 255, 255, 0.5));
  border-radius: var(--radius-lg, 24px);
  padding: var(--space-xl, 24px);
  box-shadow: var(--shadow-sm, 0 2px 8px rgba(0, 0, 0, 0.04), 0 4px 16px rgba(0, 0, 0, 0.02));
  transition: box-shadow var(--dur-long, 500ms) var(--ease-out, cubic-bezier(0.4, 0, 0.2, 1));
  animation: card-stagger 0.5s var(--ease-smooth, cubic-bezier(0.16, 1, 0.3, 1)) both;
}

.qris__left {
  animation-delay: 0.15s;
}

.qris__right {
  animation-delay: 0.25s;
}

@keyframes card-stagger {
  from { opacity: 0; transform: translateY(16px); }
  to { opacity: 1; transform: translateY(0); }
}

.qris__left:hover,
.qris__right:hover {
  box-shadow: var(--shadow-md, 0 4px 16px rgba(0, 0, 0, 0.06), 0 8px 32px rgba(0, 0, 0, 0.04));
}

/* ── Result ── */
.qris__result {
  display: flex;
  flex-direction: column;
  gap: var(--space-l, 16px);
  animation: result-enter 0.4s var(--ease-smooth, cubic-bezier(0.16, 1, 0.3, 1)) both;
}

@keyframes result-enter {
  from { opacity: 0; transform: scale(0.96); }
  to { opacity: 1; transform: scale(1); }
}

.qris__qr-wrap {
  display: flex;
  justify-content: center;
  padding: var(--space-xl, 24px);
  background: rgba(255, 255, 255, 0.6);
  border-radius: var(--radius-md, 16px);
  border: 1px solid var(--glass-border, rgba(255, 255, 255, 0.5));
}

.qris__qr-img {
  width: 200px;
  height: 200px;
  object-fit: contain;
}

/* ── Placeholder ── */
.qris__placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-s, 8px);
  padding: var(--space-3xl, 48px) var(--space-xl, 24px);
  text-align: center;
  animation: placeholder-breathe 4s var(--ease-out, cubic-bezier(0.4, 0, 0.2, 1)) infinite alternate;
}

@keyframes placeholder-breathe {
  0% { opacity: 0.6; }
  100% { opacity: 1; }
}

.qris__placeholder-icon {
  width: 72px;
  height: 72px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-gray-100, #f2f2f2);
  border-radius: var(--radius-lg, 24px);
  margin-bottom: var(--space-s, 8px);
  animation: placeholder-float 3s var(--ease-out, cubic-bezier(0.4, 0, 0.2, 1)) infinite alternate;
}

@keyframes placeholder-float {
  0% { transform: translateY(0); }
  100% { transform: translateY(-6px); }
}

.qris__placeholder-icon .material-symbols-outlined {
  font-size: 36px;
  color: var(--color-gray-400, #b3b3b3);
}

.qris__placeholder-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--color-gray-700, #666);
  margin: 0;
  font-family: var(--font-body, 'Inter', sans-serif);
}

.qris__placeholder-desc {
  font-size: 13px;
  color: var(--color-gray-400, #b3b3b3);
  margin: 0;
  max-width: 260px;
  line-height: 1.5;
  font-family: var(--font-body, 'Inter', sans-serif);
}

/* ── History View ── */
.qris__history-view {
  background: rgba(255, 255, 255, 0.65);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border: 1px solid var(--glass-border, rgba(255, 255, 255, 0.5));
  border-radius: var(--radius-lg, 24px);
  padding: var(--space-xl, 24px);
  box-shadow: var(--shadow-sm, 0 2px 8px rgba(0, 0, 0, 0.04), 0 4px 16px rgba(0, 0, 0, 0.02));
  animation: card-stagger 0.5s 0.15s var(--ease-smooth, cubic-bezier(0.16, 1, 0.3, 1)) both;
}

/* ── Reduced Motion ── */
@media (prefers-reduced-motion: reduce) {
  .qris,
  .qris__header,
  .qris__tabs-wrapper,
  .qris__left,
  .qris__right,
  .qris__history-view,
  .qris__result {
    animation: none !important;
  }

  .qris__placeholder {
    animation: none !important;
  }

  .qris__placeholder-icon {
    animation: none !important;
  }

  .qris__tab-indicator {
    transition: none !important;
  }

  .qris__tab-icon {
    transition: none !important;
  }

  .panel-fade-enter-active,
  .panel-fade-leave-active {
    transition-duration: 0.01ms !important;
  }
}

/* ── Responsive ── */
@media (max-width: 768px) {
  .qris {
    padding: var(--space-md, 16px);
    gap: var(--space-md, 16px);
  }

  .qris__title {
    font-size: 20px;
  }

  .qris__icon-badge {
    width: 40px;
    height: 40px;
    border-radius: var(--radius-xs, 8px);
  }

  .qris__icon-badge .material-symbols-outlined {
    font-size: 22px;
  }

  .qris__tabs {
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
  }

  .qris__tabs::-webkit-scrollbar {
    display: none;
  }

  .qris__tab {
    padding: 10px 8px;
    min-width: 0;
    flex-shrink: 0;
  }

  .qris__tab-desc {
    display: none;
  }

  .qris__split {
    grid-template-columns: 1fr;
  }

  .qris__left,
  .qris__right {
    padding: var(--space-l, 16px);
    border-radius: var(--radius-md, 16px);
  }

  .qris__history-view {
    padding: var(--space-l, 16px);
    border-radius: var(--radius-md, 16px);
  }

  .qris__placeholder {
    padding: var(--space-2xl, 32px) var(--space-l, 16px);
  }

  .qris__placeholder-icon {
    width: 56px;
    height: 56px;
  }

  .qris__placeholder-icon .material-symbols-outlined {
    font-size: 28px;
  }
}

@media (max-width: 480px) {
  .qris__icon-badge {
    display: none;
  }

  .qris__tab-label {
    font-size: 12px;
  }

  .qris__tab-icon {
    font-size: 18px;
  }

  .qris__qr-img {
    width: 160px;
    height: 160px;
  }
}
</style>
