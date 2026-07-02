// SP-lite — module registry cache. SO-Platform fetches /api/modules; here the
// registry is a static constant (src/lib/modules.js), so this just exposes it
// in the same { registry, loadRegistry } shape the admin components expect.
import { ref } from 'vue'
import { MODULE_REGISTRY } from '@/lib/modules.js'

const registry = ref(MODULE_REGISTRY)

export function resetRegistry() {
  registry.value = MODULE_REGISTRY
}

export function useModules() {
  async function loadRegistry() {
    registry.value = MODULE_REGISTRY
    return registry.value
  }
  return { registry, loadRegistry, resetRegistry }
}
