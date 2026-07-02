---
name: sp-lite-auth-nav-timing
description: SP-lite router guard reads session synchronously — auth state must update before router.push, not via onAuthStateChange
metadata:
  type: project
---

In SP-lite the router `beforeEach` guard reads `session.value` / `profile.value` synchronously the instant `router.push()` runs. `supabase.auth.onAuthStateChange` fires AFTER the push, so relying on it for post-login/logout state leaves the refs stale → the guard bounces navigation (login stuck on /login, logout stuck on the app, until a manual refresh).

**Why:** Vue Router guards run synchronously with the push; the async onAuthStateChange callback loses the race.

**How to apply:** In `useAuth.js`, `signInWithPassword` sets `session.value = data.session` + calls `loadProfile` synchronously before returning; `signOut` clears refs optimistically BEFORE `await supabase.auth.signOut()`. Keep this pattern if touching auth/nav — don't move state updates back into the onAuthStateChange callback.

Related: [[sp-lite-deploy-github-pages]] [[sp-lite-profile-self-heal]]
