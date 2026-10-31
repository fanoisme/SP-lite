<template>
  <Teleport to="body">
    <Transition name="modal-fade">
      <div v-if="modelValue" class="li-modal-overlay" @click.self="handleOverlayClick">
        <div 
          class="li-modal" 
          role="dialog" 
          aria-modal="true"
          :class="[ `li-modal-${size}` ]"
        >
          <div v-if="title || $slots.header" class="li-modal-header">
            <slot name="header">
              <h2 class="li-modal-title">{{ title }}</h2>
            </slot>
            <button v-if="closable" class="li-modal-close" @click="close" aria-label="Close">
              <LiIcon name="x" size="lg" />
            </button>
          </div>
          
          <div class="li-modal-body">
            <slot></slot>
          </div>
          
          <div v-if="$slots.footer" class="li-modal-footer">
            <slot name="footer"></slot>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { onMounted, onUnmounted, watch } from 'vue';

const props = defineProps({
  modelValue: Boolean,
  title: String,
  closable: {
    type: Boolean,
    default: true
  },
  closeOnOverlay: {
    type: Boolean,
    default: true
  },
  size: {
    type: String,
    default: 'md',
    validator: (v) => ['sm', 'md', 'lg'].includes(v)
  }
});

const emit = defineEmits(['update:modelValue', 'close']);

const close = () => {
  emit('update:modelValue', false);
  emit('close');
};

const handleOverlayClick = () => {
  if (props.closeOnOverlay) {
    close();
  }
};

const handleEscape = (e) => {
  if (e.key === 'Escape' && props.modelValue && props.closable) {
    close();
  }
};

watch(() => props.modelValue, (isOpen) => {
  if (isOpen) {
    document.body.style.overflow = 'hidden';
  } else {
    document.body.style.overflow = '';
  }
});

onMounted(() => {
  document.addEventListener('keydown', handleEscape);
});

onUnmounted(() => {
  document.removeEventListener('keydown', handleEscape);
  document.body.style.overflow = '';
});
</script>

<style scoped>
/* Allo dialog (app.css .scrim/.dialog): radius 14, pop shadow, expo-in enter. */
.li-modal-overlay {
  position: fixed;
  inset: 0;
  background: var(--color-overlay);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: var(--z-modal);
  padding: var(--space-4);
}

.li-modal {
  background: var(--color-bg);
  border-radius: 14px;
  box-shadow: 0 24px 64px -12px rgba(0, 5, 58, 0.28);
  display: flex;
  flex-direction: column;
  max-height: 85vh;
  width: 100%;
}

.li-modal-sm { max-width: 400px; }
.li-modal-md { max-width: 560px; }
.li-modal-lg { max-width: 800px; }

.li-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px var(--space-2);
}

.li-modal-title {
  margin: 0;
  font-size: var(--text-lg);
  line-height: var(--leading-lg);
  font-weight: 600;
  color: var(--color-text-strong);
}

.li-modal-close {
  background: transparent;
  border: none;
  color: var(--color-text-muted);
  cursor: pointer;
  padding: 4px;
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background var(--dur-quick), color var(--dur-quick);
}

.li-modal-close:hover {
  color: var(--color-text-strong);
  background: var(--color-hover);
}

.li-modal-close:focus-visible {
  outline: 2px solid var(--color-focus);
  outline-offset: 2px;
}

.li-modal-body {
  padding: var(--space-2) 24px;
  overflow-y: auto;
  display: grid;
  gap: var(--space-4);
  font-size: var(--text-sm);
  color: var(--color-text);
  line-height: var(--leading-sm);
}

.li-modal-footer {
  padding: var(--space-4) 24px 20px;
  display: flex;
  justify-content: flex-end;
  gap: var(--space-2);
}

/* Transitions — Allo dialog-in/out */
.modal-fade-enter-active {
  transition: opacity var(--dur-medium) var(--ease-out);
}
.modal-fade-leave-active {
  transition: opacity 160ms var(--ease-exit);
}

.modal-fade-enter-active .li-modal {
  transition: transform var(--dur-medium) var(--ease-enter);
}
.modal-fade-leave-active .li-modal {
  transition: transform 160ms var(--ease-exit);
}

.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}

.modal-fade-enter-from .li-modal {
  transform: translateY(12px) scale(0.97);
}
.modal-fade-leave-to .li-modal {
  transform: scale(0.98);
}
</style>
