/**
 * useToast — programmatic toast notification API for Lithium
 *
 * Usage:
 *   const { toast } = useToast()
 *   toast.success('Saved!')
 *   toast.error('Something went wrong', { title: 'Error', duration: 5000 })
 *   toast.info('New version available', { action: { label: 'Reload', onClick: () => location.reload() } })
 *
 * Toast is rendered by <LiToast /> (must be mounted once in App.vue or layout).
 */
import { reactive } from 'vue'

const toasts = reactive([])

let nextId = 1

const POSITIONS = ['top-right', 'top-left', 'top-center', 'bottom-right', 'bottom-left', 'bottom-center']

/**
 * Create a toast notification.
 * @param {string} message - Toast message body
 * @param {Object} opts - Options
 * @returns {number} Toast id (for manual dismiss)
 */
function createToast(message, opts = {}) {
  const id = nextId++
  const toast = {
    id,
    message,
    title: opts.title ?? '',
    variant: opts.variant ?? 'info',      // info | success | warning | error
    duration: opts.duration ?? 4000,       // ms, 0 = persistent
    position: opts.position ?? 'top-right', // one of POSITIONS
    action: opts.action ?? null,           // { label: string, onClick: Function }
    showProgress: opts.showProgress ?? true,
    visible: false,                        // enter animation trigger
    dismissed: false,                      // leave animation trigger
  }
  toasts.push(toast)
  // Trigger enter animation on next tick
  requestAnimationFrame(() => { toast.visible = true })
  // Auto-dismiss
  if (toast.duration > 0) {
    setTimeout(() => dismiss(id), toast.duration)
  }
  return id
}

function dismiss(id) {
  const t = toasts.find(t => t.id === id)
  if (t && !t.dismissed) {
    t.dismissed = true
    // Remove after leave animation completes
    setTimeout(() => {
      const idx = toasts.findIndex(t => t.id === id)
      if (idx !== -1) toasts.splice(idx, 1)
    }, 300)
  }
}

function dismissAll() {
  toasts.forEach(t => dismiss(t.id))
}

export function useToast() {
  return {
    toasts,
    dismiss,
    dismissAll,
    toast: Object.assign(
      (message, opts) => createToast(message, opts),
      {
        info:    (msg, opts = {}) => createToast(msg, { ...opts, variant: 'info' }),
        success: (msg, opts = {}) => createToast(msg, { ...opts, variant: 'success' }),
        warning: (msg, opts = {}) => createToast(msg, { ...opts, variant: 'warning' }),
        error:   (msg, opts = {}) => createToast(msg, { ...opts, variant: 'error', duration: opts.duration ?? 6000 }),
      }
    ),
  }
}
