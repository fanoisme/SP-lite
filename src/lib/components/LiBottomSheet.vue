<template>
  <Teleport to="body">
    <Transition name="sheet-fade">
      <div v-if="modelValue" class="li-bottomsheet-overlay" @click.self="handleOverlayClick">
        <Transition name="sheet-slide" appear>
          <div 
            class="li-bottomsheet" 
            role="dialog" 
            aria-modal="true"
          >
            <div class="li-bottomsheet-drag-handle">
              <div class="li-bottomsheet-drag-bar"></div>
            </div>
            
            <div v-if="title || $slots.header" class="li-bottomsheet-header">
              <slot name="header">
                <h3 class="li-bottomsheet-title">{{ title }}</h3>
              </slot>
              <button v-if="closable" class="li-bottomsheet-close" @click="close" aria-label="Close">
                <LiIcon name="x" size="lg" />
              </button>
            </div>
            
            <div class="li-bottomsheet-body">
              <slot></slot>
            </div>
            
            <div v-if="$slots.footer" class="li-bottomsheet-footer">
              <slot name="footer"></slot>
            </div>
          </div>
        </Transition>
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
.li-bottomsheet-overlay {
  position: fixed;
  inset: 0;
  background: var(--color-overlay);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  z-index: var(--z-modal);
}

.li-bottomsheet {
  background: var(--color-bg);
  border-radius: 14px 14px 0 0;
  box-shadow: 0 -24px 64px -12px rgba(0, 5, 58, 0.28);
  display: flex;
  flex-direction: column;
  max-height: 90vh;
  width: 100%;
  max-width: 600px; /* limits width on desktop */
}

.li-bottomsheet-drag-handle {
  display: flex;
  justify-content: center;
  padding: 12px 0 4px;
}

.li-bottomsheet-drag-bar {
  width: 40px;
  height: 4px;
  background: var(--color-border-strong);
  border-radius: var(--radius-pill);
}

.li-bottomsheet-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-2) var(--space-4) var(--space-3);
}

.li-bottomsheet-title {
  margin: 0;
  font-size: var(--text-base);
  font-weight: 600;
  color: var(--color-text-strong);
}

.li-bottomsheet-close {
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

.li-bottomsheet-close:hover {
  color: var(--color-text-strong);
  background: var(--color-hover);
}

.li-bottomsheet-body {
  padding: 0 var(--space-4) var(--space-4);
  overflow-y: auto;
  font-size: var(--text-sm);
  color: var(--color-text);
}

.li-bottomsheet-footer {
  padding: var(--space-4);
  border-top: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

/* Transitions */
.sheet-fade-enter-active { transition: opacity var(--dur-medium) var(--ease-out); }
.sheet-fade-leave-active { transition: opacity 180ms var(--ease-exit); }
.sheet-fade-enter-from,
.sheet-fade-leave-to {
  opacity: 0;
}

.sheet-slide-enter-active {
  transition: transform var(--dur-medium) var(--ease-enter);
}
.sheet-slide-leave-active {
  transition: transform 200ms var(--ease-exit);
}
.sheet-slide-enter-from,
.sheet-slide-leave-to {
  transform: translateY(100%);
}
</style>
