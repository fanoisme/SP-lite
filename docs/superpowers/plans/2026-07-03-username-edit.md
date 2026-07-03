# Username Edit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable username editing on Profile page with client-side validation and duplicate detection via DB UNIQUE constraint.

**Architecture:** Add `updateUsername()` to the `useAuth` singleton composable (mirrors existing `updateFullName` pattern), then enable the already-rendered username `<input>` in `ProfileView.vue` by removing `disabled`, binding `v-model`, adding inline validation errors, and wiring a save flow.

**Tech Stack:** Vue 3 Composition API, Supabase JS client

## Global Constraints

- Username format: alphanumeric (`a-z`, `0-9`), underscore, dot, dash — regex `/^[a-z0-9._-]+$/`
- Length: 3–32 characters
- Lowercase automatically (trim + lowercase before save)
- Duplicate detection: catch Postgres error code `23505` (unique_violation) from Supabase
- Error messages in Bahasa Indonesia
- Spec: `docs/superpowers/specs/2026-07-03-username-edit.md`

---

### Task 1: Add `updateUsername` to `useAuth.js`

**Files:**
- Modify: `src/composables/useAuth.js`

**Produces:** `updateUsername(username)` async function, exported from `useAuth()`

- [ ] **Step 1: Add `updateUsername` function**

Insert after the `updateFullName` function (after line 133) and before `changePassword`:

```javascript
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
```

- [ ] **Step 2: Export `updateUsername` from `useAuth()` return object**

Add `updateUsername` to the returned object (line 154-168). Insert after `updateFullName`:

```javascript
updateUsername,
```

Full return block becomes:

```javascript
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
```

- [ ] **Step 3: Commit**

```bash
git add src/composables/useAuth.js
git commit -m "feat(profile): add updateUsername to useAuth composable"
```

---

### Task 2: Enable username editing in ProfileView.vue

**Files:**
- Modify: `src/modules/profile/views/ProfileView.vue`

**Consumes:** `updateUsername` from `useAuth()`

- [ ] **Step 1: Enable username input, add v-model and error state, add save button**

**Script changes (lines 134-151):**

Import `updateUsername`:
```javascript
const { session, profile, isAdmin, updateFullName, updateUsername, changePassword } = useAuth()
```

Add username reactive state (after `fullName` ref, line 141):
```javascript
const username = ref(profile.value?.username || '')
const usernameError = ref('')
const savingUsername = ref(false)
```

**Template changes (lines 57-63):**

Replace the disabled username input block:
```html
          <div class="profile__field">
            <label class="profile__label">Username</label>
            <div class="profile__input-wrap" :class="{ 'profile__input-wrap--error': usernameError }">
              <span class="material-symbols-outlined profile__input-icon">badge</span>
              <input
                v-model="username"
                type="text"
                class="profile__input"
                :class="{ 'profile__input--error': usernameError }"
                placeholder="Username kamu"
                @input="usernameError = ''"
                @blur="validateUsername()"
              />
            </div>
            <span v-if="usernameError" class="profile__field-error">{{ usernameError }}</span>
          </div>
```

**Add save username button after the full_name field section, before the existing save button:**

Insert after line 77 (`</div>` closing `.profile__fields`, before the `<button class="profile__btn profile__btn--primary">`):
```html
        <button class="profile__btn profile__btn--primary" :disabled="savingUsername" @click="onSaveUsername">
          <span v-if="savingUsername" class="profile__spinner"></span>
          <template v-else>
            <span class="material-symbols-outlined">save</span>
            Save Username
          </template>
        </button>
```

Wait — re-reading the layout: the "Informasi Akun" card has full_name fields, then ONE save button at the bottom. The spec says username gets its own validation/save. Currently there's one "Save Changes" button that saves fullName. The UX cleanest approach: make username save independently with its own button adjacent to the username field, and keep the existing full_name save separate. Actually, looking at the spec more carefully — it says "Submit: call updateUsername(), on success show green toast". Let's keep it simple: put a save button next to the username field (inline), keep the fullName save button at the bottom as-is.

Actually, looking at the existing layout again: the "Save Changes" button at the bottom saves fullName. If I add username next to fullName with its own save, they'd both be under the same "Save Changes" button... but the user expects independent saving per the spec. Let's do: username field + its own save button in the username row, full_name field + its own save button at the bottom. That keeps it clear.

Let me revise — add a small inline save button next to username input:

