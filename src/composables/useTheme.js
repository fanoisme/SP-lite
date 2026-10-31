// Allo theme rule (APP.md §5): stored choice wins, the OS wins over the
// default light; switching is instant. Landing pins light itself; this
// singleton serves the rest of the app.
import { ref } from '@vue/reactivity' // pure reactivity — DOM touched only via guards below

const STORAGE_KEY = 'sp-theme'
const theme = ref('light')
let initialized = false

function readStored() {
  try {
    return globalThis.localStorage?.getItem(STORAGE_KEY) ?? null
  } catch {
    return null // blocked (private mode) — behave like nothing stored
  }
}

function persist(value) {
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, value)
  } catch {
    /* blocked storage: keep the in-memory choice only */
  }
}

function apply(value) {
  theme.value = value
  if (typeof document !== 'undefined') {
    document.documentElement.dataset.theme = value
  }
}

export function initTheme() {
  if (initialized) return
  initialized = true
  const stored = readStored()
  if (stored === 'light' || stored === 'dark') {
    apply(stored)
    return
  }
  const osDark = typeof globalThis.matchMedia === 'function'
    && globalThis.matchMedia('(prefers-color-scheme: dark)').matches
  apply(osDark ? 'dark' : 'light')
}

export function setTheme(value) {
  if (value !== 'light' && value !== 'dark') return
  apply(value)
  persist(value)
}

export function toggleTheme() {
  setTheme(theme.value === 'light' ? 'dark' : 'light')
}

export function useTheme() {
  return { theme, setTheme, toggleTheme }
}
