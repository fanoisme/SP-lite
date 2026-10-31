<template>
  <div :class="['li-divider', { 'li-divider--vertical': vertical }]" role="separator" :aria-orientation="vertical ? 'vertical' : 'horizontal'">
    <span v-if="$slots.default || label" class="li-divider__label">
      <slot>{{ label }}</slot>
    </span>
  </div>
</template>

<script setup>
defineProps({
  label: { type: String, default: '' },
  vertical: { type: Boolean, default: false },
})
</script>

<style scoped>
/* Allo hairline divider on --color-border. */
.li-divider {
  display: flex;
  align-items: center;
  width: 100%;
  border: none;
  margin: var(--space-4) 0;
}

/* Horizontal line */
.li-divider::before,
.li-divider::after {
  content: '';
  flex: 1;
  border-top: 1px solid var(--color-border);
}

/* With label — line on both sides */
.li-divider::after {
  display: none;
}

.li-divider:has(.li-divider__label)::before,
.li-divider:has(.li-divider__label)::after {
  display: block;
}

.li-divider__label {
  flex-shrink: 0;
  padding: 0 12px;
  font-size: var(--text-xs);
  font-weight: 600;
  line-height: var(--leading-xs);
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  white-space: nowrap;
}

/* Vertical variant */
.li-divider--vertical {
  flex-direction: column;
  width: auto;
  height: 100%;
  min-height: 24px;
  margin: 0 var(--space-2);
}

.li-divider--vertical::before,
.li-divider--vertical::after {
  display: none;
}

.li-divider--vertical::before {
  display: block;
  border-top: none;
  border-left: 1px solid var(--color-border);
  height: 100%;
  width: 0;
}

.li-divider--vertical .li-divider__label {
  padding: var(--space-2) 0;
}
</style>
