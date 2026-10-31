<template>
  <svg
    :class="['li-mascot', { 'li-mascot--animated': animated && !reducedMotion }]"
    :width="size"
    :height="size"
    viewBox="0 0 96 96"
    :role="label ? 'img' : undefined"
    :aria-label="label"
    :aria-hidden="label ? undefined : 'true'"
  >
    <!-- The SP-lite golden retriever. Fixed art palette (illustration ≠ token, per
         the guide's mascot rules); animation is transforms on parts only — the
         cross-dissolve GIF this replaced ghosted and is gone. -->
    <g class="m-chest">
      <ellipse cx="48" cy="88" rx="26" ry="11" fill="#f5c26b"/>
      <path d="M28,84 q20,10 40,0 l0,6 q-20,10 -40,0 z" fill="#e8a84c"/>
    </g>
    <g class="m-ear m-ear-l">
      <path d="M30,22 C17,25 11,41 14,56 C15.5,63 23,66 28,61 C34,55 35,38 33,25 Z" fill="#e8a84c"/>
      <path d="M29,28 C21,31 17,42 19,54 C20,58 24,59 26,56 C30,50 30,38 29,28 Z" fill="#c98500" opacity=".45"/>
    </g>
    <g class="m-ear m-ear-r">
      <path d="M66,22 C79,25 85,41 82,56 C80.5,63 73,66 68,61 C62,55 61,38 63,25 Z" fill="#e8a84c"/>
      <path d="M67,28 C75,31 79,42 77,54 C76,58 72,59 70,56 C66,50 66,38 67,28 Z" fill="#c98500" opacity=".45"/>
    </g>
    <g class="m-head">
      <path d="M48,13 C66,13 79,23 79,40 C79,55 68,67 48,67 C28,67 17,55 17,40 C17,23 30,13 48,13 Z" fill="#f5c26b"/>
      <path d="M48,13 C62,13 73,20 77,30 C70,25 60,22 48,22 C36,22 26,25 19,30 C23,20 34,13 48,13 Z" fill="#e8a84c" opacity=".5"/>
    </g>
    <g class="m-eye m-eye-l" :class="{ 'm-eye--blink': blinking }">
      <circle cx="38" cy="38" r="3.2" fill="#333333"/>
    </g>
    <g class="m-eye m-eye-r" :class="{ 'm-eye--blink': blinking }">
      <circle cx="58" cy="38" r="3.2" fill="#333333"/>
    </g>
    <g class="m-snout">
      <ellipse cx="48" cy="55" rx="14" ry="11" fill="#ffffff"/>
      <path d="M43,49 h10 a2.4,2.4 0 0 1 2.4,2.4 c0,3.4 -3.4,5.6 -7.4,5.6 c-4,0 -7.4,-2.2 -7.4,-5.6 a2.4,2.4 0 0 1 2.4,-2.4 z" fill="#333333"/>
      <path d="M44,60 q4,3 8,0" fill="none" stroke="#333333" stroke-width="1.6" stroke-linecap="round"/>
    </g>
  </svg>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

const props = defineProps({
  size: { type: Number, default: 48 },
  animated: { type: Boolean, default: true },
  label: { type: String, default: '' },
})

const blinking = ref(false)
let blinkTimer = null

const reducedMotion = computed(() =>
  typeof globalThis.matchMedia === 'function'
    && globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches
)

onMounted(() => {
  if (!props.animated || reducedMotion.value) return
  const scheduleBlink = () => {
    blinkTimer = setTimeout(() => {
      blinking.value = true
      setTimeout(() => { blinking.value = false }, 600)
      scheduleBlink()
    }, 4000 + Math.random() * 2000)
  }
  scheduleBlink()
})

onBeforeUnmount(() => clearTimeout(blinkTimer))
</script>

<style scoped>
.li-mascot {
  display: block;
  flex: none;
  filter: drop-shadow(0 2px 4px rgba(88, 49, 8, 0.14));
}

/* Breathing: the chest swells ~2% on a slow 3s cycle */
.li-mascot--animated .m-chest {
  transform-origin: 48px 88px;
  animation: mascot-breath 3000ms ease-in-out infinite;
}
@keyframes mascot-breath {
  50% { transform: scaleY(1.02); }
}

/* Blink: 600ms with a quick dip in the middle — reads as a blink, never strobes */
.li-mascot--animated .m-eye {
  transform-box: fill-box;
  transform-origin: center;
}
.li-mascot--animated .m-eye--blink {
  animation: mascot-blink 600ms ease-in-out;
}
@keyframes mascot-blink {
  40%, 60% { transform: scaleY(0.1); }
}

/* Ear flap: a quick spring flap once per 8s cycle (left ear leads, right follows) */
.li-mascot--animated .m-ear-l { transform-origin: 30px 24px; animation: mascot-ear 8000ms var(--ease-spring) infinite; }
.li-mascot--animated .m-ear-r { transform-origin: 66px 24px; animation: mascot-ear 8000ms var(--ease-spring) 160ms infinite; }
@keyframes mascot-ear {
  34% { transform: rotate(-7deg); }
  38% { transform: rotate(3deg); }
  42% { transform: rotate(0deg); }
}

/* Occasional head tilt: a short move inside a long 8s cycle */
.li-mascot--animated .m-head {
  transform-origin: 48px 40px;
  animation: mascot-tilt 8000ms ease-in-out infinite;
}
@keyframes mascot-tilt {
  30%, 40% { transform: rotate(3deg); }
}

@media (prefers-reduced-motion: reduce) {
  .li-mascot--animated .m-chest,
  .li-mascot--animated .m-head {
    animation: none;
  }
}
</style>
