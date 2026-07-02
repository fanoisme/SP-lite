import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  console.warn(
    '[supabase] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are not set — ' +
    'copy .env.example to .env.local and fill in your project credentials. ' +
    'Falling back to a placeholder so the app can still render; auth calls will fail.'
  )
}

// createClient() throws synchronously on an empty/invalid URL, which would
// otherwise blank the entire app before Vue mounts. Fall back to a
// syntactically-valid placeholder so a missing config only breaks auth
// calls (surfaced via the warning above), not the whole page.
const safeUrl = url || 'https://placeholder.supabase.co'
const safeAnonKey = anonKey || 'placeholder-anon-key'

// flowType: 'pkce' makes magic-link/OTP redirects land with a `?code=`
// query param instead of a `#access_token=` hash fragment — required here
// because the app uses hash-based routing (see src/router/index.js) and a
// hash fragment would collide with vue-router's own `#/path`.
export const supabase = createClient(safeUrl, safeAnonKey, {
  auth: {
    flowType: 'pkce',
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})
