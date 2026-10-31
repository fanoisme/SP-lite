<template>
  <span
    :class="['li-chip', `li-chip--${variant}`, `li-chip--${size}`, { 'li-chip--pill': pill, 'li-chip--clickable': clickable }]"
    :tabindex="clickable ? 0 : undefined"
    :role="clickable ? 'button' : undefined"
    @keydown.enter="clickable && $emit('click')"
    @keydown.space.prevent="clickable && $emit('click')"
    @click="clickable && $emit('click')"
  >
    <LiIcon v-if="iconLeft" :name="iconLeft" size="xxs" />
    <span class="li-chip__label"><slot /></span>
    <LiIcon v-if="removable" name="x" size="xxs" class="li-chip__remove" @click.stop="$emit('remove')" />
    <LiIcon v-else-if="iconRight" :name="iconRight" size="xxs" />
  </span>
</template>

<script setup>
import LiIcon from './LiIcon.vue'

defineProps({
  variant: { type: String, default: 'neutral', validator: v => ['neutral', 'brand', 'success', 'warning', 'error', 'info'].includes(v) },
  size: { type: String, default: 'md', validator: v => ['sm', 'md'].includes(v) },
  pill: { type: Boolean, default: true },
  clickable: { type: Boolean, default: false },
  removable: { type: Boolean, default: false },
  iconLeft: { type: String, default: '' },
  iconRight: { type: String, default: '' },
})

defineEmits(['click', 'remove'])
</script>

<style scoped>
/* Allo tag (app.css .tag): bordered pill, surface fill, 24px. */
.li-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-weight: 600;
  line-height: 1.2;
  white-space: nowrap;
  user-select: none;
  border: 1px solid var(--color-border-strong);
  background: var(--color-bg);
  color: var(--color-text);
  transition: border-color var(--dur-quick), background var(--dur-quick);
}

.li-chip--sm  { height: 20px; padding: 0 8px; font-size: var(--text-micro); }
.li-chip--md  { height: 24px; padding: 0 10px; font-size: var(--text-xs); }
.li-chip--pill { border-radius: var(--radius-pill); }

.li-chip--clickable {
  cursor: pointer;
}

.li-chip--clickable:hover {
  border-color: var(--color-text-muted);
  background: var(--color-hover);
}

.li-chip--clickable:focus-visible {
  outline: 2px solid var(--color-focus);
  outline-offset: 2px;
}

/* Variants — soft tone fills */
.li-chip--brand   { background: var(--color-accent-soft); border-color: transparent; color: var(--color-accent-text); }
.li-chip--success { background: var(--color-success-soft); border-color: transparent; color: var(--color-success); }
.li-chip--warning { background: var(--color-warning-soft); border-color: transparent; color: var(--color-warning); }
.li-chip--error   { background: var(--color-danger-soft); border-color: transparent; color: var(--color-danger); }
.li-chip--info    { background: var(--color-info-soft); border-color: transparent; color: var(--color-info); }

.li-chip__remove {
  cursor: pointer;
  opacity: 0.7;
  transition: opacity var(--dur-quick);
}

.li-chip__remove:hover { opacity: 1; }
</style>
