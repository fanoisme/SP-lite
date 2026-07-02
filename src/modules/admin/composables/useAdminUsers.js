// SP-lite — admin users composable. Mirrors SO-Platform's useAdminUsers API
// but talks to Supabase directly (RLS gates every write to admins).
//
// Deliberate gap vs SO-Platform: there is no service-role key in this static
// site, so the client cannot create auth.users rows. Users self-register via
// the login screen; admins only manage role / active / overrides / delete.
import { ref, computed, watch } from 'vue'
import { supabase } from '@/lib/supabase.js'
import { useAuth } from '@/composables/useAuth.js'
import { useToast } from '@/lib/composables/useToast.js'

export function useAdminUsers() {
  const { session } = useAuth()
  const toast = useToast()
  const users = ref([])
  const loading = ref(true)
  const error = ref(null)

  const searchQuery = ref('')
  const sortKey = ref('created_at')
  const sortOrder = ref('desc')
  const currentPage = ref(1)
  const pageSize = ref(10)

  watch(searchQuery, () => { currentPage.value = 1 })

  const currentUser = computed(() => ({ id: session.value?.user?.id }))

  const filteredUsers = computed(() => {
    let result = users.value
    if (searchQuery.value) {
      const q = searchQuery.value.toLowerCase()
      result = result.filter(u =>
        (u.username || '').toLowerCase().includes(q) ||
        (u.full_name || '').toLowerCase().includes(q) ||
        (u.role || '').toLowerCase().includes(q),
      )
    }
    return result
  })

  const sortedUsers = computed(() => {
    return [...filteredUsers.value].sort((a, b) => {
      const va = a[sortKey.value] ?? ''
      const vb = b[sortKey.value] ?? ''
      const cmp = typeof va === 'number' && typeof vb === 'number'
        ? va - vb
        : String(va).localeCompare(String(vb))
      return sortOrder.value === 'asc' ? cmp : -cmp
    })
  })

  const totalPages = computed(() => Math.max(1, Math.ceil(sortedUsers.value.length / pageSize.value)))

  const paginatedUsers = computed(() => {
    const start = (currentPage.value - 1) * pageSize.value
    return sortedUsers.value.slice(start, start + pageSize.value)
  })

  function setSort(key) {
    if (sortKey.value === key) {
      sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc'
    } else {
      sortKey.value = key
      sortOrder.value = 'asc'
    }
  }

  async function loadUsers() {
    loading.value = true
    error.value = null
    try {
      const [{ data: rows, error: e1 }, { data: overrideRows }] = await Promise.all([
        supabase.from('profiles')
          .select('id, username, role, full_name, is_active, created_at, updated_at')
          .order('created_at', { ascending: false }),
        supabase.from('user_access').select('user_id'),
      ])
      if (e1) throw e1
      const withOverrides = new Set((overrideRows || []).map(r => r.user_id))
      users.value = (rows || []).map(u => ({ ...u, has_overrides: withOverrides.has(u.id) }))
    } catch (e) {
      error.value = e.message
    }
    loading.value = false
  }

  async function createUser(userData) {
    error.value = null
    // Delegated to the admin-create-user Edge Function — only the server
    // holds the service_role key needed to create an auth.users row.
    const { data, error: fnErr } = await supabase.functions.invoke('admin-create-user', {
      body: {
        email: userData.email,
        password: userData.password,
        username: userData.username,
        full_name: userData.fullName,
        role: userData.role,
      },
    })
    if (fnErr) {
      error.value = fnErr.message
      toast.error('Failed to create user')
      return false
    }
    if (data?.error) {
      error.value = data.error
      return false
    }
    users.value.unshift({ ...data.user, has_overrides: false })
    toast.success(`User ${data.user.username || data.user.email} created`)
    return true
  }

  async function updateUserRole(userId, newRole) {
    error.value = null
    const { data, error: e } = await supabase
      .from('profiles').update({ role: newRole }).eq('id', userId)
      .select('id, username, role, full_name, is_active, created_at, updated_at').single()
    if (e) {
      error.value = e.message
      toast.error('Failed to update role')
      return false
    }
    const idx = users.value.findIndex(u => u.id === userId)
    if (idx !== -1) users.value[idx] = { ...users.value[idx], ...data, has_overrides: users.value[idx].has_overrides }
    toast.success(`Role updated to ${newRole}`)
    return true
  }

  async function deleteUser(userId) {
    error.value = null
    if (userId === session.value?.user?.id) {
      toast.error('Cannot delete your own account')
      return false
    }
    const { error: e } = await supabase.from('profiles').delete().eq('id', userId)
    if (e) {
      error.value = e.message
      toast.error('Failed to delete user')
      return false
    }
    users.value = users.value.filter(u => u.id !== userId)
    toast.success('User deleted')
    return true
  }

  async function updateUserActive(userId, is_active) {
    error.value = null
    if (userId === session.value?.user?.id && !is_active) {
      toast.error('Cannot deactivate your own account')
      return false
    }
    const { data, error: e } = await supabase
      .from('profiles').update({ is_active }).eq('id', userId)
      .select('id, username, role, full_name, is_active, created_at, updated_at').single()
    if (e) {
      error.value = e.message
      toast.error('Failed to update status')
      return false
    }
    const idx = users.value.findIndex(u => u.id === userId)
    if (idx !== -1) users.value[idx] = { ...users.value[idx], ...data, has_overrides: users.value[idx].has_overrides }
    toast.success(`${data.username || 'User'} ${is_active ? 'activated' : 'deactivated'}`)
    return true
  }

  return {
    users, loading, error, currentUser,
    searchQuery, sortKey, sortOrder, currentPage, pageSize,
    filteredUsers, sortedUsers, paginatedUsers, totalPages,
    setSort, loadUsers, createUser, updateUserRole, updateUserActive, deleteUser,
  }
}
