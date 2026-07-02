import { ref, computed } from 'vue'
import { supabase } from '../lib/supabase.js'

// Module-level state so every component sharing useAuth() sees the same
// session/profile, matching the existing useToast.js singleton pattern.
const session = ref(null)
const profile = ref(null)
const loading = ref(true)
let initialized = null

async function loadProfile(userId) {
  if (!userId) {
    profile.value = null
    return
  }
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()

  if (error) {
    console.error('[auth] failed to load profile', error)
    profile.value = null
    return
  }
  profile.value = data
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
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
}

function redirectUrl() {
  return `${window.location.origin}${window.location.pathname}`
}

async function signInWithMagicLink(email) {
  const { error } = await supabase.auth.signInWithOtp({
    email: email.trim(),
    options: { emailRedirectTo: redirectUrl() },
  })
  if (error) throw error
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
}

async function signOut() {
  await supabase.auth.signOut()
  session.value = null
  profile.value = null
}

export function useAuth() {
  return {
    session,
    profile,
    loading,
    isAuthenticated: computed(() => !!session.value),
    isAdmin: computed(() => profile.value?.role === 'admin'),
    ensureAuthLoaded,
    signInWithPassword,
    signInWithMagicLink,
    signUp,
    signOut,
  }
}
