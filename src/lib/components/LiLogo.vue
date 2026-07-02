<template>
  <div
    class="li-logo"
    :class="[
      `li-logo--${size}`,
      { 'li-logo--animate': animate, 'li-logo--compact': compact }
    ]"
    :style="logoStyle"
  >
    <!-- SVG Mark -->
    <div class="li-logo__mark">
      <!-- Outer glow aura -->
      <div class="li-logo__aura"></div>

      <!-- Orbiting ring -->
      <div class="li-logo__orbit" v-if="!compact">
        <span class="li-logo__orbit-dot"></span>
      </div>

      <!-- Glow layer behind -->
      <div class="li-logo__glow"></div>

      <!-- Particle ring -->
      <div class="li-logo__particles" v-if="!compact">
        <span v-for="i in 8" :key="i" class="li-logo__particle" :style="particleStyle(i)"></span>
      </div>

      <svg
        class="li-logo__svg"
        viewBox="0 0 64 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="logoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#F9C700" />
            <stop offset="40%" stop-color="#FFAF03" />
            <stop offset="100%" stop-color="#FF6B00" />
          </linearGradient>
          <linearGradient id="logoGradHover" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#FFD54F" />
            <stop offset="40%" stop-color="#FFB300" />
            <stop offset="100%" stop-color="#FF8F00" />
          </linearGradient>
          <linearGradient id="shimmerGrad" x1="-100%" y1="0%" x2="200%" y2="0%">
            <stop offset="0%" stop-color="rgba(255,255,255,0)" />
            <stop offset="35%" stop-color="rgba(255,255,255,0)" />
            <stop offset="50%" stop-color="rgba(255,255,255,0.7)" />
            <stop offset="65%" stop-color="rgba(255,255,255,0)" />
            <stop offset="100%" stop-color="rgba(255,255,255,0)" />
            <animate attributeName="x1" values="-150%;250%" dur="2.5s" repeatCount="indefinite" />
            <animate attributeName="x2" values="-50%;350%" dur="2.5s" repeatCount="indefinite" />
          </linearGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="1.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="glowStrong">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <!-- Noise texture -->
          <filter id="noise">
            <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch" />
            <feColorMatrix type="saturate" values="0" />
            <feBlend in="SourceGraphic" mode="multiply" result="noise" />
            <feComponentTransfer>
              <feFuncA type="linear" slope="0.08" />
            </feComponentTransfer>
            <feBlend in="SourceGraphic" in2="noise" mode="normal" />
          </filter>
        </defs>

        <!-- Background rounded rect with noise -->
        <rect
          x="2" y="2" width="60" height="60" rx="14"
          fill="url(#logoGrad)"
          class="li-logo__bg"
        />

        <!-- Inner highlight (top edge light) -->
        <rect
          x="3" y="3" width="58" height="28" rx="12"
          fill="white"
          opacity="0.15"
          class="li-logo__highlight"
        />

        <!-- Shimmer sweep on bg -->
        <rect
          x="2" y="2" width="60" height="60" rx="14"
          fill="url(#shimmerGrad)"
          class="li-logo__shimmer"
        />

        <!-- S letter - stroke drawing -->
        <path
          ref="sPath"
          class="li-logo__letter"
          d="M40 18C40 18 37 14 30 14C23 14 19 18 19 23C19 28 23 30 30 33C37 36 41 38 41 43C41 48 37 52 30 52C23 52 20 48 20 48"
          stroke="white"
          stroke-width="5"
          stroke-linecap="round"
          stroke-linejoin="round"
          filter="url(#glow)"
        />

        <!-- S letter shadow (subtle depth) -->
        <path
          class="li-logo__letter-shadow"
          d="M40 18C40 18 37 14 30 14C23 14 19 18 19 23C19 28 23 30 30 33C37 36 41 38 41 43C41 48 37 52 30 52C23 52 20 48 20 48"
          stroke="rgba(0,0,0,0.15)"
          stroke-width="6"
          stroke-linecap="round"
          stroke-linejoin="round"
        />

        <!-- Sparkle dots with varied sizes -->
        <circle class="li-logo__sparkle li-logo__sparkle--1" cx="46" cy="10" r="1.8" fill="white" opacity="0" />
        <circle class="li-logo__sparkle li-logo__sparkle--2" cx="54" cy="22" r="1.2" fill="white" opacity="0" />
        <circle class="li-logo__sparkle li-logo__sparkle--3" cx="10" cy="52" r="1.5" fill="white" opacity="0" />
        <circle class="li-logo__sparkle li-logo__sparkle--4" cx="8" cy="16" r="1" fill="white" opacity="0" />
        <circle class="li-logo__sparkle li-logo__sparkle--5" cx="52" cy="48" r="1.3" fill="white" opacity="0" />
      </svg>
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

