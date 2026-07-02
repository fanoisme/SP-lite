<template>
  <div
    class="li-glass-card"
    :class="[
      `li-glass-card--${variant}`,
      `li-glass-card--${size}`,
      { 'li-glass-card--hoverable': hoverable },
    ]"
    :style="cardStyle"
  >
    <slot />
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  variant: { type: String, default: 'light', validator: v => ['light', 'dark', 'accent'].includes(v) },
  size: { type: String, default: 'md', validator: v => ['sm', 'md', 'lg'].includes(v) },
  hoverable: { type: Boolean, default: true },
  radius: { type: String, default: null },
})

const cardStyle = computed(() => ({
  '--li-gc-radius': props.radius || 'var(--radius-lg, 24px)',
}))
</script>

<style scoped>
.li-glass-card {
  position: relative;
  border-radius: var(--li-gc-radius, 24px);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border: 1px solid rgba(0, 0, 0, 0.06);
  /* Only animate composited properties: transform + opacity */
  transition: transform 400ms var(--ease-smooth), opacity 400ms var(--ease-smooth);
}

/* Soft inner glow */
.li-glass-card::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: linear-gradient(180deg, rgba(255,255,255,0.08) 0%, transparent 50%);
  pointer-events: none;
  z-index: 1;
}

.li-glass-card > :deep(*) {
  position: relative;
  z-index: 2;
}

/* Hover: only transform (GPU-composited, no repaints) */
.li-glass-card--hoverable:hover {
  transform: translateY(-3px);
}

/* ── Sizes ── */
.li-glass-card--sm { padding: 16px; }
.li-glass-card--md { padding: 24px; }
.li-glass-card--lg { padding: 32px; }

/* ── Variants (static styles, no transitions) ── */
.li-glass-card--light {
  background: rgba(255, 255, 255, 0.55);
  box-shadow: 0 2px 8px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.02);
}

.li-glass-card--light.li-glass-card--hoverable:hover {
  box-shadow: 0 8px 32px rgba(0,0,0,0.08), 0 16px 48px rgba(0,0,0,0.06);
}

.li-glass-card--dark {
  background: rgba(33, 35, 36, 0.6);
  color: var(--color-gray-0, #FFFFFF);
  border-color: rgba(255, 255, 255, 0.08);
}

.li-glass-card--dark::before {
  background: linear-gradient(180deg, rgba(255,255,255,0.04) 0%, transparent 50%);
}

.li-glass-card--accent {
  background: rgba(255, 175, 3, 0.08);
  border-color: rgba(255, 175, 3, 0.15);
}

@media (prefers-reduced-motion: reduce) {
  .li-glass-card { transition: none; }
  .li-glass-card--hoverable:hover { transform: none; }
}
</style>
