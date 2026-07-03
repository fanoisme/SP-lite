# Edit Username on Profile Page

**Date:** 2026-07-03
**Status:** approved

## Summary

Enable username editing on the Profile page with client-side validation and duplicate checking via database UNIQUE constraint.

## Files to Change

### 1. `src/composables/useAuth.js`

Add `updateUsername(username: string)` function:

- Trim + lowercase the input
- Validate: alphanumeric (`a-z`, `0-9`), underscore, dot, dash only — regex `/^[a-z0-9._-]+$/`
- Length: 3–32 characters
- Call `supabase.from('profiles').update({ username }).eq('id', userId).select().single()`
- On error code `23505` (unique_violation): throw `"Username tidak tersedia"`
- On success: assign `profile.value = data`

### 2. `src/modules/profile/views/ProfileView.vue`

- Remove `disabled` from username `<input>`
- Add `v-model="username"` (reactive ref, initialized from `profile.username`)
- Add validation errors display below the input (red, small text)
- Add `updateUsername` to imports from `useAuth`
- Client-side validation (on input/blur):
  - Empty → "Username tidak boleh kosong"
  - < 3 chars → "Minimal 3 karakter"
  - > 32 chars → "Maksimal 32 karakter"
  - Invalid characters → "Hanya huruf, angka, underscore, titik, dan strip"
- Submit: call `updateUsername()`, on success show green toast, on duplicate catch error and show "Username tidak tersedia"

### 3. `supabase/schema.sql`

No changes needed. `profiles.username` already has a `UNIQUE` constraint.

## Behavior

| Scenario | Result |
|----------|--------|
| Valid, unique username | Profile updated, toast success |
| Duplicate username | Error message "Username tidak tersedia" under input |
| Invalid format | Client-side validation error under input |
| Same as current username | No-op or proceed (idempotent — UNIQUE won't trip on same value) |

## Not in Scope

- Real-time availability check (deferred — DB constraint is sufficient)
- Admin username editing (already exists via AdminUserDrawer)
- Username change propagating to other views (reactive profile ref handles this)
