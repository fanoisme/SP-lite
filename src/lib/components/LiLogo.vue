<template>
  <div
    class="li-logo"
    :class="[`li-logo--${size}`, { 'li-logo--compact': compact }]"
    :style="logoStyle"
  >
    <div class="li-logo__mark">
      <LiMascot :size="markPx" :animated="animate" />
    </div>

    <!-- Text -->
    <div class="li-logo__text" v-if="!compact">
      <span class="li-logo__name">SP-lite</span>
      <span class="li-logo__sub" v-if="showSubtitle">QRIS · Template · Video Tools</span>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import LiMascot from './LiMascot.vue'

const props = defineProps({
  size: {
    type: String,
    default: 'md',
    validator: v => ['xs', 'sm', 'md', 'lg', 'xl'].includes(v)
  },
  animate: {
    type: Boolean,
    default: true
  },
  compact: {
    type: Boolean,
    default: false
  },
  showSubtitle: {
    type: Boolean,
    default: true
  }
})

const sizes = {
  xs: { mark: 28, font: 14, sub: 9 },
  sm: { mark: 34, font: 17, sub: 10 },
  md: { mark: 48, font: 22, sub: 12 },
  lg: { mark: 72, font: 32, sub: 14 },
  xl: { mark: 96, font: 42, sub: 16 }
}

const logoStyle = computed(() => {
  const s = sizes[props.size]
  return {
    '--logo-font-size': `${s.font}px`,
    '--logo-sub-size': `${s.sub}px`
  }
})

const markPx = computed(() => sizes[props.size].mark)
</script>

<style scoped>
/* Allo logo lockup: mascot mark + wordmark (Inter 800, ink). */
.li-logo {
  display: flex;
  align-items: center;
  gap: 10px;
  user-select: none;
}

.li-logo--compact {
  gap: 0;
}

.li-logo__mark {
  flex-shrink: 0;
  display: grid;
  place-items: center;
}

.li-logo__text {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.li-logo__name {
  font-family: var(--font-sans);
  font-weight: 800;
  font-size: var(--logo-font-size, 22px);
  color: var(--color-text-strong);
  letter-spacing: -0.02em;
  line-height: 1.1;
}

.li-logo__sub {
  font-family: var(--font-sans);
  font-size: var(--logo-sub-size, 12px);
  color: var(--color-text-muted);
  font-weight: 500;
  line-height: 1.3;
  white-space: nowrap;
}
</style>
