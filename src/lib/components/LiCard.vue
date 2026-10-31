<template>
  <div
    :class="['li-card', { 'li-card--hover': hover, 'li-card--flat': flat, 'li-card--bordered': bordered }]"
    :style="{ padding: paddingMap[padding] || undefined }"
  >
    <div v-if="$slots.header" class="li-card__header">
      <slot name="header" />
    </div>
    <div v-if="$slots.media" class="li-card__media">
      <slot name="media" />
    </div>
    <div v-if="$slots.default" class="li-card__body" :class="{ 'li-card__body--no-gutter': flush }">
      <slot />
    </div>
    <div v-if="$slots.footer" class="li-card__footer">
      <div v-if="borderFooter" class="li-card__footer-divider" />
      <slot name="footer" />
    </div>
  </div>
</template>

<script setup>
defineProps({
  hover: { type: Boolean, default: false },
  flat: { type: Boolean, default: false },
  bordered: { type: Boolean, default: true },
  flush: { type: Boolean, default: false },
  padding: { type: String, default: 'md', validator: v => ['none', 'sm', 'md', 'lg', 'xl'].includes(v) },
  borderFooter: { type: Boolean, default: true },
})

const paddingMap = {
  none: '0',
  sm: '12px',
  md: '16px',
  lg: '24px',
  xl: '32px',
}
</script>

<style scoped>
/* Allo flat card (APP.md: flat cards, the one soft card shadow). */
.li-card {
  background: var(--color-bg);
  border-radius: 10px;
  transition: box-shadow var(--dur-short) var(--ease-out),
              transform var(--dur-short) var(--ease-out),
              border-color var(--dur-quick);
}

.li-card--bordered {
  border: 1px solid var(--color-border);
}

.li-card--flat {
  border: none;
  box-shadow: none;
}

.li-card:not(.li-card--flat) {
  box-shadow: var(--shadow-card);
}

.li-card--hover:hover {
  box-shadow: 0 8px 20px -8px rgba(0, 5, 58, 0.18);
  border-color: var(--color-border-strong);
  transform: var(--lift);
}

.li-card__header {
  padding: 0 0 12px 0;
}

.li-card__media {
  overflow: hidden;
  border-radius: 10px 10px 0 0;
  margin: -1px -1px 0 -1px;
}

.li-card__body {
  line-height: var(--leading-sm);
}

.li-card__body--no-gutter {
  padding: 0;
}

.li-card__footer {
  padding: 12px 0 0 0;
}

.li-card__footer-divider {
  border-top: 1px solid var(--color-border);
  margin-bottom: 12px;
  margin-left: -16px;
  margin-right: -16px;
}
</style>
