---
name: sp-lite-profile-self-heal
description: SP-lite on_auth_user_created trigger is unreliable — profiles self-heal via ensure_profile() RPC instead
metadata:
  type: project
---

In SP-lite, the `on_auth_user_created` trigger → `handle_new_user()` is the PRIMARY profile-creation mechanism, but it does NOT fire reliably for every `auth.users` insert (one signup got an auth.users row with no profile → never appeared in admin). The MCP can't verify trigger firing because its SQL runs in `session_replication_role = replica` (disables triggers).

**Why:** Auth inserts don't deterministically fire the trigger; depending on it alone orphaned users.

**How to apply:** Profile creation also has a self-heal fallback — the `ensure_profile()` Postgres RPC (security definer, uses `auth.uid()`) returns the caller's profile, creating it from `auth.users` if missing. `useAuth.loadProfile` calls `supabase.rpc('ensure_profile')` instead of a plain select. The admin Add User Edge Function also upserts the profile (doesn't assume the trigger ran). Keep both layers if touching signup/profile.

Related: [[sp-lite-auth-nav-timing]]
