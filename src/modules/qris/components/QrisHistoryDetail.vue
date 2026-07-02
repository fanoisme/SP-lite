<template>
  <LiModal :modelValue="!!entry" @update:modelValue="$emit('close')" title="QRIS Detail" size="lg">
    <div v-if="loading" class="detail__loading">
      <div class="detail__spinner"></div>
      <span>Loading detail...</span>
    </div>

    <div v-else-if="detail" class="detail">
      <!-- QR Image + Highlights side by side -->
      <div class="detail__top">
        <div class="detail__qr-wrap">
          <img v-if="detail.qr_data_url" :src="detail.qr_data_url" alt="QR Code" class="detail__qr-img" />
        </div>
        <div class="detail__highlights">
          <div v-if="detail.merchant_name" class="detail__hl-item">
            <span class="detail__hl-label">Merchant Name</span>
            <span class="detail__hl-value">{{ detail.merchant_name }}</span>
          </div>
          <div v-if="detail.mpan" class="detail__hl-item">
            <span class="detail__hl-label">MPAN</span>
            <span class="detail__hl-value detail__hl-value--mono">{{ detail.mpan }}</span>
          </div>
          <div v-if="detail.merchant_id" class="detail__hl-item">
            <span class="detail__hl-label">Merchant ID</span>
            <span class="detail__hl-value detail__hl-value--mono">{{ detail.merchant_id }}</span>
          </div>
          <div v-if="detail.amount" class="detail__hl-item">
            <span class="detail__hl-label">Amount</span>
            <span class="detail__hl-value">Rp {{ Number(detail.amount).toLocaleString('id-ID') }}</span>
          </div>
          <div class="detail__hl-item">
            <span class="detail__hl-label">Type</span>
            <span class="detail__hl-value">
              <span class="detail__type-badge" :class="'detail__type-badge--' + (detail.type || 'emvco')">
                {{ (detail.type || 'emvco').toUpperCase() }}
              </span>
            </span>
          </div>
          <div v-if="detail.crcValid !== undefined" class="detail__hl-item">
            <span class="detail__hl-label">CRC Status</span>
            <span class="detail__hl-value" :class="detail.crcValid ? 'detail__hl-value--valid' : 'detail__hl-value--invalid'">
              {{ detail.crcValid ? '✓ Valid' : '✗ Invalid' }}
            </span>
          </div>
        </div>
      </div>

      <!-- Raw Value -->
      <div class="detail__section">
        <h4 class="detail__section-title">Raw QR Value</h4>
        <div class="detail__raw-wrap">
          <code class="detail__raw">{{ detail.qr_value }}</code>
          <button class="detail__copy-btn" @click="copyRaw" :title="copied ? 'Copied!' : 'Copy'">
            <span class="material-symbols-outlined">{{ copied ? 'check' : 'content_copy' }}</span>
          </button>
        </div>
      </div>

      <!-- Tag Table -->
      <div v-if="detail.tags && detail.tags.length > 0" class="detail__section">
        <h4 class="detail__section-title">Tag Breakdown</h4>
        <div class="detail__tags-table">
          <div class="detail__tags-header">
            <span>Tag</span>
            <span>Name</span>
            <span>Value</span>
            <span>Len</span>
          </div>
          <div v-for="tag in detail.tags" :key="tag.id" class="detail__tags-row">
            <span class="detail__tag-id">{{ tag.id }}</span>
            <span class="detail__tag-name">{{ tag.name }}</span>
            <span class="detail__tag-value">{{ tag.value }}</span>
            <span class="detail__tag-len">{{ tag.length }}</span>
          </div>
        </div>
      </div>

      <!-- Timestamp -->
      <div class="detail__footer">
        <span class="detail__date">{{ formatDate(detail.created_at) }}</span>
      </div>
    </div>

    <template #footer>
      <button class="detail__action-btn" @click="$emit('load-to-generator', detail)">
        <span class="material-symbols-outlined">edit</span>
        Load to Generator
      </button>
    </template>
  </LiModal>
</template>

<script setup>
import { ref, watch } from 'vue'
import LiModal from '@lib/components/LiModal.vue'
import { useQris } from '../composables/useQris.js'

const props = defineProps({
  entry: { type: Object, default: null },
})

const emit = defineEmits(['close', 'load-to-generator'])

const { loadHistoryDetail } = useQris()
const detail = ref(null)
const loading = ref(false)
const copied = ref(false)

watch(() => props.entry, async (entry) => {
  if (!entry) {
    detail.value = null
    return
  }

  // If entry already has full detail (tags), use it directly
  if (entry.tags) {
    detail.value = entry
    return
  }

  loading.value = true
  try {
    const data = await loadHistoryDetail(entry.id)
    detail.value = data
  } catch {
    detail.value = entry // fallback to basic entry
  } finally {
    loading.value = false
  }
})

function copyRaw() {
  if (!detail.value?.qr_value) return
  navigator.clipboard.writeText(detail.value.qr_value)
  copied.value = true
  setTimeout(() => { copied.value = false }, 2000)
}

function formatDate(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return d.toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}
</script>

