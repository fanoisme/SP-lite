<template>
  <span
    :class="['li-spinner', `li-spinner--${size}`, { 'li-spinner--inline': inline }]"
    :style="{ color: colorMap[variant] || 'inherit' }"
    role="status"
    :aria-label="label || 'Loading'"
  >
    <span class="li-spinner__arc" />
    <span v-if="label" class="li-spinner__label">{{ label }}</span>
  </span>
</template>

<script setup>
defineProps({
  size: { type: String, default: 'md', validator: v => ['xs', 'sm', 'md', 'lg', 'xl'].includes(v) },
  variant: { type: String, default: 'brand', validator: v => ['brand', 'neutral', 'inverse'].includes(v) },
  inline: { type: Boolean, default: false },
  label: { type: String, default: '' },
})

const colorMap = {
  brand: 'var(--color-accent-strong)',
  neutral: 'var(--color-text-muted)',
  inverse: 'var(--color-on-inverse)',
}
</script>

<style scoped>
/* Allo spinner (app.css .spinner): currentColor ring, one transparent quarter. */
.li-spinner {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
}

.li-spinner--inline {
  flex-direction: row;
}

.li-spinner__arc {
  display: block;
  border-radius: 50%;
  border: 2px solid currentColor;
  border-right-color: transparent;
  animation: li-spin 0.7s linear infinite;
}

.li-spinner--xs .li-spinner__arc { width: 12px; height: 12px; }
.li-spinner--sm .li-spinner__arc { width: 16px; height: 16px; }
.li-spinner--md .li-spinner__arc { width: 24px; height: 24px; }
.li-spinner--lg .li-spinner__arc { width: 32px; height: 32px; }
.li-spinner--xl .li-spinner__arc { width: 48px; height: 48px; border-width: 3px; }

.li-spinner__label {
  font-size: var(--text-xs);
  font-weight: 500;
  line-height: var(--leading-xs);
  color: var(--color-text-muted);
}

@keyframes li-spin {
  to { transform: rotate(360deg); }
}

/* Reduced motion */
@media (prefers-reduced-motion: reduce) {
  .li-spinner__arc {
    animation-duration: 2s;
  }
}
</style>