function particleStyle(i) {
  const angle = (i - 1) * 45
  const delay = (i - 1) * 0.35
  const radius = 40 + (i % 3) * 4
  const pSize = 2 + (i % 3)
  return {
    '--angle': `${angle}deg`,
    '--delay': `${delay}s`,
    '--radius': `${radius}px`,
    '--p-size': `${pSize}px`
  }
}
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

.li-logo__svg {
  width: 100%;
  height: 100%;
  display: block;
  position: relative;
  z-index: 2;
  border-radius: 14px;
  filter: drop-shadow(0 4px 12px rgba(255, 140, 0, 0.3));
}

/* ── Background ── */
.li-logo__bg {
  opacity: 1;
}

.li-logo__highlight {
  opacity: 0.15;
}

/* ── Shimmer sweep ── */
.li-logo__shimmer {
  opacity: 0;
}

.li-logo--animate .li-logo__shimmer {
  opacity: 1;
}

/* ── S Letter stroke animation ── */
.li-logo__letter {
  stroke-dasharray: 150;
  stroke-dashoffset: 150;
  animation: logo-draw 1.4s cubic-bezier(0.65, 0, 0.35, 1) forwards;
  animation-delay: 0.4s;
}

.li-logo:not(.li-logo--animate) .li-logo__letter {
  stroke-dashoffset: 0;
  animation: none;
}

.li-logo__letter-shadow {
  stroke-dasharray: 150;
  stroke-dashoffset: 150;
  animation: logo-draw 1.4s cubic-bezier(0.65, 0, 0.35, 1) forwards;
  animation-delay: 0.35s;
}

.li-logo:not(.li-logo--animate) .li-logo__letter-shadow {
  stroke-dashoffset: 0;
  animation: none;
}

@keyframes logo-draw {
  0% {
    stroke-dashoffset: 150;
    opacity: 0;
  }
  8% {
    opacity: 1;
  }
  100% {
    stroke-dashoffset: 0;
    opacity: 1;
  }
}

/* ── Aura (outer glow) ── */
.li-logo__aura {
  position: absolute;
  inset: -40%;
  border-radius: 50%;
  background: conic-gradient(
    from 0deg,
    rgba(255, 175, 3, 0.0),
    rgba(255, 140, 0, 0.2),
    rgba(255, 175, 3, 0.0),
    rgba(255, 200, 0, 0.15),
    rgba(255, 175, 3, 0.0)
  );
  z-index: 0;
  opacity: 0;
  pointer-events: none;
  filter: blur(8px);
}

.li-logo--animate .li-logo__aura {
  animation: logo-aura-spin 8s linear infinite, logo-aura-pulse 3s ease-in-out infinite;
  animation-delay: 0.8s;
}

@keyframes logo-aura-spin {
  to { transform: rotate(360deg); }
}

@keyframes logo-aura-pulse {
  0%, 100% { opacity: 0; }
  40%, 60% { opacity: 1; }
}

/* ── Glow pulse ── */
.li-logo__glow {
  position: absolute;
  inset: -25%;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(255, 175, 3, 0.4) 0%, rgba(255, 140, 0, 0.1) 40%, transparent 70%);
  z-index: 1;
  opacity: 0;
  pointer-events: none;
}

.li-logo--animate .li-logo__glow {
  animation: logo-glow-pulse 3s ease-in-out infinite;
  animation-delay: 1.2s;
}

@keyframes logo-glow-pulse {
  0%, 100% {
    opacity: 0;
    transform: scale(0.85);
  }
  50% {
    opacity: 1;
    transform: scale(1.15);
  }
}

/* ── Orbiting ring ── */
.li-logo__orbit {
  position: absolute;
  inset: -15%;
  border-radius: 50%;
  border: 1.5px solid rgba(255, 175, 3, 0.2);
  z-index: 1;
  pointer-events: none;
  opacity: 0;
}

.li-logo--animate .li-logo__orbit {
  animation: logo-orbit-appear 0.6s ease-out 1.5s forwards, logo-orbit-spin 6s linear 1.5s infinite;
}

.li-logo__orbit-dot {
  position: absolute;
  top: -3px;
  left: 50%;
  transform: translateX(-50%);
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: rgba(255, 188, 37, 0.9);
  box-shadow: 0 0 8px rgba(255, 188, 37, 0.6), 0 0 16px rgba(255, 188, 37, 0.3);
}

