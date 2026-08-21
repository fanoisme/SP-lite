<template>
  <span
    class="li-icon"
    :class="`li-icon--${size}`"
    :style="iconStyle"
    :role="decorative ? undefined : 'img'"
    :aria-hidden="decorative ? 'true' : undefined"
    :aria-label="decorative ? undefined : label"
  />
</template>

<script setup>
import { computed, watchEffect } from 'vue'
import { iconUrl } from '../icons.js'

const props = defineProps({
  name: { type: String, required: true },
  size: {
    type: String,
    default: 'md',
    validator: value => ['xxs', 'sm', 'md', 'lg', 'xl'].includes(value),
  },
  filled: { type: Boolean, default: false },
  color: { type: String, default: 'inherit' },
  decorative: { type: Boolean, default: true },
  label: { type: String, default: '' },
})

const url = computed(() => iconUrl(props.name, props.filled))
const iconStyle = computed(() => {
  const style = {
    '--li-icon-url': url.value ? `url("${url.value}")` : 'none',
  }
  if (props.color !== 'inherit') style.color = props.color
  return style
})

watchEffect(() => {
  if (import.meta.env.DEV && props.name && !url.value) {
    console.warn(`[LiIcon] Missing local icon asset: ${props.name}`)
  }
})
</script>

<style scoped>
.li-icon {
  display: inline-block;
  width: 1em;
  height: 1em;
  flex: 0 0 auto;
  background-color: currentColor;
  -webkit-mask: var(--li-icon-url) center / contain no-repeat;
  mask: var(--li-icon-url) center / contain no-repeat;
}
.li-icon--xxs { font-size: 12px; }
.li-icon--sm  { font-size: 16px; }
.li-icon--md  { font-size: 20px; }
.li-icon--lg  { font-size: 24px; }
.li-icon--xl  { font-size: 32px; }
</style>
