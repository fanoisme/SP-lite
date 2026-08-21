<template>
  <Transition name="banner-fade">
    <div v-if="isVisible" class="li-banner" :class="[`li-banner-${variant}`]">
      <div class="li-banner-icon">
        <slot name="icon">
          <LiIcon v-if="variant === 'success'" name="check_circle" size="md" />
          <LiIcon v-else-if="variant === 'error'" name="error" size="md" />
          <LiIcon v-else-if="variant === 'warning'" name="warning" size="md" />
          <LiIcon v-else name="info" size="md" />
        </slot>
      </div>
      
      <div class="li-banner-content">
        <h4 v-if="title" class="li-banner-title">{{ title }}</h4>
        <div class="li-banner-message">
          <slot>{{ message }}</slot>
        </div>
        
        <div v-if="$slots.actions" class="li-banner-actions">
          <slot name="actions"></slot>
        </div>
      </div>
      
      <button v-if="dismissible" class="li-banner-close" @click="dismiss" aria-label="Dismiss banner">
        <LiIcon name="close" size="sm" />
      </button>
    </div>
  </Transition>
</template>

<script setup>
import { ref, watch } from 'vue';

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: true
  },
  title: String,
  message: String,
  variant: {
    type: String,
    default: 'info',
    validator: (v) => ['info', 'success', 'warning', 'error'].includes(v)
  },
  dismissible: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['update:modelValue', 'dismiss']);
const isVisible = ref(props.modelValue);

watch(() => props.modelValue, (newVal) => {
  isVisible.value = newVal;
});

const dismiss = () => {
  isVisible.value = false;
  emit('update:modelValue', false);
  emit('dismiss');
};
</script>

<style scoped>
.li-banner {
  display: flex;
  align-items: flex-start;
  padding: var(--space-m, 12px) var(--space-l, 16px);
  border-radius: var(--radius-md, 8px);
  gap: var(--space-m, 12px);
  font-family: var(--font-family, 'Inter', sans-serif);
  width: 100%;
}

.li-banner-icon {
  flex-shrink: 0;
  margin-top: 2px;
}

.li-banner-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: var(--space-xs, 4px);
}

.li-banner-title {
  margin: 0;
  font-size: var(--text-sm, 16px);
  font-weight: 600;
  color: var(--color-gray-900, #333333);
}

.li-banner-message {
  font-size: var(--text-xs, 14px);
  color: var(--color-gray-800, #4D4D4D);
  line-height: 1.4;
}

.li-banner-actions {
  margin-top: var(--space-s, 8px);
  display: flex;
  gap: var(--space-m, 12px);
}

.li-banner-close {
  background: transparent;
  border: none;
  color: var(--color-gray-500, #999999);
  cursor: pointer;
  padding: 4px;
  border-radius: var(--radius-sm, 4px);
  display: flex;
  margin: -4px -4px -4px 0;
  transition: all var(--dur-short, 200ms);
}

/* Variants */
.li-banner-info {
  background-color: var(--color-blue-100, #E6E6FF);
}
.li-banner-info .li-banner-icon { color: var(--color-blue-500, #0047B2); }

.li-banner-success {
  background-color: var(--color-green-100, #ECFF8F);
}
.li-banner-success .li-banner-icon { color: var(--color-green-500, #17A3E6); }

.li-banner-warning {
  background-color: var(--color-yellow-100, #FFF3D6);
}
.li-banner-warning .li-banner-icon { color: var(--color-orange-500, #FF3000); }

.li-banner-error {
  background-color: var(--color-red-100, #D4A73F); /* Using light danger from tokens */
}
.li-banner-error .li-banner-icon { color: var(--color-red-500, #A33129); }

.li-banner-close:hover {
  background-color: rgba(0, 0, 0, 0.05);
  color: var(--color-gray-900, #333333);
}

/* Transitions */
.banner-fade-enter-active,
.banner-fade-leave-active {
  transition: opacity var(--dur-medium, 300ms), transform var(--dur-medium, 300ms);
}
.banner-fade-enter-from,
.banner-fade-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}
</style>
