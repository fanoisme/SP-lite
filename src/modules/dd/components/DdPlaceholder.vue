<template>
  <div class="ddph">
    <span class="material-symbols-outlined ddph__icon">{{ icon }}</span>
    <h2 class="ddph__title">{{ title }}</h2>
    <p class="ddph__body">Not built yet — arriving in {{ phase }}.</p>
    <p v-if="note" class="ddph__note">{{ note }}</p>
  </div>
</template>

<script setup>
defineProps({
  title: { type: String, required: true },
  phase: { type: String, required: true },
  icon: { type: String, default: 'construction' },
  note: { type: String, default: '' },
})
</script>

<style scoped>
.ddph {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 6px; padding: 72px 24px; text-align: center;
  background: rgba(255, 255, 255, 0.5);
  border: 1px dashed rgba(0, 0, 0, 0.12);
  border-radius: var(--radius-md, 16px);
}
.ddph__icon { font-size: 40px; color: var(--color-gray-400, #aaa); }
.ddph__title { font-size: 18px; font-weight: 700; margin: 4px 0 0; }
.ddph__body { font-size: 14px; color: var(--color-gray-500, #8e8ea0); margin: 0; }
.ddph__note { font-size: 13px; color: var(--color-gray-400, #aaa); margin: 8px 0 0; max-width: 42ch; }
</style>
