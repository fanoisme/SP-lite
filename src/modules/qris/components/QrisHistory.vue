<template>
  <div class="hist">
    <!-- Toolbar -->
    <div v-if="history.length > 0 || !loading" class="hist__toolbar">
      <button class="hist__btn hist__btn--clear" @click="showClearConfirm = true">
        <LiIcon name="eraser" />
        Clear History
      </button>

      <div class="hist__export-wrap" ref="exportWrap">
        <button class="hist__btn hist__btn--export" @click.stop="toggleExportMenu">
          <LiIcon name="download" />
          Export
        </button>
        <div v-if="exportOpen" class="hist__export-menu">
          <div class="hist__export-section-label">CSV</div>
          <button class="hist__export-item" @click="doExport('csv', 'simple')">Simple</button>
          <button class="hist__export-item" @click="doExport('csv', 'full')">Full</button>
          <div class="hist__export-divider"></div>
          <div class="hist__export-section-label">HTML</div>
          <button class="hist__export-item" @click="doExport('html', 'simple')">Simple</button>
          <button class="hist__export-item" @click="doExport('html', 'full')">Full</button>
        </div>
      </div>
    </div>

    <!-- Loading skeletons -->
    <div v-if="loading" class="hist__list">
      <div v-for="i in 5" :key="'skel-' + i" class="hist__item hist__item--skeleton">
        <div class="hist__qr-skel"></div>
        <div class="hist__info">
          <div class="hist__skel-line hist__skel-line--name"></div>
          <div class="hist__skel-line hist__skel-line--meta"></div>
          <div class="hist__skel-line hist__skel-line--date"></div>
        </div>
      </div>
    </div>

    <div v-else-if="history.length === 0" class="hist__empty">
      <LiIcon name="history" />
      <p>No history yet. Generate or parse a QRIS to see it here.</p>
    </div>

    <div v-else class="hist__list">
      <div
        v-for="entry in history"
        :key="entry.id"
        class="hist__item"
        @click="$emit('detail', entry)"
      >
        <img v-if="entry.qr_data_url" :src="entry.qr_data_url" alt="QR" class="hist__qr" />
        <div class="hist__info">
          <span class="hist__name">{{ entry.merchant_name || 'Unknown' }}</span>
          <span class="hist__meta">
            <span v-if="entry.amount" class="hist__amount">Rp {{ Number(entry.amount).toLocaleString('id-ID') }}</span>
            <span v-if="entry.merchant_id" class="hist__mid">{{ entry.merchant_id }}</span>
            <span class="hist__type-badge" :class="'hist__type-badge--' + (entry.type || 'emvco')">
              {{ (entry.type || 'emvco').toUpperCase() }}
            </span>
          </span>
          <span class="hist__date-row">
            <span class="hist__date">{{ formatDate(entry.created_at) }}</span>
            <span class="hist__expiry" :class="expiryClass(entry.created_at)">
              &middot; {{ expiryLabel(entry.created_at) }}
            </span>
          </span>
        </div>
        <button class="hist__delete" aria-label="Delete history entry" @click.stop="$emit('delete', entry.id)" title="Delete">
          <LiIcon name="trash-2" />
        </button>
      </div>
    </div>

    <!-- Pagination -->
    <div v-if="totalPages > 1" class="hist__pagination">
      <LiPagination v-model="localPage" :totalPages="totalPages" />
    </div>

    <!-- Clear Confirm Modal -->
    <LiModal v-if="showClearConfirm" :modelValue="true" title="Clear All History" size="sm"
             @update:modelValue="showClearConfirm = false">
      <p class="hist__confirm-text">
        This will permanently delete all your QR scan history.
        This action cannot be undone.
      </p>
      <template #footer>
        <button class="hist__btn hist__btn--cancel" @click="showClearConfirm = false">Cancel</button>
        <button class="hist__btn hist__btn--confirm-clear" @click="confirmClear">Clear All</button>
      </template>
    </LiModal>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, onUnmounted } from 'vue'
import LiModal from '@lib/components/LiModal.vue'
import LiPagination from '@lib/components/LiPagination.vue'

const props = defineProps({
  history: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  currentPage: { type: Number, default: 1 },
  totalPages: { type: Number, default: 1 },
})

const emit = defineEmits(['detail', 'delete', 'clear', 'export', 'update:currentPage'])

const showClearConfirm = ref(false)
const exportOpen = ref(false)
const exportWrap = ref(null)

// Two-way page binding for LiPagination (v-model)
const localPage = ref(props.currentPage)

// Sync parent → local when page changes (e.g. on new load)
watch(() => props.currentPage, (v) => { localPage.value = v })

// Sync local → parent on user click
watch(localPage, (v) => {
  if (v !== props.currentPage && v >= 1 && v <= props.totalPages) {
    emit('update:currentPage', v)
  }
})

// ── Export ──

function toggleExportMenu() {
  exportOpen.value = !exportOpen.value
}

function doExport(format, mode) {
  exportOpen.value = false
  emit('export', { format, mode })
}

// Close export menu when clicking outside
function onDocClick(e) {
  if (exportWrap.value && !exportWrap.value.contains(e.target)) {
    exportOpen.value = false
  }
}

onMounted(() => { document.addEventListener('click', onDocClick) })
onUnmounted(() => { document.removeEventListener('click', onDocClick) })

// ── Clear ──

function confirmClear() {
  showClearConfirm.value = false
  emit('clear')
}

// ── Dates ──

