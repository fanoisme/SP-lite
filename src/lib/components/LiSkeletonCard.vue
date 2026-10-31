<template>
  <div class="li-skeleton-card" aria-hidden="true">
    <div v-if="hasHeader" class="li-skeleton-card__header">
      <LiSkeleton variant="circle" width="40px" height="40px" />
      <div class="li-skeleton-card__header-text">
        <LiSkeleton variant="text" width="120px" />
        <LiSkeleton variant="text" width="80px" />
      </div>
    </div>
    <div class="li-skeleton-card__body">
      <LiSkeleton v-for="i in lines" :key="i" variant="text" :width="lineWidth(i)" />
    </div>
    <div v-if="hasFooter" class="li-skeleton-card__footer">
      <LiSkeleton variant="text" width="60px" />
    </div>
  </div>
</template>

<script setup>
import LiSkeleton from './LiSkeleton.vue'

const props = defineProps({
  hasHeader: { type: Boolean, default: true },
  hasFooter: { type: Boolean, default: false },
  lines: { type: Number, default: 4 },
})

function lineWidth(i) {
  return i === props.lines ? '60%' : '100%'
}
</script>

<style scoped>
/* Allo card shell carrying skeleton lines. */
.li-skeleton-card {
  padding: var(--space-4);
  background: var(--color-bg);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
}

.li-skeleton-card__header {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  margin-bottom: var(--space-4);
}

.li-skeleton-card__header-text {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.li-skeleton-card__body {
  display: flex;
  flex-direction: column;
}

.li-skeleton-card__footer {
  margin-top: var(--space-3);
  padding-top: var(--space-3);
  border-top: 1px solid var(--color-border);
}
</style>
