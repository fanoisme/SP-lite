<template>
  <div class="dd-placeholder">
    <span class="material-symbols-outlined dd-placeholder__icon">{{ icon }}</span>
    <h2 class="dd-placeholder__title">{{ title }}</h2>
    <p class="dd-placeholder__body">
      Not built yet — arriving in {{ phase }}.
    </p>
    <p class="dd-placeholder__hint">
      Until then, use <RouterLink to="/qrdd" class="dd-placeholder__link">QR DD</RouterLink>
      for business units, merchants and promo rules.
    </p>
  </div>
</template>

<script setup>
import { RouterLink } from 'vue-router'

defineProps({
  title: { type: String, required: true },
  phase: { type: String, required: true },
  icon: { type: String, default: 'construction' },
})
</script>

<style scoped>
.dd-placeholder {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 6px; padding: 64px 24px; text-align: center;
  background: rgba(255, 255, 255, 0.5);
  border: 1px dashed rgba(0, 0, 0, 0.12);
  border-radius: var(--radius-md, 16px);
}
.dd-placeholder__icon { font-size: 40px; color: var(--color-gray-400, #aaa); }
.dd-placeholder__title { font-size: 18px; font-weight: 700; margin: 4px 0 0; }
.dd-placeholder__body { font-size: 14px; color: var(--color-gray-500, #8e8ea0); margin: 0; }
.dd-placeholder__hint { font-size: 13px; color: var(--color-gray-400, #aaa); margin: 8px 0 0; }
.dd-placeholder__link { color: #6366F1; font-weight: 600; text-decoration: none; }
.dd-placeholder__link:hover { text-decoration: underline; }
</style>