function formatDate(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  const now = new Date()
  const diff = now - d
  if (diff < 60000) return 'Just now'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function expiryDaysLeft(dateStr) {
  if (!dateStr) return 0
  const expiredDate = new Date(new Date(dateStr).getTime() + 14 * 86400000)
  return Math.ceil((expiredDate - Date.now()) / 86400000)
}

function expiryLabel(dateStr) {
  const days = expiryDaysLeft(dateStr)
  if (days <= 0) return 'Expires today'
  if (days === 1) return 'Expires tomorrow'
  return `Expires in ${days}d`
}

function expiryClass(dateStr) {
  const days = expiryDaysLeft(dateStr)
  if (days <= 1) return 'hist__expiry--warn'
  return ''
}
</script>

<style scoped>
.hist__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 40px;
  color: var(--color-text-placeholder);
  font-size: 13px;
}

.hist__empty .li-icon {
  font-size: 32px;
}

.hist__list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.hist__item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: var(--color-bg);
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-lg);
  cursor: pointer;
  transition: transform 200ms var(--ease-out);
}

.hist__item:hover {
  transform: translateX(4px);
}

.hist__qr {
  width: 48px;
  height: 48px;
  border-radius: var(--radius-sm);
  object-fit: contain;
  flex-shrink: 0;
}

.hist__info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.hist__name {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-strong);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.hist__meta {
  display: flex;
  gap: 8px;
  align-items: center;
}

.hist__amount {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text);
}

.hist__mid {
  font-size: 11px;
  font-family: 'SF Mono', 'Fira Code', monospace;
  color: var(--color-text-placeholder);
}

.hist__type-badge {
  display: inline-block;
  padding: 1px 6px;
  border-radius: var(--radius-pill);
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

.hist__type-badge--emvco {
  background: var(--color-info-soft);
  color: var(--color-info);
}

.hist__type-badge--proprietary {
  background: var(--color-warning-soft);
  color: var(--color-warning);
}

.hist__date {
  font-size: 11px;
  color: var(--color-text-placeholder);
}

.hist__delete {
  background: none;
  border: none;
  cursor: pointer;
  padding: 6px;
  border-radius: var(--radius-sm);
  color: var(--color-text-placeholder);
  transition: all 200ms;
  flex-shrink: 0;
}

.hist__delete:hover {
  color: var(--color-danger);
  background: rgba(200, 62, 59, 0.06);
}

.hist__delete .li-icon {
  font-size: 16px;
}

/* ── Skeleton ── */
.hist__item--skeleton {
  cursor: default;
  pointer-events: none;
}

.hist__item--skeleton:hover {
  transform: none;
}

.hist__qr-skel {
  width: 48px;
  height: 48px;
  border-radius: var(--radius-sm);
  background: var(--color-border);
  animation: hist-shimmer 1.5s infinite;
  flex-shrink: 0;
}

.hist__skel-line {
  border-radius: 4px;
  background: var(--color-border);
  animation: hist-shimmer 1.5s infinite;
}

.hist__skel-line--name {
  width: 120px;
  height: 14px;
}

.hist__skel-line--meta {
  width: 80px;
  height: 12px;
  margin-top: 4px;
}

.hist__skel-line--date {
  width: 60px;
  height: 11px;
  margin-top: 4px;
}

@keyframes hist-shimmer {
  0% { opacity: 1; }
  50% { opacity: 0.4; }
  100% { opacity: 1; }
}

/* ── Toolbar ── */
.hist__toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.hist__btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border: 1px solid transparent;
  border-radius: var(--radius-pill);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 200ms;
  background: transparent;
}

.hist__btn .li-icon {
  font-size: 16px;
}

.hist__btn--clear {
  color: var(--color-danger);
  border-color: rgba(200, 62, 59, 0.25);
}

.hist__btn--clear:hover {
  background: rgba(200, 62, 59, 0.06);
}

.hist__btn--export {
  color: var(--color-text);
  border-color: var(--color-border-strong);
}

.hist__btn--export:hover {
  background: var(--color-border);
}

.hist__btn--cancel {
  color: var(--color-text);
  border-color: var(--color-border-strong);
}

.hist__btn--cancel:hover {
  background: var(--color-border);
}

.hist__btn--confirm-clear {
  color: var(--color-bg);
  background: var(--color-danger);
  border-color: var(--color-danger);
}

.hist__btn--confirm-clear:hover {
  opacity: 0.9;
}

/* ── Export Dropdown ── */
.hist__export-wrap {
  position: relative;
}

.hist__export-menu {
  position: absolute;
  right: 0;
  top: calc(100% + 6px);
  min-width: 120px;
  background: var(--color-bg);
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-md);
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.12);
  padding: 6px;
  z-index: 100;
  display: flex;
  flex-direction: column;
}

.hist__export-section-label {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--color-text-placeholder);
  padding: 4px 8px 2px;
  letter-spacing: 0.5px;
}

.hist__export-item {
  border: none;
  background: transparent;
  padding: 6px 10px;
  font-size: 13px;
  color: var(--color-text-strong);
  text-align: left;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: background 150ms;
}

.hist__export-item:hover {
  background: var(--color-surface-2);
}

.hist__export-divider {
  height: 1px;
  background: rgba(0, 0, 0, 0.06);
  margin: 4px 6px;
}

/* ── Expiry ── */
.hist__date-row {
  display: flex;
  align-items: center;
  gap: 4px;
}

.hist__expiry {
  font-size: 10px;
  color: var(--color-text-placeholder);
}

.hist__expiry--warn {
  color: var(--color-danger);
  font-weight: 600;
}

/* ── Pagination ── */
.hist__pagination {
  margin-top: 16px;
  padding-top: 12px;
  border-top: 1px solid rgba(0, 0, 0, 0.06);
}

/* ── Confirm Modal Text ── */
.hist__confirm-text {
  font-size: 14px;
  color: var(--color-text);
  line-height: 1.6;
  margin: 0;
}
</style>