Actually simplest: just add username to the fields list like fullName, but give it its own save button below the fields. No — let me re-read the spec. The spec doesn't say two separate save buttons. It just says "Submit". Let me keep it dead simple: username field edits inline, a small save icon button appears when username differs from original. Or... just have ALL fields under one "Save Changes" button that saves both username and fullName.

No, the spec says username has its own validation and its own error messages. Merging them into one save complicates error handling (which field failed?). Separate flow is cleaner and follows the existing per-field pattern.

OK let me finalize: I'll add the username field with v-model (replacing the disabled one), add an inline save button for username. The fullName save stays as-is. Each field saves independently — clean, matches the existing pattern.

Let me redo the template changes:

**Replace the disabled username block (lines 57-62):**
```html
          <div class="profile__field">
            <label class="profile__label">Username</label>
            <div class="profile__input-wrap" :class="{ 'profile__input-wrap--error': usernameError }">
              <span class="material-symbols-outlined profile__input-icon">badge</span>
              <input
                v-model="username"
                type="text"
                class="profile__input"
                :class="{ 'profile__input--error': usernameError }"
                placeholder="Username kamu"
                @input="usernameError = ''"
              />
              <button
                class="profile__input-action"
                :disabled="savingUsername || username === (profile?.username || '')"
                @click="onSaveUsername"
                title="Simpan username"
              >
                <span v-if="savingUsername" class="profile__spinner profile__spinner--sm"></span>
                <span v-else class="material-symbols-outlined">check</span>
              </button>
            </div>
            <span v-if="usernameError" class="profile__field-error">{{ usernameError }}</span>
          </div>
```

This is cleaner — inline check button next to the input. Only enabled when username differs from current value.

**Script additions:**

Add `validateUsername` and `onSaveUsername` functions after the existing functions:

```javascript
function validateUsername() {
  const val = username.value.trim().toLowerCase()
  if (!val) {
    usernameError.value = 'Username tidak boleh kosong'
    return false
  }
  if (val.length < 3) {
    usernameError.value = 'Minimal 3 karakter'
    return false
  }
  if (val.length > 32) {
    usernameError.value = 'Maksimal 32 karakter'
    return false
  }
  if (!/^[a-z0-9._-]+$/.test(val)) {
    usernameError.value = 'Hanya huruf, angka, underscore, titik, dan strip'
    return false
  }
  return true
}

async function onSaveUsername() {
  clearMessages()
  if (!validateUsername()) return

  savingUsername.value = true
  try {
    await updateUsername(username.value)
    successMsg.value = 'Username berhasil disimpan'
    usernameError.value = ''
  } catch (err) {
    usernameError.value = err.message || 'Gagal menyimpan username'
  } finally {
    savingUsername.value = false
  }
}
```

- [ ] **Step 2: Add CSS for error state and inline action button**

Add these styles inside the `<style scoped>` block:

```css
/* ── Input error state ── */
.profile__input-wrap--error .profile__input {
  border-color: var(--color-error, #CC3B33);
  box-shadow: 0 0 0 3px rgba(204, 59, 51, 0.1);
}

.profile__input--error {
  border-color: var(--color-error, #CC3B33);
}

.profile__field-error {
  font-size: 11px;
  font-weight: 500;
  color: var(--color-error, #CC3B33);
  margin-top: 2px;
}

/* ── Inline input action button ── */
.profile__input-action {
  position: absolute;
  right: 4px;
  top: 50%;
  transform: translateY(-50%);
  width: 28px;
  height: 28px;
  border-radius: var(--radius-xs, 8px);
  border: none;
  background: transparent;
  color: var(--color-on-surface-muted, #B3B3B3);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 200ms var(--ease-out), color 200ms var(--ease-out);
}

.profile__input-action:hover:not(:disabled) {
  background: var(--color-success-container, #ECFF8F);
  color: var(--color-on-success-container, #17A3E6);
}

.profile__input-action:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.profile__input-action .material-symbols-outlined {
  font-size: 16px;
}

.profile__spinner--sm {
  width: 14px;
  height: 14px;
  border-width: 2px;
}
```

The `.profile__input-wrap` needs `position: relative` for the absolute-positioned action button — it already has it (line 467: `position: relative`). Good.

- [ ] **Step 3: Commit**

```bash
git add src/modules/profile/views/ProfileView.vue
git commit -m "feat(profile): enable username editing with validation"
```
