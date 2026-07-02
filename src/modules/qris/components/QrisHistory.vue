<template>
  <div class="hist">
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
          <span class="hist__date">{{ formatDate(entry.created_at) }}</span>
        </div>
        <button class="hist__delete" @click.stop="$emit('delete', entry.id)" title="Delete">
          <span class="material-symbols-outlined">delete</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  history: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
})

defineEmits(['detail', 'delete'])

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
</style>
