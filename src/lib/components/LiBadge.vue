<template>
  <span :class="['li-badge', `li-badge-${variant}`, `li-badge-${size}`]">
    <span v-if="$slots.iconLeft" class="li-badge-icon">
      <slot name="iconLeft"></slot>
    </span>
    <span class="li-badge-label">
      <slot>{{ label }}</slot>
    </span>
    <span v-if="$slots.iconRight" class="li-badge-icon">
      <slot name="iconRight"></slot>
    </span>
  </span>
</template>

<script setup>
defineProps({
  label: String,
  variant: {
    type: String,
    default: 'neutral',
    // Allo status tones (APP.md §2); brand = accent tone
    validator: (v) => ['neutral', 'info', 'discovery', 'success', 'warning', 'error', 'brand'].includes(v)
  },
  size: {
    type: String,
    default: 'md',
    validator: (v) => ['sm', 'md'].includes(v)
  },
  isPill: {
    type: Boolean,
    default: false
  }
});
</script>

<style scoped>
/* Allo status lozenge (app.css .loz): tone text on tone -soft, radius 3, no border. */
.li-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 20px;
  width: fit-content;
  padding: 0 6px;
  border-radius: var(--radius-xs);
  font-weight: 700;
  letter-spacing: 0.04em;
  line-height: 1;
  text-transform: uppercase;
  white-space: nowrap;
  transition: background var(--dur-medium) var(--ease-move), color var(--dur-medium) var(--ease-move);
}

.li-badge-sm { font-size: 10px; height: 18px; }
.li-badge-md { font-size: var(--text-micro); }

.li-badge-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.li-badge-icon :deep(svg) {
  width: 12px;
  height: 12px;
}

/* Status tones */
.li-badge-neutral { background: var(--color-neutral-soft); color: var(--color-text); }
.li-badge-info { background: var(--color-info-soft); color: var(--color-info); }
.li-badge-discovery { background: var(--color-discovery-soft); color: var(--color-discovery); }
.li-badge-success { background: var(--color-success-soft); color: var(--color-success); }
.li-badge-warning { background: var(--color-warning-soft); color: var(--color-warning); }
.li-badge-error { background: var(--color-danger-soft); color: var(--color-danger); }
.li-badge-brand { background: var(--color-accent-soft); color: var(--color-accent-text); }
</style>
