<template>
  <div
    class="li-logo"
    :class="[
      `li-logo--${size}`,
      { 'li-logo--animate': animate, 'li-logo--compact': compact }
    ]"
    :style="logoStyle"
  >
    <div class="li-logo__mark">
      <picture v-if="animate && !gifFailed" class="li-logo__picture">
        <source media="(prefers-reduced-motion: reduce)" :srcset="logoStatic" />
        <img
          class="li-logo__image"
          :src="logoAnimated"
          alt=""
          aria-hidden="true"
          @error="gifFailed = true"
        />
      </picture>
      <img
        v-else
        class="li-logo__image"
        :src="logoStatic"
        alt=""
        aria-hidden="true"
      />
    </div>

    <!-- Text -->
    <div class="li-logo__text" v-if="!compact">
      <span class="li-logo__name">SP-lite</span>
      <span class="li-logo__sub" v-if="showSubtitle">QRIS · Template · Video Tools</span>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import logoAnimated from '../../assets/brand/sp-lite-golden.gif'
import logoStatic from '../../assets/brand/sp-lite-golden.png'

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

const gifFailed = ref(false)

const logoStyle = computed(() => {
  const sizes = {
    xs: { mark: '28px', fontSize: '14px', subSize: '9px' },
    sm: { mark: '34px', fontSize: '17px', subSize: '10px' },
    md: { mark: '48px', fontSize: '22px', subSize: '12px' },
    lg: { mark: '72px', fontSize: '32px', subSize: '14px' },
    xl: { mark: '96px', fontSize: '42px', subSize: '16px' }
  }
  const s = sizes[props.size]
  return {
    '--logo-mark-size': s.mark,
    '--logo-font-size': s.fontSize,
    '--logo-sub-size': s.subSize
  }
})
</script>

<style scoped>
.li-logo {
  display: flex;
  align-items: center;
  gap: 10px;
  user-select: none;
}

.li-logo--compact {
  gap: 0;
}

/* ── Mark ── */
.li-logo__mark {
  position: relative;
  width: var(--logo-mark-size, 48px);
  height: var(--logo-mark-size, 48px);
  flex-shrink: 0;
  perspective: 600px;
}

.li-logo__picture {
  display: contents;
}

.li-logo__image {
  width: 100%;
  height: 100%;
  display: block;
  position: relative;
  z-index: 2;
  object-fit: contain;
  filter: drop-shadow(0 4px 8px rgba(88, 49, 8, 0.18));
}

/* ── Mark entrance ── */
.li-logo--animate .li-logo__mark {
  animation: logo-mark-enter 500ms cubic-bezier(0.16, 1, 0.3, 1) both;
}

@keyframes logo-mark-enter {
  0% {
    opacity: 0;
    transform: scale(0.3) rotate(-15deg);
    filter: blur(4px);
  }
  60% {
    opacity: 1;
    filter: blur(0);
  }
  80% {
    transform: scale(1.05) rotate(2deg);
  }
  100% {
    opacity: 1;
    transform: scale(1) rotate(0deg);
    filter: blur(0);
  }
}

/* ── Text ── */
.li-logo__text {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.li-logo__name {
  font-family: var(--font-display, 'Inter', sans-serif);
  font-weight: 800;
  font-size: var(--logo-font-size, 22px);
  color: var(--color-gray-900, #1a1a2e);
  letter-spacing: -0.5px;
  line-height: 1.1;
}

.li-logo__sub {
  font-family: var(--font-body, 'Inter', sans-serif);
  font-size: var(--logo-sub-size, 12px);
  color: #8e8ea0;
  font-weight: 500;
  line-height: 1.3;
  white-space: nowrap;
}

/* ── Text entrance ── */
.li-logo--animate .li-logo__text {
  animation: logo-text-enter 0.7s cubic-bezier(0.16, 1, 0.3, 1) forwards;
  animation-delay: 0.7s;
  opacity: 0;
}

@keyframes logo-text-enter {
  0% {
    opacity: 0;
    transform: translateX(-12px);
    filter: blur(2px);
  }
  100% {
    opacity: 1;
    transform: translateX(0);
    filter: blur(0);
  }
}

/* ── Hover micro-interaction ── */
.li-logo__mark {
  transition: transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1), filter 0.3s ease;
}

.li-logo:hover .li-logo__mark {
  transform: translateY(-1px);
}

/* ── Reduced motion ── */
@media (prefers-reduced-motion: reduce) {
  .li-logo__mark,
  .li-logo__text {
    animation: none !important;
    transition: none !important;
  }
}
</style>
