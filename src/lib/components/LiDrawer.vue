<template>
  <Teleport to="body">
    <!-- Backdrop -->
    <Transition name="li-drawer-fade">
      <div v-if="modelValue" class="li-drawer__backdrop" @click="closeOnBackdrop && close()" />
    </Transition>

    <!-- Panel -->
    <Transition :name="`li-drawer-slide-${placement}`">
      <div
        v-if="modelValue"
        :class="['li-drawer', `li-drawer--${placement}`, `li-drawer--${size}`]"
        role="dialog"
        aria-modal="true"
        :aria-label="title || 'Drawer'"
        ref="drawerRef"
      >
        <!-- Header -->
        <div v-if="title || $slots.header" class="li-drawer__header">
          <h2 v-if="title" class="li-drawer__title">{{ title }}</h2>
          <slot name="header" />
          <button class="li-drawer__close" :aria-label="closeLabel || 'Close'" @click="close()">
            <LiIcon name="x" size="md" />
          </button>
        </div>

        <!-- Body -->
        <div class="li-drawer__body">
          <slot />
        </div>

        <!-- Footer -->
        <div v-if="$slots.footer" class="li-drawer__footer">
          <slot name="footer" />
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'
import LiIcon from './LiIcon.vue'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  title: { type: String, default: '' },
  placement: { type: String, default: 'right', validator: v => ['left', 'right', 'bottom'].includes(v) },
  size: { type: String, default: 'md', validator: v => ['sm', 'md', 'lg', 'full'].includes(v) },
  closeOnBackdrop: { type: Boolean, default: true },
  closeLabel: { type: String, default: '' },
})

const emit = defineEmits(['update:modelValue', 'close'])

const drawerRef = ref(null)
const previousFocus = ref(null)

function close() {
  emit('update:modelValue', false)
  emit('close')
}

function onKeydown(e) {
  if (e.key === 'Escape' && props.modelValue) {
    close()
    return
  }
  // Focus trap: Tab / Shift+Tab cycle within drawer
  if (e.key === 'Tab' && props.modelValue && drawerRef.value) {
    const focusable = drawerRef.value.querySelectorAll(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )
    if (focusable.length === 0) return
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (e.shiftKey) {
      if (document.activeElement === first) { e.preventDefault(); last.focus() }
    } else {
      if (document.activeElement === last) { e.preventDefault(); first.focus() }
    }
  }
}

watch(() => props.modelValue, (val) => {
  if (val) {
    previousFocus.value = document.activeElement
    document.body.style.overflow = 'hidden'
    // Focus the first focusable element after animation
    setTimeout(() => {
      if (drawerRef.value) {
        const focusable = drawerRef.value.querySelector('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled])')
        if (focusable) focusable.focus()
      }
    }, 100)
  } else {
    document.body.style.overflow = ''
    if (previousFocus.value) {
      setTimeout(() => {
        if (previousFocus.value) previousFocus.value.focus()
        previousFocus.value = null
      }, 50)
    }
  }
})

onMounted(() => document.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKeydown)
  document.body.style.overflow = ''
})
</script>

<style scoped>
.li-drawer__backdrop {
  position: fixed;
  inset: 0;
  background: var(--color-overlay);
  z-index: var(--z-overlay);
}

.li-drawer {
  position: fixed;
  z-index: var(--z-modal);
  background: var(--color-bg);
  box-shadow: -24px 0 64px -16px rgba(0, 5, 58, 0.25);
  display: flex;
  flex-direction: column;
}

/* Placement */
.li-drawer--left {
  left: 0;
  top: 0;
  bottom: 0;
  border-radius: 0;
}

.li-drawer--right {
  right: 0;
  top: 0;
  bottom: 0;
  border-radius: 0;
}

.li-drawer--bottom {
  left: 0;
  right: 0;
  bottom: 0;
  border-radius: 14px 14px 0 0;
  max-height: 90vh;
}

/* Width sizing (left/right) — md = the Allo detail drawer (600) */
.li-drawer--left.li-drawer--sm,
.li-drawer--right.li-drawer--sm { width: 320px; }

.li-drawer--left.li-drawer--md,
.li-drawer--right.li-drawer--md { width: min(600px, 100vw); }

.li-drawer--left.li-drawer--lg,
.li-drawer--right.li-drawer--lg { width: 720px; }

.li-drawer--left.li-drawer--full,
.li-drawer--right.li-drawer--full { width: 100vw; }

/* Header */
.li-drawer__header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 24px;
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
}

.li-drawer__title {
  flex: 1;
  margin: 0;
  font-size: var(--text-base);
  font-weight: 600;
  line-height: var(--leading-base);
  color: var(--color-text-strong);
}

.li-drawer__close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--color-text-muted);
  cursor: pointer;
  flex-shrink: 0;
  transition: background var(--dur-quick), color var(--dur-quick);
}

.li-drawer__close:hover {
  background: var(--color-hover);
  color: var(--color-text-strong);
}

.li-drawer__close:focus-visible {
  outline: 2px solid var(--color-focus);
  outline-offset: 2px;
}

/* Body */
.li-drawer__body {
  flex: 1;
  overflow-y: auto;
  padding: 16px 24px;
}

/* Footer */
.li-drawer__footer {
  padding: var(--space-3) 24px;
  border-top: 1px solid var(--color-border);
  flex-shrink: 0;
}

/* Transitions — Allo drawer-in/out (dur-medium expo-in, 200ms exit) */
.li-drawer-fade-enter-active { transition: opacity var(--dur-medium) var(--ease-out); }
.li-drawer-fade-leave-active { transition: opacity 180ms var(--ease-exit); }
.li-drawer-fade-enter-from,
.li-drawer-fade-leave-to { opacity: 0; }

.li-drawer-slide-left-enter-active { transition: transform var(--dur-medium) var(--ease-enter); }
.li-drawer-slide-left-leave-active { transition: transform 200ms var(--ease-exit); }
.li-drawer-slide-left-enter-from { transform: translateX(-100%); }
.li-drawer-slide-left-leave-to   { transform: translateX(-100%); }

.li-drawer-slide-right-enter-active { transition: transform var(--dur-medium) var(--ease-enter); }
.li-drawer-slide-right-leave-active { transition: transform 200ms var(--ease-exit); }
.li-drawer-slide-right-enter-from { transform: translateX(100%); }
.li-drawer-slide-right-leave-to   { transform: translateX(100%); }

.li-drawer-slide-bottom-enter-active { transition: transform var(--dur-medium) var(--ease-enter); }
.li-drawer-slide-bottom-leave-active { transition: transform 200ms var(--ease-exit); }
.li-drawer-slide-bottom-enter-from { transform: translateY(100%); }
.li-drawer-slide-bottom-leave-to   { transform: translateY(100%); }
</style>
