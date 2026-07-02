// SP-lite — admin module/feature access + global module state. Mirrors SO's
// useAdminAccess module-level shared state (AdminView loads; drawers read/
// write the same maps). Replace-operations are delete+insert against Supabase
// (RLS admin-only); not atomic across the two calls but each is idempotent on
// save and self-heals on the next load.
import { ref, reactive } from 'vue'
import { supabase } from '@/lib/supabase.js'
import { MODULE_REGISTRY, getAllModules } from '@/lib/modules.js'
import { useToast } from '@/lib/composables/useToast.js'

const allModules = ref([])
const accessMap = reactive({})
const featureMap = reactive({})
const moduleStates = reactive({})
const loading = ref(false)

export function resetAccessMaps() {
  allModules.value = []
  for (const k of Object.keys(accessMap)) delete accessMap[k]
  for (const k of Object.keys(featureMap)) delete featureMap[k]
  for (const k of Object.keys(moduleStates)) delete moduleStates[k]
  loading.value = false
}

export function useAdminAccess() {
  const toast = useToast()

  async function loadModules() {
    try {
      const [{ data: states }, { data: ma }] = await Promise.all([
        supabase.from('module_state').select('module_id, is_enabled'),
        supabase.from('module_access').select('module_id'),
      ])
      const stateMap = new Map((states || []).map(r => [r.module_id, r.is_enabled]))
      const countMap = new Map()
      for (const r of (ma || [])) countMap.set(r.module_id, (countMap.get(r.module_id) || 0) + 1)
      allModules.value = getAllModules().map(m => ({
        ...m,
        is_enabled: stateMap.has(m.id) ? stateMap.get(m.id) : true,
        role_count: countMap.get(m.id) || 0,
      }))
      for (const m of allModules.value) moduleStates[m.id] = m.is_enabled
    } catch { /* network — UI keeps previous state */ }
  }

  function isModuleEnabled(moduleId) {
    return moduleStates[moduleId] ?? true
  }

  async function setModuleEnabled(moduleId, enabled) {
    if (moduleId === 'admin' && !enabled) {
      toast.error('Cannot disable the admin module (anti-lockout)')
      return false
    }
    const { error: e } = await supabase
      .from('module_state').upsert({ module_id: moduleId, is_enabled: enabled })
    if (e) {
      toast.error('Failed to toggle module')
      return false
    }
    moduleStates[moduleId] = enabled
    toast.success(`${moduleId} ${enabled ? 'enabled' : 'disabled'} globally`)
    return true
  }

  async function loadAccess(roleNames) {
    loading.value = true
    try {
      const { data } = await supabase.from('module_access').select('role, module_id')
      for (const role of roleNames) accessMap[role] = []
      for (const row of (data || [])) {
        if (!accessMap[row.role]) accessMap[row.role] = []
        accessMap[row.role].push(row.module_id)
      }
    } catch { /* keep previous */ }
    loading.value = false
  }

  function isModuleGranted(role, moduleId) {
    return (accessMap[role] || []).includes(moduleId)
  }

  async function toggleModule(role, moduleId) {
    const current = accessMap[role] || []
    const granted = !current.includes(moduleId)
    const newModules = granted ? [...current, moduleId] : current.filter(m => m !== moduleId)
    if (role === 'Admin' && !newModules.includes('admin')) newModules.push('admin')

    const { error: e } = await supabase.from('module_access').delete().eq('role', role)
    if (e) { toast.error('Failed to update module access'); return false }
    if (newModules.length) {
      const { error: e2 } = await supabase
        .from('module_access').insert(newModules.map(m => ({ role, module_id: m })))
      if (e2) { toast.error('Failed to update module access'); await loadAccess(Object.keys(accessMap)); return false }
    }
    accessMap[role] = newModules
    toast.success(`${role}: ${granted ? 'granted' : 'revoked'} ${moduleId}`)
    return true
  }

  async function loadFeatureAccess() {
    try {
      const { data } = await supabase.from('feature_access').select('role, module_id, feature_id')
      for (const row of (data || [])) {
        const k = `${row.role}|${row.module_id}`
        if (!featureMap[k]) featureMap[k] = []
        if (!featureMap[k].includes(row.feature_id)) featureMap[k].push(row.feature_id)
      }
    } catch { /* keep previous */ }
  }

  function featuresGranted(role, moduleId) {
    return featureMap[`${role}|${moduleId}`] || null
  }

  async function setRoleFeatures(role, moduleId, featureIds) {
    const { error: e } = await supabase
      .from('feature_access').delete().eq('role', role).eq('module_id', moduleId)
    if (e) { toast.error('Failed to update feature access'); return false }
    if (featureIds.length) {
      const { error: e2 } = await supabase
        .from('feature_access').insert(featureIds.map(f => ({ role, module_id: moduleId, feature_id: f })))
      if (e2) { toast.error('Failed to update feature access'); return false }
    }
    featureMap[`${role}|${moduleId}`] = featureIds
    toast.success(`${role} · ${moduleId}: features updated`)
    return true
  }

  return {
    allModules, accessMap, featureMap, moduleStates, loading,
    loadModules, loadAccess, isModuleGranted, toggleModule,
    loadFeatureAccess, featuresGranted, setRoleFeatures,
    isModuleEnabled, setModuleEnabled, resetAccessMaps,
  }
}
