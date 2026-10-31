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
            <LiIcon v-if="toast.type === 'success'" name="circle-check" size="md" />
            <LiIcon v-else-if="toast.type === 'error'" name="circle-x" size="md" />
            <LiIcon v-else-if="toast.type === 'warning'" name="triangle-alert" size="md" />
            <LiIcon v-else name="info" size="md" />
          </div>
          <div class="li-toast-message">
            {{ toast.message }}
          </div>
          <button class="li-toast-close" @click="removeToast(toast.id)" aria-label="Close">
            <LiIcon name="x" size="sm" />
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
/* Allo toast stack (app.css .toasts): bottom-right, inverse surface. */
.li-toast-container {
  position: fixed;
  right: var(--space-4);
  bottom: var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  z-index: var(--z-toast);
  pointer-events: none;
  width: min(380px, calc(100vw - 32px));
}

.li-toast {
  pointer-events: auto;
  display: flex;
  align-items: flex-start;
  padding: var(--space-3);
  background: var(--color-inverse);
  color: var(--color-on-inverse);
  border-radius: 12px;
  box-shadow: var(--shadow-pop);
  gap: 10px;
}

.li-toast-icon {
  flex-shrink: 0;
  width: 18px;
  height: 18px;
  margin-top: 1px;
  border-radius: 50%;
  background: var(--color-bg);
  color: var(--color-text);
  display: grid;
  place-items: center;
}

/* Variants — icon color on the inverse surface */
.li-toast-success .li-toast-icon { color: var(--color-success); }
.li-toast-error .li-toast-icon { color: var(--color-danger); }
.li-toast-warning .li-toast-icon { color: var(--color-warning); }
.li-toast-info .li-toast-icon { color: var(--color-info); }

.li-toast-message {
  flex: 1;
  font-size: var(--text-sm);
  font-weight: 500;
  line-height: var(--leading-sm);
}

.li-toast-close {
  background: transparent;
  border: none;
  color: var(--color-on-inverse-muted);
  cursor: pointer;
  padding: 2px;
  border-radius: var(--radius-sm);
  display: flex;
  transition: color var(--dur-quick), background var(--dur-quick);
}

.li-toast-close:hover {
  color: var(--color-on-inverse);
  background: color-mix(in srgb, var(--color-on-inverse) 10%, transparent);
}

/* Transitions */
.toast-list-enter-active { transition: opacity var(--dur-medium) var(--ease-spring), transform var(--dur-medium) var(--ease-spring); }
.toast-list-leave-active { transition: opacity 200ms var(--ease-exit), transform 200ms var(--ease-exit); }
.toast-list-enter-from {
  opacity: 0;
  transform: translateY(24px) scale(0.96);
}
.toast-list-leave-to {
  opacity: 0;
  transform: translateX(40px);
}
</style>
