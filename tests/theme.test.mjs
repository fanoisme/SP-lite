// useTheme contract (Task 1): stored choice wins, OS next, light default;
// blocked localStorage must not throw; document.dataset.theme is applied.
import assert from 'node:assert/strict'
import { test } from 'node:test'

function stubEnv({ stored, osDark = false, storageThrows = false }) {
  const store = new Map()
  if (stored !== undefined) store.set('sp-theme', stored)
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    get() {
      if (storageThrows) throw new Error('blocked')
      return {
        getItem: k => store.get(k) ?? null,
        setItem: (k, v) => store.set(k, v),
        removeItem: k => store.delete(k),
      }
    },
  })
  globalThis.matchMedia = () => ({ matches: osDark })
  const dataset = {}
  globalThis.document = { documentElement: { dataset } }
  return { store, dataset }
}

async function freshModule() {
  return import(`../src/composables/useTheme.js?t=${Math.random()}`)
}

test('blocked localStorage: initTheme does not throw, falls back to OS then light', async () => {
  stubEnv({ storageThrows: true, osDark: false })
  const { initTheme, useTheme } = await freshModule(); const { theme } = useTheme()
  assert.doesNotThrow(initTheme)
  assert.equal(theme.value, 'light')
})

test('stored dark wins over OS', async () => {
  stubEnv({ stored: 'dark', osDark: false })
  const { initTheme, useTheme } = await freshModule(); const { theme } = useTheme()
  initTheme()
  assert.equal(theme.value, 'dark')
  assert.equal(globalThis.document.documentElement.dataset.theme, 'dark')
})

test('bogus stored value falls back to OS dark', async () => {
  stubEnv({ stored: 'bogus', osDark: true })
  const { initTheme, useTheme } = await freshModule(); const { theme } = useTheme()
  initTheme()
  assert.equal(theme.value, 'dark')
})

test('setTheme persists and swaps instantly; toggleTheme flips', async () => {
  const { store } = stubEnv({ stored: 'light' })
  const { initTheme, setTheme, toggleTheme, useTheme } = await freshModule()
  const { theme } = useTheme()
  initTheme()
  setTheme('dark')
  assert.equal(theme.value, 'dark')
  assert.equal(store.get('sp-theme'), 'dark')
  assert.equal(globalThis.document.documentElement.dataset.theme, 'dark')
  toggleTheme()
  assert.equal(theme.value, 'light')
  assert.equal(store.get('sp-theme'), 'light')
})
