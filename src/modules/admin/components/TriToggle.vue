<template>
  <div class="tri" role="group" :aria-label="ariaLabel">
    <button
      v-for="opt in options"
      :key="opt.value"
      type="button"
      :class="['tri__btn', `tri__btn--${opt.value}`, { 'tri__btn--active': modelValue === opt.value }]"
      :aria-pressed="modelValue === opt.value"
      @click="$emit('update:modelValue', opt.value)"
    >
      {{ opt.label }}
    </button>
  </div>
</template>

<script setup>
defineProps({
  modelValue: { type: String, default: 'inherit' },
  ariaLabel: { type: String, default: 'Override mode' },
})
defineEmits(['update:modelValue'])

const options = [
  { value: 'inherit', label: 'Inherit' },
  { value: 'grant', label: 'Grant' },
  { value: 'deny', label: 'Deny' },
]
</script>

<style scoped>
.tri {
  display: inline-flex;
  gap: 4px;
  padding: 3px;
  border-radius: var(--radius-pill, 999px);
  background: var(--color-gray-100, #f2f2f2);
}

.tri__btn {
  padding: 5px 12px;
  border: none;
  border-radius: var(--radius-pill, 999px);
  background: transparent;
  color: var(--color-on-surface-muted, #999);
  font-size: 12px;
  font-weight: 600;
  font-family: var(--font-body, 'Inter', sans-serif);
  cursor: pointer;
  transition: all var(--dur-short, 200ms) var(--ease-out);
  white-space: nowrap;
}

.tri__btn:hover:not(.tri__btn--active) {
  color: var(--color-on-surface, #333);
}

/* Active state per mode */
.tri__btn--grant.tri__btn--active {
  background: var(--color-success, #10B981);
  color: var(--color-gray-0, #fff);
}

.tri__btn--deny.tri__btn--active {
  background: var(--color-error, #C83E3B);
  color: var(--color-gray-0, #fff);
}

.tri__btn--inherit.tri__btn--active {
  background: var(--color-gray-0, #fff);
  color: var(--color-on-surface, #333);
  box-shadow: var(--shadow-sm, 0 1px 3px rgba(0, 0, 0, 0.08));
}
</style>
