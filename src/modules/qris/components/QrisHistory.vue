<template>
  <div class="hist">
    <!-- Toolbar -->
    <div v-if="history.length > 0 || !loading" class="hist__toolbar">
      <button class="hist__btn hist__btn--clear" @click="showClearConfirm = true">
        <span class="material-symbols-outlined">delete_sweep</span>
        Clear History
      </button>

      <div class="hist__export-wrap" ref="exportWrap">
        <button class="hist__btn hist__btn--export" @click.stop="toggleExportMenu">
          <span class="material-symbols-outlined">download</span>
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
      <span class="material-symbols-outlined">history</span>
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
        <button class="hist__delete" @click.stop="$emit('delete', entry.id)" title="Delete">
          <span class="material-symbols-outlined">delete</span>
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
  color: var(--color-gray-400, #B3B3B3);
  font-size: 13px;
}

.hist__empty .material-symbols-outlined {
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
  background: rgba(255, 255, 255, 0.55);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: var(--radius-md, 16px);
  cursor: pointer;
  transition: transform 200ms var(--ease-out);
}

.hist__item:hover {
  transform: translateX(4px);
}

.hist__qr {
  width: 48px;
  height: 48px;
  border-radius: var(--radius-xs, 8px);
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
  color: var(--color-gray-900, #333);
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
  color: var(--color-gray-700, #666);
}

.hist__mid {
  font-size: 11px;
  font-family: 'SF Mono', 'Fira Code', monospace;
  color: var(--color-gray-400, #B3B3B3);
}

.hist__type-badge {
  display: inline-block;
  padding: 1px 6px;
  border-radius: var(--radius-pill, 999px);
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

.hist__type-badge--emvco {
  background: var(--color-info-container, #E6E6FF);
  color: var(--color-on-info-container, #0047B2);
}

.hist__type-badge--proprietary {
  background: var(--color-warning-container, #FFF3D6);
  color: var(--color-on-warning-container, #FF3000);
}

.hist__date {
  font-size: 11px;
  color: var(--color-gray-400, #B3B3B3);
}

.hist__delete {
  background: none;
  border: none;
  cursor: pointer;
  padding: 6px;
  border-radius: var(--radius-xs, 8px);
  color: var(--color-gray-400, #B3B3B3);
  transition: all 200ms;
  flex-shrink: 0;
}

.hist__delete:hover {
  color: var(--color-red-400, #C83E3B);
  background: rgba(200, 62, 59, 0.06);
}

.hist__delete .material-symbols-outlined {
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
  border-radius: var(--radius-xs, 8px);
  background: var(--color-gray-200, #E6E6E6);
  animation: hist-shimmer 1.5s infinite;
  flex-shrink: 0;
}

.hist__skel-line {
  border-radius: 4px;
  background: var(--color-gray-200, #E6E6E6);
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
  border-radius: var(--radius-pill, 999px);
  font-family: var(--font-body, 'Inter', sans-serif);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 200ms;
  background: transparent;
}

.hist__btn .material-symbols-outlined {
  font-size: 16px;
}

.hist__btn--clear {
  color: var(--color-red-400, #C83E3B);
  border-color: rgba(200, 62, 59, 0.25);
}

.hist__btn--clear:hover {
  background: rgba(200, 62, 59, 0.06);
}

.hist__btn--export {
  color: var(--color-gray-700, #666);
  border-color: rgba(0, 0, 0, 0.1);
}

.hist__btn--export:hover {
  background: rgba(0, 0, 0, 0.04);
}

.hist__btn--cancel {
  color: var(--color-gray-700, #666);
  border-color: rgba(0, 0, 0, 0.1);
}

.hist__btn--cancel:hover {
  background: rgba(0, 0, 0, 0.04);
}

.hist__btn--confirm-clear {
  color: #fff;
  background: var(--color-red-400, #C83E3B);
  border-color: var(--color-red-400, #C83E3B);
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
  background: #fff;
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: var(--radius-sm, 12px);
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
  color: var(--color-gray-400, #B3B3B3);
  padding: 4px 8px 2px;
  letter-spacing: 0.5px;
}

.hist__export-item {
  border: none;
  background: transparent;
  padding: 6px 10px;
  font-family: var(--font-body, 'Inter', sans-serif);
  font-size: 13px;
  color: var(--color-gray-900, #333);
  text-align: left;
  border-radius: var(--radius-xs, 8px);
  cursor: pointer;
  transition: background 150ms;
}

.hist__export-item:hover {
  background: var(--color-gray-100, #F2F2F2);
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
  color: var(--color-gray-400, #B3B3B3);
}

.hist__expiry--warn {
  color: var(--color-red-400, #C83E3B);
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
  color: var(--color-gray-700, #666);
  line-height: 1.6;
  margin: 0;
}
</style>
