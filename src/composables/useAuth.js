import { ref, computed } from 'vue'
import { supabase } from '../lib/supabase.js'
import { resolveUserAccess } from '../lib/access.js'

// Module-level state so every component sharing useAuth() sees the same
// session/profile/access set, matching the existing useToast.js singleton pattern.
const session = ref(null)
const profile = ref(null)
const loading = ref(true)
const userModules = ref([])
const userFeatures = ref({})
let initialized = null

async function loadProfile(userId) {
  if (!userId) {
    profile.value = null
    userModules.value = []
    userFeatures.value = {}
    return
  }
  // ensure_profile returns the profile, creating it from auth.users if the
  // on_auth_user_created trigger missed (it doesn't fire reliably for every
  // signup). Self-heals instead of depending on the trigger alone.
  const { data, error } = await supabase.rpc('ensure_profile')

  if (error || !data) {
    console.error('[auth] failed to load profile', error)
    profile.value = null
    userModules.value = []
    userFeatures.value = {}
    return
  }
  profile.value = data
  // Resolve module/feature access (port of SO-Platform's resolveUserAccess).
  // Admin → all non-disabled modules; others → role baseline + per-user overrides.
  const access = await resolveUserAccess({ id: data.id, role: data.role })
  userModules.value = access.modules
  userFeatures.value = access.features
}

function ensureAuthLoaded() {
  if (initialized) return initialized

  initialized = (async () => {
    const { data } = await supabase.auth.getSession()
    session.value = data.session
    await loadProfile(data.session?.user?.id)
    loading.value = false

    supabase.auth.onAuthStateChange(async (_event, newSession) => {
      session.value = newSession
      await loadProfile(newSession?.user?.id)
    })
  })()

  return initialized
}

async function resolveEmail(identifier) {
  if (identifier.includes('@')) return identifier

  const { data, error } = await supabase.rpc('email_for_username', {
    p_username: identifier,
  })
  if (error || !data) throw new Error('Username tidak ditemukan atau akun nonaktif.')
  return data
}

async function signInWithPassword({ identifier, password }) {
  const email = await resolveEmail(identifier.trim())
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  // Block accounts pending admin activation (is_active defaults to false on
  // signup). Checked here so it covers both username and email logins.
  const { data: prof } = await supabase
    .from('profiles').select('is_active').eq('id', data.user.id).single()
  if (!prof?.is_active) {
    await supabase.auth.signOut()
    throw new Error('Akun belum diaktivasi. Hubungi admin.')
  }
  // Set session synchronously from the response — the router guard runs
  // before onAuthStateChange fires, so relying on the callback leaves
  // session.value stale and the guard blocks the post-login navigation.
  session.value = data.session
  await loadProfile(data.user.id)
}

function redirectUrl() {
  return `${window.location.origin}${window.location.pathname}`
}

async function signUp({ email, password, username, fullName }) {
  const { error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
    options: {
      emailRedirectTo: redirectUrl(),
      data: {
        username: username?.trim() || undefined,
        full_name: fullName?.trim() || undefined,
      },
    },
  })
  if (error) throw error
  // New signups are inactive until an admin activates them. If signUp created
  // a session (email-confirm disabled), drop it — they must wait for approval.
  await supabase.auth.signOut()
}

async function signOut() {
  // Clear optimistically before the network call — the router guard runs the
  // instant push() happens, so session.value must already be null or the
  // guard's "authed user hitting a public route" branch bounces nav back.
  session.value = null
  profile.value = null
  userModules.value = []
  userFeatures.value = {}
  await supabase.auth.signOut()
}

async function updateFullName(fullName) {
  const userId = session.value?.user?.id
  if (!userId) throw new Error('Tidak ada sesi aktif')

  const { data, error } = await supabase
    .from('profiles')
    .update({ full_name: fullName.trim() })
    .eq('id', userId)
    .select()
    .single()

  if (error) throw error
  profile.value = data
}

async function updateUsername(username) {
  const userId = session.value?.user?.id
  if (!userId) throw new Error('Tidak ada sesi aktif')

  const trimmed = username.trim().toLowerCase()

  if (!trimmed) throw new Error('Username tidak boleh kosong')
  if (trimmed.length < 3) throw new Error('Minimal 3 karakter')
  if (trimmed.length > 32) throw new Error('Maksimal 32 karakter')
  if (!/^[a-z0-9._-]+$/.test(trimmed)) throw new Error('Hanya huruf, angka, underscore, titik, dan strip')

  const { data, error } = await supabase
    .from('profiles')
    .update({ username: trimmed })
    .eq('id', userId)
    .select()
    .single()

  if (error) {
    if (error.code === '23505') throw new Error('Username tidak tersedia')
    throw error
  }
  profile.value = data
}

async function changePassword({ currentPassword, newPassword }) {
  const email = session.value?.user?.email
  if (!email) throw new Error('Tidak ada sesi aktif')

  // Supabase's updateUser() doesn't ask for the current password, so it's
  // verified explicitly here first (mirrors SO-Platform's change-password
  // flow) rather than letting anyone with an open session set a new one.
  const { error: reauthError } = await supabase.auth.signInWithPassword({
    email,
    password: currentPassword,
  })
  if (reauthError) throw new Error('Password saat ini salah')

  const { error } = await supabase.auth.updateUser({ password: newPassword })
  if (error) throw error
}

export function useAuth() {
  return {
    session,
    profile,
    loading,
    userModules,
    userFeatures,
    isAuthenticated: computed(() => !!session.value),
    isAdmin: computed(() => profile.value?.role === 'Admin'),
    ensureAuthLoaded,
    signInWithPassword,
    signUp,
    signOut,
    updateFullName,
    updateUsername,
    changePassword,
  }
}
