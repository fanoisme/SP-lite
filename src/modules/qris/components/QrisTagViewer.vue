<template>
  <div class="tag-viewer">
    <!-- Highlights -->
    <div v-if="highlights" class="tag-viewer__highlights">
      <div v-if="highlights.merchantName" class="tag-viewer__hl-item">
        <span class="tag-viewer__hl-label">Merchant Name</span>
        <span class="tag-viewer__hl-value">{{ highlights.merchantName }}</span>
      </div>
      <div v-if="highlights.mpan" class="tag-viewer__hl-item">
        <span class="tag-viewer__hl-label">MPAN</span>
        <span class="tag-viewer__hl-value tag-viewer__hl-value--mono">{{ highlights.mpan }}</span>
      </div>
      <div v-if="highlights.merchantId" class="tag-viewer__hl-item">
        <span class="tag-viewer__hl-label">Merchant ID</span>
        <span class="tag-viewer__hl-value tag-viewer__hl-value--mono">{{ highlights.merchantId }}</span>
      </div>
      <div v-if="highlights.mpanForMpc" class="tag-viewer__hl-item">
        <span class="tag-viewer__hl-label">MPAN for MPC</span>
        <span class="tag-viewer__hl-value tag-viewer__hl-value--mono">{{ highlights.mpanForMpc }}</span>
      </div>
    </div>

    <!-- QR Value -->
    <div v-if="qrValue" class="tag-viewer__raw">
      <div class="tag-viewer__raw-header">
        <span class="tag-viewer__raw-label">QR Code Value</span>
        <button class="tag-viewer__copy" @click="copyRaw" title="Copy">
          <span class="material-symbols-outlined">{{ copied ? 'check' : 'content_copy' }}</span>
        </button>
      </div>
      <textarea class="tag-viewer__raw-value" readonly :value="qrValue" rows="3"></textarea>
    </div>

    <!-- CRC Status -->
    <div v-if="crcValid !== undefined" class="tag-viewer__crc" :class="crcValid ? 'tag-viewer__crc--ok' : 'tag-viewer__crc--fail'">
      <span class="material-symbols-outlined">{{ crcValid ? 'check_circle' : 'error' }}</span>
      <span>CRC {{ crcValid ? 'Valid' : 'Invalid' }}</span>
      <span v-if="!crcValid" class="tag-viewer__crc-detail">
        (expected: {{ crcComputed }}, got: {{ crcProvided }})
      </span>
    </div>

    <!-- Tag Table -->
    <div v-if="tags && tags.length" class="tag-viewer__table-wrap">
      <table class="tag-viewer__table">
        <thead>
          <tr>
            <th>Tag</th>
            <th>Name</th>
            <th>Value</th>
            <th>Len</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="tag in tags"
            :key="tag.id"
            class="tag-viewer__row"
            :class="{ 'tag-viewer__row--hl': isHighlight(tag.id) }"
          >
            <td class="tag-viewer__cell-id">{{ tag.id }}</td>
            <td class="tag-viewer__cell-name">{{ tag.name }}</td>
            <td class="tag-viewer__cell-value">
              <span class="tag-viewer__value-text">{{ tag.value }}</span>
            </td>
            <td class="tag-viewer__cell-len">{{ tag.length }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const props = defineProps({
  qrValue: String,
  tags: Array,
  highlights: Object,
  crcValid: Boolean,
  crcProvided: String,
  crcComputed: String,
})

const copied = ref(false)

const HL_TAGS = ['59', '26/01', '26/02', '26/00']

function isHighlight(tagId) {
  if (!props.highlights) return false
  if (tagId === '59') return true // Merchant Name
  if (tagId === '26/01') return true // MPAN
  if (tagId === '26/02') return true // Merchant ID
  return false
}

function copyRaw() {
  if (!props.qrValue) return
  navigator.clipboard.writeText(props.qrValue)
  copied.value = true
  setTimeout(() => { copied.value = false }, 2000)
}
</script>

<style scoped>
.tag-viewer {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* ── Highlights ── */
.tag-viewer__highlights {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.tag-viewer__hl-item {
  padding: 12px 14px;
  background: rgba(255, 188, 37, 0.06);
  border: 1px solid rgba(255, 188, 37, 0.15);
  border-radius: var(--radius-md, 16px);
}

.tag-viewer__hl-label {
  display: block;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--color-gray-500, #999);
  margin-bottom: 4px;
}

.tag-viewer__hl-value {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-gray-900, #333);
  word-break: break-all;
}

.tag-viewer__hl-value--mono {
  font-family: 'SF Mono', 'Fira Code', monospace;
  font-size: 12px;
  letter-spacing: 0.5px;
}

/* ── Raw Value ── */
.tag-viewer__raw {
  background: rgba(255, 255, 255, 0.55);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: var(--radius-md, 16px);
  padding: 12px;
}

.tag-viewer__raw-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.tag-viewer__raw-label {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--color-gray-500, #999);
}

.tag-viewer__copy {
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px;
  border-radius: var(--radius-xs, 8px);
  color: var(--color-gray-400, #B3B3B3);
  transition: color 200ms;
}

.tag-viewer__copy:hover {
  color: var(--color-gray-700, #666);
}

.tag-viewer__copy .material-symbols-outlined {
  font-size: 16px;
}

.tag-viewer__raw-value {
  width: 100%;
  border: none;
  background: transparent;
  font-family: 'SF Mono', 'Fira Code', monospace;
  font-size: 11px;
  line-height: 1.5;
  color: var(--color-gray-700, #666);
  resize: none;
  outline: none;
}

/* ── CRC Status ── */
.tag-viewer__crc {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  border-radius: var(--radius-xs, 8px);
  font-size: 12px;
  font-weight: 600;
}

.tag-viewer__crc--ok {
  background: var(--color-success-container, #ECFF8F);
  color: var(--color-on-success-container, #17A3E6);
}

.tag-viewer__crc--fail {
  background: var(--color-error-container, #FDECEE);
  color: var(--color-on-error-container, #A33129);
}

.tag-viewer__crc .material-symbols-outlined {
  font-size: 16px;
}

.tag-viewer__crc-detail {
  font-weight: 400;
  opacity: 0.8;
}

/* ── Tag Table ── */
.tag-viewer__table-wrap {
  background: rgba(255, 255, 255, 0.55);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: var(--radius-md, 16px);
  overflow: hidden;
  overflow-x: auto;
}

.tag-viewer__table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
  min-width: 400px;
}

.tag-viewer__table thead {
  background: rgba(0, 0, 0, 0.02);
}

.tag-viewer__table th {
  padding: 10px 12px;
  text-align: left;
  font-weight: 700;
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--color-gray-500, #999);
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
}

.tag-viewer__table td {
  padding: 8px 12px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.03);
  color: var(--color-gray-700, #666);
}

.tag-viewer__table tr:last-child td {
  border-bottom: none;
}

.tag-viewer__row--hl {
  background: rgba(255, 188, 37, 0.06);
}

.tag-viewer__row--hl td {
  color: var(--color-gray-900, #333);
  font-weight: 600;
}

.tag-viewer__cell-id {
  font-family: 'SF Mono', 'Fira Code', monospace;
  font-weight: 600;
  color: var(--color-gray-400, #B3B3B3);
  width: 60px;
}

.tag-viewer__row--hl .tag-viewer__cell-id {
  color: var(--cta-primary-bg, #FFBC25);
}

.tag-viewer__cell-name {
  width: 200px;
  white-space: nowrap;
}

.tag-viewer__cell-value {
  max-width: 300px;
}

.tag-viewer__value-text {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: 'SF Mono', 'Fira Code', monospace;
  font-size: 11px;
}

.tag-viewer__cell-len {
  width: 50px;
  text-align: center;
  font-family: 'SF Mono', 'Fira Code', monospace;
  color: var(--color-gray-400, #B3B3B3);
}
</style>
