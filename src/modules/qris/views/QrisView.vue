<template>
  <div class="qris">
    <!-- Hero Header -->
    <header class="qris__header">
      <div class="qris__header-content">
        <div class="qris__title-group">
          <div class="qris__icon-badge">
            <LiIcon name="qr-code" />
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
          :aria-pressed="activeTabIndex === index"
          @click="switchTab(index)"
        >
          <LiIcon :name="tab.icon" class="qris__tab-icon" />
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
                <LiIcon name="sliders-horizontal" class="qris__section-icon" />
                <span class="qris__section-label">Configuration</span>
              </div>
              <QrisGenerator @generated="onResult" />
            </div>
            <div class="qris__right">
              <div class="qris__section-header">
                <LiIcon name="eye" class="qris__section-icon" />
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
                  <LiIcon name="qr-code" />
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
                <LiIcon name="file-up" class="qris__section-icon" />
                <span class="qris__section-label">Input</span>
              </div>
              <QrisReader @parsed="onResult" />
            </div>
            <div class="qris__right">
              <div class="qris__section-header">
                <LiIcon name="eye" class="qris__section-icon" />
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
                  <LiIcon name="scan-line" />
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
              :currentPage="currentPage"
              :totalPages="totalPages"
              @detail="onHistoryDetail"
              @delete="onDeleteHistory"
              @clear="onClearHistory"
              @export="onExportHistory"
              @update:currentPage="onPageChange"
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
import { useToast } from '@lib/composables/useToast'
import { useQris } from '../composables/useQris.js'
import QrisGenerator from '../components/QrisGenerator.vue'
import QrisReader from '../components/QrisReader.vue'
import QrisHistory from '../components/QrisHistory.vue'
import QrisTagViewer from '../components/QrisTagViewer.vue'
import QrisHistoryDetail from '../components/QrisHistoryDetail.vue'

const { canFeature } = useAccess()
const toast = useToast()
const { result, history, historyLoading, currentPage, totalPages, loadHistory, deleteHistory, clearAllHistory, exportHistory, loadFromHistory, clearResult } = useQris()

const tabs = computed(() =>
  [
    { id: 'generator', label: 'Generator', desc: 'Create QRIS codes', icon: 'qr-code' },
    { id: 'reader', label: 'Reader', desc: 'Analyze existing codes', icon: 'scan-line' },
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

async function onClearHistory() {
  try {
    await clearAllHistory()
    toast.success('History cleared')
  } catch (e) {
    console.warn('[qris] clear history failed', e)
    toast.error('Failed to clear history')
  }
}

async function onExportHistory({ format, mode }) {
  try {
    await exportHistory(format, mode)
    toast.success(`Exported as ${format.toUpperCase()}`)
  } catch (e) {
    console.warn('[qris] export failed', e)
    toast.error('Export failed')
  }
}

async function onPageChange(page) {
  await loadHistory(page)
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
  padding: var(--space-4) var(--space-6);
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  animation: qris-reveal 0.6s var(--ease-enter) both;
}

@keyframes qris-reveal {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}

/* ── Header ── */
.qris__header {
  animation: header-reveal 0.6s var(--ease-enter) both;
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
  gap: var(--space-4);
}

.qris__icon-badge {
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, var(--color-accent), var(--color-accent-strong));
  border-radius: var(--radius-md);
  box-shadow: 0 4px 16px rgba(255, 188, 37, 0.3);
  transition: transform var(--dur-medium) var(--ease-spring);
}

.qris__icon-badge:hover {
  transform: scale(1.08) rotate(-3deg);
}

.qris__icon-badge .li-icon {
  font-size: 26px;
  color: var(--color-bg);
}

.qris__title {
  font-size: 26px;
  font-weight: 800;
  color: var(--color-text);
  margin: 0;
  letter-spacing: -0.5px;
  }

.qris__subtitle {
  font-size: 14px;
  color: var(--color-text-muted);
  margin: 2px 0 0;
  font-weight: 400;
  }

/* ── Tabs ── */
.qris__tabs-wrapper {
  animation: tabs-reveal 0.6s 0.1s var(--ease-enter) both;
}

@keyframes tabs-reveal {
  from { opacity: 0; transform: translateY(-8px); }
  to { opacity: 1; transform: translateY(0); }
}

.qris__tabs {
  display: flex;
  position: relative;
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
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
  border-radius: var(--radius-md);
  background: transparent;
  cursor: pointer;
  transition: all var(--dur-medium) var(--ease-out);
  position: relative;
  z-index: 1;
}

.qris__tab:hover {
  background: var(--color-bg);
}

.qris__tab--active {
  color: var(--color-text);
}

.qris__tab-icon {
  font-size: 22px;
  color: var(--color-text-muted);
  transition:
    color var(--dur-medium) var(--ease-out),
    transform var(--dur-medium) var(--ease-spring);
}

.qris__tab--active .qris__tab-icon {
  color: var(--color-accent);
  transform: scale(1.1);
}

.qris__tab-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text);
  transition: color var(--dur-medium) var(--ease-out);
}

