<template>
  <button
    :class="['li-btn', `li-btn-${variant}`, `li-btn-${size}`, { 'li-btn-icon-only': isIconOnly, 'li-btn-loading': loading }]"
    :disabled="disabled || loading"
    :aria-busy="loading || undefined"
    @click="handleClick"
    ref="btn"
  >
    <span v-if="loading" class="li-btn-spinner"></span>
    <span v-if="iconLeft && !loading" class="li-btn-icon li-btn-icon-left">
      <slot name="iconLeft"><component :is="iconLeft" /></slot>
    </span>
    <span class="li-btn-label" :class="{ 'sr-only': isIconOnly }">
      <slot></slot>
    </span>
    <span v-if="iconRight && !loading" class="li-btn-icon li-btn-icon-right">
      <slot name="iconRight"><component :is="iconRight" /></slot>
    </span>
  </button>
</template>

<script setup>
import { ref } from 'vue';

const props = defineProps({
  variant: {
    type: String,
    default: 'primary',
    // ghost kept as an alias of subtle for existing call sites
    validator: (v) => ['primary', 'secondary', 'subtle', 'ghost', 'danger', 'link'].includes(v)
  },
  size: {
    type: String,
    default: 'md',
    validator: (v) => ['sm', 'md', 'lg'].includes(v)
  },
  iconLeft: [Object, String],
  iconRight: [Object, String],
  isIconOnly: Boolean,
  disabled: Boolean,
  loading: Boolean,
});

const emit = defineEmits(['click']);
const btn = ref(null);

const handleClick = (e) => {
  if (props.disabled || props.loading) return;
  emit('click', e);
};
</script>

<style scoped>
/* Allo button (components.md → Buttons; app.css .btn). Compact sizes 28/32/40. */
.li-btn {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  border: 1px solid transparent;
  cursor: pointer;
  border-radius: var(--radius-pill);
  font: inherit;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  isolation: isolate;
  transition:
    background var(--dur-quick),
    border-color var(--dur-quick),
    box-shadow var(--dur-short) var(--ease-out),
    transform var(--dur-instant) var(--ease-out);
}

.li-btn:active:not(:disabled) { transform: scale(0.97); }

.li-btn:focus-visible {
  outline: 2px solid var(--color-focus);
  outline-offset: 2px;
}

/* On the yellow fill the ring uses on-accent (APP.md §5) */
.li-btn-primary:focus-visible {
  outline-color: var(--color-on-accent);
}

/* Sizes — compact */
.li-btn-sm { height: 28px; padding: 0 12px; font-size: var(--text-xs); }
.li-btn-md { height: 32px; padding: 0 16px; font-size: var(--text-sm); }
.li-btn-lg { height: 40px; padding: 0 20px; font-size: var(--text-base); }

.li-btn-icon-only { padding: 0; width: auto; aspect-ratio: 1/1; }

/* Variants */
.li-btn-primary {
  background: var(--color-accent);
  color: var(--color-on-accent);
}
.li-btn-primary:hover:not(:disabled) {
  background: var(--color-accent-strong);
  box-shadow: 0 6px 16px -6px rgba(255, 165, 0, 0.55);
}

.li-btn-secondary {
  background: var(--color-bg);
  color: var(--color-text);
  border-color: var(--color-border-input);
}
.li-btn-secondary:hover:not(:disabled) {
  background: var(--color-hover);
  border-color: var(--color-text-muted);
}

.li-btn-subtle,
.li-btn-ghost {
  background: transparent;
  color: var(--color-text);
}
.li-btn-subtle:hover:not(:disabled),
.li-btn-ghost:hover:not(:disabled) {
  background: var(--color-hover);
}

.li-btn-danger {
  background: var(--color-danger);
  color: var(--color-on-danger);
}
.li-btn-danger:hover:not(:disabled) {
  box-shadow: 0 6px 16px -6px rgba(198, 47, 47, 0.6);
}

.li-btn-link {
  background: none;
  color: var(--color-text-strong);
  padding: 0 4px;
}
.li-btn-link:hover:not(:disabled) {
  text-decoration: underline;
  text-underline-offset: 4px;
}

/* Disabled */
.li-btn:disabled {
  background: var(--color-surface-2);
  color: var(--color-text-muted);
  border-color: transparent;
  box-shadow: none;
  cursor: not-allowed;
  transform: none;
}

/* Utils */
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  border: 0;
}

.li-btn-spinner {
  width: 16px;
  height: 16px;
  flex: none;
  border: 2px solid currentColor;
  border-right-color: transparent;
  border-radius: 50%;
  animation: li-btn-spin 0.7s linear infinite;
}

@keyframes li-btn-spin {
  to { transform: rotate(360deg); }
}

@media (prefers-reduced-motion: reduce) {
  .li-btn-spinner { animation-duration: 1.5s; }
  .li-btn:active:not(:disabled) { transform: none; }
}
</style>
