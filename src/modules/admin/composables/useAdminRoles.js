// SP-lite — admin roles composable. SO-Platform cascade-renames via a single
// server transaction; here we replicate it as sequential Supabase writes
// (RLS permits admin-only). Role names stay in sync across profiles,
// module_access and feature_access.
import { ref } from 'vue'
import { supabase } from '@/lib/supabase.js'
import { useToast } from '@/lib/composables/useToast.js'

export function useAdminRoles() {
  const toast = useToast()
  const roles = ref([])
  const loading = ref(false)
  const error = ref(null)

  async function loadRoles() {
    loading.value = true
    error.value = null
    try {
      const [{ data: rows, error: e1 }, { data: profileRoles }] = await Promise.all([
        supabase.from('roles').select('*').order('id'),
        supabase.from('profiles').select('role'),
      ])
      if (e1) throw e1
      const counts = new Map()
      for (const r of (profileRoles || [])) {
        counts.set(r.role, (counts.get(r.role) || 0) + 1)
      }
      roles.value = (rows || []).map(r => ({ ...r, user_count: counts.get(r.name) || 0 }))
    } catch (e) {
      error.value = e.message
    }
    loading.value = false
  }

  async function createRole(name) {
    error.value = null
    if (name === 'Admin') {
      error.value = 'Cannot create reserved role "Admin"'
      return false
    }
    const { data, error: e } = await supabase
      .from('roles').insert({ name, is_system: false })
      .select('*').single()
    if (e) {
      error.value = e.code === '23505' ? 'Role already exists' : e.message
      return false
    }
    roles.value.push({ ...data, user_count: 0 })
    toast.success(`Role ${data.name} created`)
    return true
  }

  async function renameRole(id, name) {
    error.value = null
    if (name === 'Admin') {
      error.value = 'Cannot rename to reserved "Admin"'
      return false
    }
    const existing = roles.value.find(r => r.id === id)
    if (!existing) { error.value = 'Role not found'; return false }
    if (existing.is_system) { error.value = 'Cannot rename system role'; return false }
    const oldName = existing.name

    // Cascade the new name across every table keyed by role.
    const updates = await Promise.all([
      supabase.from('profiles').update({ role: name }).eq('role', oldName),
      supabase.from('module_access').update({ role: name }).eq('role', oldName),
      supabase.from('feature_access').update({ role: name }).eq('role', oldName),
      supabase.from('roles').update({ name }).eq('id', id).select('*').single(),
    ])
    const roleUpdate = updates[3]
    if (roleUpdate.error) {
      error.value = roleUpdate.error.code === '23505' ? 'Role name already exists' : roleUpdate.error.message
      return false
    }
    const idx = roles.value.findIndex(r => r.id === id)
    if (idx !== -1) roles.value[idx] = { ...roles.value[idx], ...roleUpdate.data }
    toast.success(`Role renamed to ${name}`)
    return true
  }

  async function deleteRole(id) {
    error.value = null
    const role = roles.value.find(r => r.id === id)
    if (!role) { error.value = 'Role not found'; return false }
    if (role.is_system) { error.value = 'Cannot delete system role'; return false }
    if (role.user_count > 0) {
      error.value = `Cannot delete "${role.name}" — ${role.user_count} user(s) still assigned`
      return false
    }
    await Promise.all([
      supabase.from('module_access').delete().eq('role', role.name),
      supabase.from('feature_access').delete().eq('role', role.name),
      supabase.from('roles').delete().eq('id', id),
    ])
    roles.value = roles.value.filter(r => r.id !== id)
    toast.success('Role deleted')
    return true
  }

  return { roles, loading, error, loadRoles, createRole, renameRole, deleteRole }
}