.qris__tab--active .qris__tab-label {
  color: var(--color-text);
}

.qris__tab-desc {
  font-size: 11px;
  color: var(--color-text-placeholder);
  font-weight: 400;
  transition: color var(--dur-medium) var(--ease-out);
}

.qris__tab--active .qris__tab-desc {
  color: var(--color-text-muted);
}

.qris__tab-indicator {
  position: absolute;
  top: 5px;
  height: calc(100% - 10px);
  background: var(--color-bg);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-card);
  transition: all 0.35s var(--ease-spring);
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
  transition: all 0.35s var(--ease-enter);
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
  gap: var(--space-2);
  margin-bottom: var(--space-4);
  padding-bottom: var(--space-3);
  border-bottom: 1px solid var(--color-border-strong);
}

.qris__section-icon {
  font-size: 18px;
  color: var(--color-accent);
}

.qris__section-label {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.8px;
  color: var(--color-text-muted);
  }

/* ── Split Layout ── */
.qris__split {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-6);
  align-items: start;
}

.qris__left,
.qris__right {
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--space-6);
  box-shadow: var(--shadow-card);
  transition: box-shadow var(--dur-long) var(--ease-out);
  animation: card-stagger 0.5s var(--ease-enter) both;
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
  box-shadow: var(--shadow-pop);
}

/* ── Result ── */
.qris__result {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  animation: result-enter 0.4s var(--ease-enter) both;
}

@keyframes result-enter {
  from { opacity: 0; transform: scale(0.96); }
  to { opacity: 1; transform: scale(1); }
}

.qris__qr-wrap {
  display: flex;
  justify-content: center;
  padding: var(--space-6);
  background: var(--color-bg);
  border-radius: var(--radius-lg);
  border: 1px solid var(--color-border);
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
  gap: var(--space-2);
  padding: var(--space-12) var(--space-6);
  text-align: center;
  animation: placeholder-breathe 4s var(--ease-out) infinite alternate;
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
  background: var(--color-surface-2);
  border-radius: var(--radius-lg);
  margin-bottom: var(--space-2);
  animation: placeholder-float 3s var(--ease-out) infinite alternate;
}

@keyframes placeholder-float {
  0% { transform: translateY(0); }
  100% { transform: translateY(-6px); }
}

.qris__placeholder-icon .li-icon {
  font-size: 36px;
  color: var(--color-text-placeholder);
}

.qris__placeholder-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text);
  margin: 0;
  }

.qris__placeholder-desc {
  font-size: 13px;
  color: var(--color-text-placeholder);
  margin: 0;
  max-width: 260px;
  line-height: 1.5;
  }

/* ── History View ── */
.qris__history-view {
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--space-6);
  box-shadow: var(--shadow-card);
  animation: card-stagger 0.5s 0.15s var(--ease-enter) both;
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
    padding: var(--space-3);
    gap: var(--space-3);
  }

  .qris__title {
    font-size: 20px;
  }

  .qris__icon-badge {
    width: 40px;
    height: 40px;
    border-radius: var(--radius-sm);
  }

  .qris__icon-badge .li-icon {
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
    padding: var(--space-4);
    border-radius: var(--radius-lg);
  }

  .qris__history-view {
    padding: var(--space-4);
    border-radius: var(--radius-lg);
  }

  .qris__placeholder {
    padding: var(--space-8) var(--space-4);
  }

  .qris__placeholder-icon {
    width: 56px;
    height: 56px;
  }

  .qris__placeholder-icon .li-icon {
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
