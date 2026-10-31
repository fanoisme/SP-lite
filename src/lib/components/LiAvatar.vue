<template>
  <div :class="['li-avatar', `li-avatar--${size}`]" :style="avatarStyle" :aria-label="alt">
    <img v-if="src" :src="src" :alt="alt" class="li-avatar__img" @error="onError" />
    <span v-else-if="initials" class="li-avatar__initials">{{ initials }}</span>
    <LiIcon v-else name="user" :size="iconSizeMap[size]" />
    <span v-if="badge" :class="['li-avatar__badge', `li-avatar__badge--${badge}`]" />
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import LiIcon from './LiIcon.vue'

const props = defineProps({
  src: { type: String, default: '' },
  alt: { type: String, default: '' },
  initials: { type: String, default: '' },
  size: { type: String, default: 'md', validator: v => ['xs', 'sm', 'md', 'lg', 'xl'].includes(v) },
  badge: { type: String, default: '', validator: v => ['', 'online', 'offline', 'busy', 'away'].includes(v) },
})

const imgError = ref(false)

const sizeMap = { xs: 20, sm: 24, md: 28, lg: 40, xl: 80 }
const iconSizeMap = { xs: 'xxs', sm: 'xxs', md: 'sm', lg: 'md', xl: 'xl' }

const avatarStyle = computed(() => ({
  width: `${sizeMap[props.size]}px`,
  height: `${sizeMap[props.size]}px`,
  fontSize: `${Math.max(9, Math.round(sizeMap[props.size] * 0.4))}px`,
}))

function onError() { imgError.value = true }
</script>

<style scoped>
/* Allo avatar (app.css .av): flat accent tint, accent-text ink, 2px bg ring. */
.li-avatar {
  position: relative;
  display: inline-grid;
  place-items: center;
  border-radius: 50%;
  background: var(--color-accent-soft);
  color: var(--color-accent-text);
  font-weight: 700;
  flex-shrink: 0;
  overflow: visible;
  box-shadow: 0 0 0 2px var(--color-bg);
}

.li-avatar__img {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  object-fit: cover;
}

.li-avatar__initials {
  text-transform: uppercase;
  line-height: 1;
}

.li-avatar__badge {
  position: absolute;
  bottom: 0;
  right: 0;
  width: 30%;
  height: 30%;
  border-radius: 50%;
  border: 2px solid var(--color-bg);
}

.li-avatar--xs .li-avatar__badge { width: 6px; height: 6px; border-width: 1px; }
.li-avatar--sm .li-avatar__badge { width: 8px; height: 8px; border-width: 1.5px; }

.li-avatar__badge--online  { background: var(--color-success); }
.li-avatar__badge--offline { background: var(--color-text-muted); }
.li-avatar__badge--busy    { background: var(--color-danger); }
.li-avatar__badge--away    { background: var(--color-warning); }
</style>
