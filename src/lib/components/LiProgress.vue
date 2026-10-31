<template>
  <div :class="['li-progress', { 'li-progress--indeterminate': indeterminate }]" role="progressbar" :aria-valuenow="indeterminate ? undefined : clampedValue" :aria-valuemin="0" :aria-valuemax="100" :aria-label="label || undefined">
    <div class="li-progress__track">
      <div
        :class="['li-progress__fill', `li-progress__fill--${variant}`]"
        :style="{ width: indeterminate ? '40%' : `${clampedValue}%` }"
      />
    </div>
    <span v-if="showValue && !indeterminate" class="li-progress__value">{{ clampedValue }}%</span>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  value: { type: Number, default: 0 },
  variant: { type: String, default: 'brand', validator: v => ['brand', 'success', 'warning', 'error', 'info'].includes(v) },
  indeterminate: { type: Boolean, default: false },
  showValue: { type: Boolean, default: false },
  label: { type: String, default: '' },
})

const clampedValue = computed(() => Math.max(0, Math.min(100, props.value)))
</script>

<style scoped>
/* Allo progress (app.css .progress): accent-soft track, accent-strong fill, one sheen. */
.li-progress {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.li-progress__track {
  flex: 1;
  position: relative;
  height: 6px;
  background: var(--color-accent-soft);
  border-radius: var(--radius-xs);
  overflow: hidden;
}

.li-progress__fill {
  position: absolute;
  inset: 0 auto 0 0;
  border-radius: var(--radius-xs);
  transition: width 900ms var(--ease-enter);
}

.li-progress__fill--brand   { background: var(--color-accent-strong); }
.li-progress__fill--success { background: var(--color-success); }
.li-progress__fill--warning { background: var(--color-warning); }
.li-progress__fill--error   { background: var(--color-danger); }
.li-progress__fill--info    { background: var(--color-info); }

.li-progress--indeterminate .li-progress__fill {
  animation: li-progress-indeterminate 1.5s ease-in-out infinite;
}

@keyframes li-progress-indeterminate {
  0%   { transform: translateX(-100%); }
  50%  { transform: translateX(150%); }
  100% { transform: translateX(350%); }
}

.li-progress__value {
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--color-text-muted);
  min-width: 32px;
  text-align: right;
  flex-shrink: 0;
  font-variant-numeric: tabular-nums;
}
</style>
