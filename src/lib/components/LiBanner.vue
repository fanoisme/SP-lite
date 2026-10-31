<template>
  <Transition name="banner-fade">
    <div v-if="isVisible" class="li-banner" :class="[`li-banner-${variant}`]">
      <div class="li-banner-icon">
        <slot name="icon">
          <LiIcon v-if="variant === 'success'" name="circle-check" size="md" />
          <LiIcon v-else-if="variant === 'error'" name="circle-x" size="md" />
          <LiIcon v-else-if="variant === 'warning'" name="triangle-alert" size="md" />
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
        <LiIcon name="x" size="sm" />
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
  padding: var(--space-3);
  border-radius: 10px;
  gap: 10px;
  width: 100%;
  animation: li-banner-rise var(--dur-medium) var(--ease-enter);
}

@keyframes li-banner-rise { from { opacity: 0; transform: translateY(8px); } }

.li-banner-icon {
  flex-shrink: 0;
  margin-top: 2px;
}

.li-banner-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.li-banner-title {
  margin: 0;
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--color-text);
}

.li-banner-message {
  font-size: var(--text-sm);
  color: var(--color-text);
  line-height: var(--leading-sm);
}

.li-banner-actions {
  margin-top: var(--space-2);
  display: flex;
  gap: var(--space-3);
}

.li-banner-close {
  background: transparent;
  border: none;
  color: var(--color-text-muted);
  cursor: pointer;
  padding: 4px;
  border-radius: var(--radius-sm);
  display: flex;
  margin: -4px -4px -4px 0;
  transition: background var(--dur-quick), color var(--dur-quick);
}

/* Variants — Allo banner tones */
.li-banner-info    { background: var(--color-info-soft); }
.li-banner-info .li-banner-icon { color: var(--color-info); }
.li-banner-success { background: var(--color-success-soft); }
.li-banner-success .li-banner-icon { color: var(--color-success); }
.li-banner-warning { background: var(--color-warning-soft); }
.li-banner-warning .li-banner-icon { color: var(--color-warning); }
.li-banner-error   { background: var(--color-danger-soft); }
.li-banner-error .li-banner-icon { color: var(--color-danger); }

.li-banner-close:hover {
  background: var(--color-hover);
  color: var(--color-text-strong);
}

/* Transitions */
.banner-fade-enter-active { transition: opacity var(--dur-medium) var(--ease-enter), transform var(--dur-medium) var(--ease-enter); }
.banner-fade-leave-active { transition: opacity 160ms var(--ease-exit), transform 160ms var(--ease-exit); }
.banner-fade-enter-from,
.banner-fade-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
</style>
