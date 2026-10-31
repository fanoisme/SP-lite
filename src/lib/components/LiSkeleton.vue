<template>
  <div
    :class="['li-skeleton', { 'li-skeleton--circle': circle, 'li-skeleton--text': variant === 'text' }]"
    :style="{ width: width || undefined, height: height || undefined }"
    aria-hidden="true"
  />
</template>

<script setup>
defineProps({
  width: { type: String, default: '' },
  height: { type: String, default: '' },
  circle: { type: Boolean, default: false },
  variant: { type: String, default: 'rect', validator: v => ['rect', 'text', 'circle'].includes(v) },
})
</script>

<style scoped>
/* Allo skeleton (app.css .skel): warm shimmer, slow and low-contrast. */
.li-skeleton {
  display: block;
  border-radius: var(--radius-xs);
  background: linear-gradient(
    90deg,
    var(--color-surface-2) 25%,
    color-mix(in srgb, var(--color-accent-soft) 35%, var(--color-surface-2)) 45%,
    var(--color-surface-2) 65%
  );
  background-size: 300% 100%;
  animation: li-shimmer 1.6s linear infinite;
}

.li-skeleton--circle {
  border-radius: 50%;
}

.li-skeleton--text {
  height: 14px;
  margin-bottom: var(--space-2);
}

.li-skeleton--text:last-child {
  width: 60%;
}

@keyframes li-shimmer {
  from { background-position: 100% 0; }
  to   { background-position: -100% 0; }
}

@media (prefers-reduced-motion: reduce) {
  .li-skeleton { animation: none; }
}
</style>