<style scoped>
.detail {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.detail__loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 40px;
  color: var(--color-gray-500, #999);
  font-size: 14px;
}

.detail__spinner {
  width: 20px;
  height: 20px;
  border: 2px solid var(--color-gray-200, #E6E6E6);
  border-bottom-color: transparent;
  border-radius: 50%;
  animation: detail-spin 600ms linear infinite;
}

@keyframes detail-spin {
  to { transform: rotate(360deg); }
}

/* ── Top: QR + Highlights ── */
.detail__top {
  display: grid;
  grid-template-columns: 200px 1fr;
  gap: 20px;
  align-items: start;
}

.detail__qr-wrap {
  background: rgba(255, 255, 255, 0.6);
  border-radius: var(--radius-md, 16px);
  padding: 12px;
  display: flex;
  justify-content: center;
}

.detail__qr-img {
  width: 176px;
  height: 176px;
  object-fit: contain;
}

.detail__highlights {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.detail__hl-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.detail__hl-label {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--color-gray-500, #999);
}

.detail__hl-value {
  font-size: 14px;
  font-weight: 500;
  color: var(--color-gray-900, #333);
}

.detail__hl-value--mono {
  font-family: 'SF Mono', 'Fira Code', monospace;
  font-size: 13px;
}

.detail__hl-value--valid {
  color: var(--color-success, #10B981);
  font-weight: 600;
}

.detail__hl-value--invalid {
  color: var(--color-error, #C83E3B);
  font-weight: 600;
}

.detail__type-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: var(--radius-pill, 999px);
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

.detail__type-badge--emvco {
  background: var(--color-info-container, #E6E6FF);
  color: var(--color-on-info-container, #0047B2);
}

.detail__type-badge--proprietary {
  background: var(--color-warning-container, #FFF3D6);
  color: var(--color-on-warning-container, #FF3000);
}

/* ── Section ── */
.detail__section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.detail__section-title {
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--color-gray-500, #999);
  margin: 0;
}

/* ── Raw Value ── */
.detail__raw-wrap {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  background: var(--color-gray-100, #F2F2F2);
  border-radius: var(--radius-xs, 8px);
  padding: 12px;
}

.detail__raw {
  flex: 1;
  font-family: 'SF Mono', 'Fira Code', monospace;
  font-size: 11px;
  line-height: 1.6;
  word-break: break-all;
  color: var(--color-gray-700, #666);
  margin: 0;
  white-space: pre-wrap;
}

.detail__copy-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  color: var(--color-gray-400, #B3B3B3);
  transition: all 200ms;
  flex-shrink: 0;
}

.detail__copy-btn:hover {
  color: var(--color-gray-700, #666);
  background: rgba(0, 0, 0, 0.05);
}

.detail__copy-btn .material-symbols-outlined {
  font-size: 16px;
}

/* ── Tags Table ── */
.detail__tags-table {
  border: 1px solid var(--color-gray-200, #E6E6E6);
  border-radius: var(--radius-xs, 8px);
  overflow: hidden;
  font-size: 12px;
}

.detail__tags-header {
  display: grid;
  grid-template-columns: 60px 1fr 1fr 50px;
  gap: 8px;
  padding: 8px 12px;
  background: var(--color-gray-100, #F2F2F2);
  font-weight: 700;
  color: var(--color-gray-600, #888);
  text-transform: uppercase;
  font-size: 10px;
  letter-spacing: 0.5px;
}

.detail__tags-row {
  display: grid;
  grid-template-columns: 60px 1fr 1fr 50px;
  gap: 8px;
  padding: 6px 12px;
  border-top: 1px solid var(--color-gray-100, #F2F2F2);
  color: var(--color-gray-700, #666);
}

.detail__tags-row:hover {
  background: rgba(0, 0, 0, 0.02);
}

.detail__tag-id {
  font-family: 'SF Mono', 'Fira Code', monospace;
  font-weight: 600;
  color: var(--color-gray-900, #333);
}

.detail__tag-name {
  color: var(--color-gray-600, #888);
  font-size: 11px;
}

.detail__tag-value {
  font-family: 'SF Mono', 'Fira Code', monospace;
  font-size: 11px;
  word-break: break-all;
}

.detail__tag-len {
  text-align: center;
  color: var(--color-gray-400, #B3B3B3);
}

/* ── Footer ── */
.detail__footer {
  display: flex;
  justify-content: flex-end;
}

.detail__date {
  font-size: 12px;
  color: var(--color-gray-400, #B3B3B3);
}

/* ── Action Button ── */
.detail__action-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  background: var(--cta-primary-bg, #FFBC25);
  color: var(--cta-primary-text, #1E1E1E);
  border: none;
  border-radius: var(--radius-pill, 999px);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: transform 200ms var(--ease-out);
  font-family: var(--font-body, 'Inter', sans-serif);
}

.detail__action-btn:hover {
  transform: translateY(-1px);
}

.detail__action-btn .material-symbols-outlined {
  font-size: 16px;
}

@media (max-width: 600px) {
  .detail__top {
    grid-template-columns: 1fr;
  }

  .detail__qr-wrap {
    justify-content: center;
  }
}
</style>
