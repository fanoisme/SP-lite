<template>
  <Teleport to="body">
    <div class="li-toast-container">
      <TransitionGroup name="toast-list">
        <div 
          v-for="toast in toasts" 
          :key="toast.id" 
          class="li-toast"
          :class="`li-toast-${toast.type}`"
        >
          <div class="li-toast-icon">
            <LiIcon v-if="toast.type === 'success'" name="check_circle" size="md" />
            <LiIcon v-else-if="toast.type === 'error'" name="error" size="md" />
            <LiIcon v-else-if="toast.type === 'warning'" name="warning" size="md" />
            <LiIcon v-else name="info" size="md" />
          </div>
          <div class="li-toast-message">
            {{ toast.message }}
          </div>
          <button class="li-toast-close" @click="removeToast(toast.id)" aria-label="Close">
            <LiIcon name="close" size="sm" />
          </button>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<script setup>
import { useToast } from '../composables/useToast';

const { toasts, removeToast } = useToast();
</script>

<style scoped>
.li-toast-container {
  position: fixed;
  bottom: var(--space-xl, 24px);
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column-reverse;
  gap: var(--space-s, 8px);
  z-index: 2000;
  pointer-events: none;
  width: 100%;
  max-width: 400px;
  padding: 0 var(--space-l, 16px);
}

.li-toast {
  pointer-events: auto;
  display: flex;
  align-items: flex-start;
  padding: var(--space-m, 12px) var(--space-l, 16px);
  background-color: var(--color-gray-900, #333333);
  color: var(--color-gray-0, #FFFFFF);
  border-radius: var(--radius-md, 16px);
  box-shadow: var(--shadow-dropdown, 0 8px 24px rgba(0,0,0,0.1));
  gap: var(--space-s, 8px);
  font-family: var(--font-family, 'Inter', sans-serif);
}

.li-toast-icon {
  flex-shrink: 0;
  margin-top: 2px;
}

.li-toast-message {
  flex: 1;
  font-size: var(--text-sm, 16px);
  line-height: 1.4;
}

.li-toast-close {
  background: transparent;
  border: none;
  color: var(--color-gray-400, #B3B3B3);
  cursor: pointer;
  padding: 2px;
  border-radius: var(--radius-sm, 4px);
  display: flex;
  transition: all var(--dur-short, 200ms);
}

.li-toast-close:hover {
  color: var(--color-gray-0, #FFFFFF);
  background-color: rgba(255, 255, 255, 0.1);
}

/* Variants */
.li-toast-success .li-toast-icon { color: var(--color-green-400, #10B981); }
.li-toast-error .li-toast-icon { color: var(--color-red-400, #C83E3B); }
.li-toast-warning .li-toast-icon { color: var(--color-yellow-400, #F9C700); }
.li-toast-info .li-toast-icon { color: var(--color-blue-400, #2563EB); }

/* Transitions */
.toast-list-enter-active,
.toast-list-leave-active {
  transition: all var(--dur-medium, 300ms) var(--ease-out);
}
.toast-list-enter-from {
  opacity: 0;
  transform: translateY(20px);
}
.toast-list-leave-to {
  opacity: 0;
  transform: translateY(-20px);
}
</style>