@keyframes logo-orbit-appear {
  0% { opacity: 0; transform: scale(0.7); }
  100% { opacity: 1; transform: scale(1); }
}

@keyframes logo-orbit-spin {
  to { transform: rotate(360deg); }
}

/* ── Floating particles ── */
.li-logo__particles {
  position: absolute;
  inset: 0;
  z-index: 4;
  pointer-events: none;
}

.li-logo__particle {
  position: absolute;
  width: var(--p-size, 3px);
  height: var(--p-size, 3px);
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.95);
  top: 50%;
  left: 50%;
  opacity: 0;
  box-shadow: 0 0 8px rgba(255, 255, 255, 0.8), 0 0 4px rgba(255, 200, 50, 0.4);
}

.li-logo--animate .li-logo__particle {
  animation: logo-particle-float 3s ease-in-out infinite;
  animation-delay: var(--delay, 0s);
}

@keyframes logo-particle-float {
  0% {
    opacity: 0;
    transform: translate(-50%, -50%) rotate(var(--angle, 0deg)) translateY(calc(var(--radius, 40px) * -0.4)) scale(0.3);
  }
  15% {
    opacity: 1;
  }
  75% {
    opacity: 0.8;
  }
  100% {
    opacity: 0;
    transform: translate(-50%, -50%) rotate(var(--angle, 0deg)) translateY(calc(var(--radius, 40px) * -1.3)) scale(0);
  }
}

/* ── Sparkle dots ── */
.li-logo--animate .li-logo__sparkle--1 {
  animation: logo-sparkle 2.2s ease-in-out infinite;
  animation-delay: 1.6s;
}

.li-logo--animate .li-logo__sparkle--2 {
  animation: logo-sparkle 2.2s ease-in-out infinite;
  animation-delay: 2.1s;
}

.li-logo--animate .li-logo__sparkle--3 {
  animation: logo-sparkle 2.2s ease-in-out infinite;
  animation-delay: 2.6s;
}

.li-logo--animate .li-logo__sparkle--4 {
  animation: logo-sparkle 2.2s ease-in-out infinite;
  animation-delay: 1.3s;
}

.li-logo--animate .li-logo__sparkle--5 {
  animation: logo-sparkle 2.2s ease-in-out infinite;
  animation-delay: 2.9s;
}

@keyframes logo-sparkle {
  0%, 100% {
    opacity: 0;
    transform: scale(0) rotate(0deg);
  }
  30% {
    opacity: 1;
    transform: scale(1.2) rotate(90deg);
  }
  70% {
    opacity: 0.8;
    transform: scale(1) rotate(180deg);
  }
}

/* ── Background breathing ── */
.li-logo--animate .li-logo__bg {
  animation: logo-bg-breathe 4s ease-in-out infinite;
}

@keyframes logo-bg-breathe {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.88;
  }
}

/* ── Highlight pulse ── */
.li-logo--animate .li-logo__highlight {
  animation: logo-highlight-pulse 4s ease-in-out infinite;
}

@keyframes logo-highlight-pulse {
  0%, 100% { opacity: 0.15; }
  50% { opacity: 0.25; }
}

/* ── Mark entrance ── */
.li-logo--animate .li-logo__mark {
  animation: logo-mark-enter 0.9s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
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
  transform: scale(1.08) rotate(3deg);
  filter: drop-shadow(0 6px 20px rgba(255, 140, 0, 0.4));
}

.li-logo:hover .li-logo__svg {
  filter: drop-shadow(0 6px 20px rgba(255, 140, 0, 0.4));
}

/* ── Reduced motion ── */
@media (prefers-reduced-motion: reduce) {
  .li-logo__letter,
  .li-logo__letter-shadow,
  .li-logo__glow,
  .li-logo__aura,
  .li-logo__orbit,
  .li-logo__particle,
  .li-logo__sparkle,
  .li-logo__bg,
  .li-logo__highlight,
  .li-logo__shimmer,
  .li-logo__mark,
  .li-logo__text {
    animation: none !important;
    transition: none !important;
  }

  .li-logo__letter,
  .li-logo__letter-shadow {
    stroke-dashoffset: 0;
  }

  .li-logo__orbit { opacity: 1; }
}

/* ── Size-specific border radius ── */
.li-logo--xs .li-logo__svg { border-radius: 8px; }
.li-logo--sm .li-logo__svg { border-radius: 10px; }
.li-logo--lg .li-logo__svg { border-radius: 18px; }
.li-logo--xl .li-logo__svg { border-radius: 22px; }
</style>
