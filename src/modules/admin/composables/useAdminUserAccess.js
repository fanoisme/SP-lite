// SP-lite — per-user access overrides. Loads user_access rows + computes the
// effective set client-side via resolveUserAccess (same function login uses,
// so the admin preview matches what the user actually gets).
import { ref } from 'vue'
import { supabase } from '@/lib/supabase.js'
import { resolveUserAccess } from '@/lib/access.js'
import { useAuth } from '@/composables/useAuth.js'
import { useToast } from '@/lib/composables/useToast.js'

export function useAdminUserAccess() {
  const { session } = useAuth()
  const toast = useToast()
  const overrides = ref([])
  const effective = ref({ modules: [], features: {} })
  const loading = ref(false)
  const saving = ref(false)

  async function loadUserAccess(userId) {
    loading.value = true
    try {
      const { data: prof } = await supabase
        .from('profiles').select('role').eq('id', userId).single()
      const { data: rows } = await supabase
        .from('user_access').select('module_id, feature_id, mode').eq('user_id', userId)
      overrides.value = (rows || []).map(r => ({
        moduleId: r.module_id,
        featureId: r.feature_id || '',
        mode: r.mode,
      }))
      effective.value = await resolveUserAccess({ id: userId, role: prof?.role || '' })
    } catch { /* keep previous state */ }
    loading.value = false
  }

  async function saveUserAccess(userId, nextOverrides) {
    saving.value = true
    try {
      // Anti-lockout: cannot deny the admin module to yourself.
      if (userId === session.value?.user?.id) {
        const selfAdminDeny = nextOverrides.some(o => o.moduleId === 'admin' && o.mode === 'deny')
        if (selfAdminDeny) {
          toast.error('Cannot deny the admin module to yourself')
          return false
        }
      }
      const { error: e } = await supabase.from('user_access').delete().eq('user_id', userId)
      if (e) { toast.error('Failed to save overrides'); return false }
      if (nextOverrides.length) {
        const rows = nextOverrides.map(o => ({
          user_id: userId, module_id: o.moduleId,
          feature_id: o.featureId || '', mode: o.mode,
        }))
        const { error: e2 } = await supabase.from('user_access').insert(rows)
        if (e2) { toast.error('Failed to save overrides'); return false }
      }
      await loadUserAccess(userId)
      toast.success('Access overrides saved')
      return true
    } catch {
      toast.error('Network error')
      return false
    } finally {
      saving.value = false
    }
  }

  return { overrides, effective, loading, saving, loadUserAccess, saveUserAccess }
}
