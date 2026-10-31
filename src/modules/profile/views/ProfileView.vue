<template>
  <div class="profile">
    <!-- Header -->
    <div class="profile__header">
      <div class="profile__header-badge">
        <LiIcon name="user" />
      </div>
      <div class="profile__header-text">
        <h1 class="profile__title">Profile</h1>
        <p class="profile__subtitle">Kelola informasi akun kamu</p>
      </div>
    </div>

    <!-- Messages -->
    <Transition name="profile-msg">
      <div v-if="errorMsg" class="profile__msg profile__msg--error">
        <LiIcon name="circle-x" />
        <span class="profile__msg-text">{{ errorMsg }}</span>
        <button class="profile__msg-close" aria-label="Dismiss error message" @click="errorMsg = ''">
          <LiIcon name="x" />
        </button>
      </div>
    </Transition>
    <Transition name="profile-msg">
      <div v-if="successMsg" class="profile__msg profile__msg--success">
        <LiIcon name="circle-check" />
        <span class="profile__msg-text">{{ successMsg }}</span>
        <button class="profile__msg-close" aria-label="Dismiss success message" @click="successMsg = ''">
          <LiIcon name="x" />
        </button>
      </div>
    </Transition>

    <div class="profile__grid">
      <!-- Profile Info Card -->
      <div class="profile__card" style="--card-delay: 0">
        <div class="profile__card-header">
          <div class="profile__card-icon">
            <LiIcon name="user" />
          </div>
          <h2 class="profile__card-title">Informasi Akun</h2>
        </div>

        <div class="profile__avatar-section">
          <div class="profile__avatar">
            <span class="profile__avatar-letter">{{ avatarLetter }}</span>
          </div>
          <div class="profile__avatar-info">
            <span class="profile__avatar-name">{{ profile?.full_name || profile?.username }}</span>
            <span class="profile__role-chip" :class="'profile__role-chip--' + (isAdmin ? 'admin' : 'user')">
              {{ profile?.role }}
            </span>
          </div>
        </div>

        <div class="profile__fields">
          <div class="profile__field">
            <label class="profile__label">Username</label>
            <div class="profile__input-wrap profile__input-wrap--has-action" :class="{ 'profile__input-wrap--error': usernameError }">
              <LiIcon name="badge" class="profile__input-icon" />
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
                aria-label="Save username"
                @click="onSaveUsername"
                title="Simpan username"
              >
                <span v-if="savingUsername" class="profile__spinner profile__spinner--sm"></span>
                <LiIcon v-else name="check" />
              </button>
            </div>
            <span v-if="usernameError" class="profile__field-error">{{ usernameError }}</span>
          </div>
          <div class="profile__field">
            <label class="profile__label">Email</label>
            <div class="profile__input-wrap profile__input-wrap--disabled">
              <LiIcon name="mail" class="profile__input-icon" />
              <input :value="session?.user?.email" type="text" class="profile__input" disabled />
            </div>
          </div>
          <div class="profile__field">
            <label class="profile__label">Nama Lengkap</label>
            <div class="profile__input-wrap">
              <LiIcon name="pencil" class="profile__input-icon" />
              <input v-model="fullName" type="text" class="profile__input" placeholder="Nama kamu" />
            </div>
          </div>
        </div>

        <button class="profile__btn profile__btn--primary" :disabled="savingName" @click="onSaveName">
          <span v-if="savingName" class="profile__spinner"></span>
          <template v-else>
            <LiIcon name="save" />
            Save Changes
          </template>
        </button>
      </div>

      <!-- Change Password Card -->
      <div class="profile__card" style="--card-delay: 1">
        <div class="profile__card-header">
          <div class="profile__card-icon profile__card-icon--secondary">
            <LiIcon name="lock" />
          </div>
          <h2 class="profile__card-title">Ganti Password</h2>
        </div>

        <div class="profile__fields">
          <div class="profile__field">
            <label class="profile__label">Password Saat Ini</label>
            <div class="profile__input-wrap">
              <LiIcon name="lock" class="profile__input-icon" />
              <input v-model="currentPassword" type="password" class="profile__input" placeholder="Password saat ini" autocomplete="current-password" />
            </div>
          </div>
          <div class="profile__field">
            <label class="profile__label">Password Baru</label>
            <div class="profile__input-wrap">
              <LiIcon name="key" class="profile__input-icon" />
              <input v-model="newPassword" type="password" class="profile__input" placeholder="Minimal 6 karakter" autocomplete="new-password" />
            </div>
          </div>
          <div class="profile__field">
            <label class="profile__label">Konfirmasi Password Baru</label>
            <div class="profile__input-wrap">
              <LiIcon name="key" class="profile__input-icon" />
              <input v-model="confirmPassword" type="password" class="profile__input" placeholder="Ulangi password baru" autocomplete="new-password" />
            </div>
          </div>
        </div>

        <button class="profile__btn profile__btn--secondary" :disabled="changingPassword" @click="onChangePassword">
          <span v-if="changingPassword" class="profile__spinner"></span>
          <template v-else>
            <LiIcon name="key" />
            Ganti Password
          </template>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useAuth } from '../../../composables/useAuth.js'

const { session, profile, isAdmin, updateFullName, updateUsername, changePassword } = useAuth()

const fullName = ref(profile.value?.full_name || '')
const savingName = ref(false)

const username = ref(profile.value?.username || '')
const usernameError = ref('')
const savingUsername = ref(false)

const currentPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const changingPassword = ref(false)

const errorMsg = ref('')
const successMsg = ref('')

const avatarLetter = computed(() => (profile.value?.full_name || profile.value?.username || '?').charAt(0).toUpperCase())

function clearMessages() {
  errorMsg.value = ''
  successMsg.value = ''
}

async function onSaveName() {
  clearMessages()
  savingName.value = true
  try {
    await updateFullName(fullName.value)
    successMsg.value = 'Nama berhasil disimpan'
  } catch (err) {
    errorMsg.value = err.message || 'Gagal menyimpan nama'
  } finally {
    savingName.value = false
  }
}

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
    username.value = profile.value.username
    successMsg.value = 'Username berhasil disimpan'
    usernameError.value = ''
  } catch (err) {
    usernameError.value = err.message || 'Gagal menyimpan username'
  } finally {
    savingUsername.value = false
  }
}

async function onChangePassword() {
  clearMessages()
  if (newPassword.value.length < 6) {
    errorMsg.value = 'Password baru minimal 6 karakter'
    return
  }
  if (newPassword.value !== confirmPassword.value) {
    errorMsg.value = 'Konfirmasi password tidak cocok'
    return
  }

  changingPassword.value = true
  try {
    await changePassword({ currentPassword: currentPassword.value, newPassword: newPassword.value })
    successMsg.value = 'Password berhasil diganti'
    currentPassword.value = ''
    newPassword.value = ''
    confirmPassword.value = ''
  } catch (err) {
    errorMsg.value = err.message || 'Gagal mengganti password'
  } finally {
    changingPassword.value = false
  }
}
</script>

<style scoped>
.profile {
  max-width: 900px;
  margin: 0 auto;
  padding-top: var(--space-6);
  animation: profile-enter 500ms var(--ease-enter) both;
}

@keyframes profile-enter {
  from { opacity: 0; transform: translateY(20px); }
  to   { opacity: 1; transform: translateY(0); }
}

/* ── Header ── */
.profile__header {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  margin-bottom: var(--space-6);
}

.profile__header-badge {
  width: 48px;
  height: 48px;
  border-radius: var(--radius-md);
  background: linear-gradient(135deg, var(--color-accent), var(--color-accent-strong));
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  box-shadow: var(--shadow-card);
}

.profile__header-badge .li-icon {
  font-size: 24px;
  color: var(--color-on-accent);
}

.profile__header-text {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.profile__title {
  font-family: var(--font-sans);
  font-weight: 700;
  font-size: 28px;
  color: var(--color-text);
  margin: 0;
  letter-spacing: -0.5px;
  line-height: 1.1;
}

.profile__subtitle {
  font-size: 14px;
  color: var(--color-text-muted);
  margin: 0;
}

/* ── Messages ── */
.profile__msg {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-sm);
  font-size: 13px;
  font-weight: 500;
  margin-bottom: var(--space-4);
}

.profile__msg--error {
  background: var(--color-danger-soft);
  color: var(--color-danger);
  border: 1px solid rgba(163, 49, 41, 0.12);
}

.profile__msg--success {
  background: var(--color-success-soft);
  color: var(--color-success);
  border: 1px solid rgba(23, 163, 230, 0.12);
}

.profile__msg .li-icon {
  font-size: 18px;
  flex-shrink: 0;
}

.profile__msg-text {
  flex: 1;
}

.profile__msg-close {
  margin-left: auto;
  background: none;
  border: none;
  cursor: pointer;
  padding: var(--space-1);
  color: inherit;
  opacity: 0.5;
  border-radius: var(--radius-xs);
  transition: opacity 200ms var(--ease-out), background 200ms var(--ease-out);
}

.profile__msg-close:hover {
  opacity: 1;
  background: var(--color-border);
}

.profile__msg-close .li-icon {
  font-size: 16px;
}

.profile-msg-enter-active { transition: all 300ms var(--ease-enter); }
.profile-msg-leave-active { transition: all 200ms var(--ease-out); }
.profile-msg-enter-from { opacity: 0; transform: translateY(-8px); }
.profile-msg-leave-to { opacity: 0; transform: translateY(-4px); }

/* ── Grid ── */
.profile__grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-4);
}

/* ── Card ── */
.profile__card {
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--space-6);
  box-shadow: var(--shadow-card);
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  animation: profile-card-in 600ms var(--ease-enter) both;
  animation-delay: calc(120ms, 0) * 120ms);
}

@keyframes profile-card-in {
  from { opacity: 0; transform: translateY(24px) scale(0.97); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}

.profile__card-header {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
}

.profile__card-icon {
  width: 40px;
  height: 40px;
  border-radius: var(--radius-sm);
  background: var(--color-warning-soft);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.profile__card-icon .li-icon {
  font-size: 20px;
  color: var(--color-warning);
}

.profile__card-icon--secondary {
  background: var(--color-info-soft);
}

.profile__card-icon--secondary .li-icon {
  color: var(--color-info);
}

.profile__card-title {
  font-family: var(--font-sans);
  font-weight: 700;
  font-size: 16px;
  color: var(--color-text);
  margin: 0;
  line-height: 1.3;
}

/* ── Avatar ── */
.profile__avatar-section {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  padding-bottom: var(--space-4);
  border-bottom: 1px solid var(--color-border);
}

.profile__avatar {
  width: 56px;
  height: 56px;
  border-radius: var(--radius-md);
  background: linear-gradient(135deg, var(--color-accent), var(--color-accent-strong));
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  box-shadow: var(--shadow-card);
}

.profile__avatar-letter {
  font-family: var(--font-sans);
  font-weight: 700;
  font-size: 24px;
  color: var(--color-on-accent);
}

.profile__avatar-info {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.profile__avatar-name {
  font-family: var(--font-sans);
  font-weight: 700;
  font-size: 18px;
  color: var(--color-text);
}

.profile__role-chip {
  display: inline-flex;
  align-items: center;
  padding: 2px 10px;
  border-radius: var(--radius-pill);
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.3px;
  width: fit-content;
}

.profile__role-chip--admin {
  background: var(--color-danger-soft);
  color: var(--color-danger);
}

.profile__role-chip--user {
  background: var(--color-warning-soft);
  color: var(--color-warning);
}

/* ── Fields ── */
.profile__fields {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.profile__field {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.profile__label {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-muted);
  letter-spacing: 0.01em;
}

.profile__input-wrap {
  position: relative;
  display: flex;
  align-items: center;
}

.profile__input-wrap--disabled {
  opacity: 0.65;
}

.profile__input-icon {
  position: absolute;
  left: 12px;
  font-size: 16px;
  color: var(--color-text-muted);
  pointer-events: none;
  transition: color 200ms var(--ease-out);
}

.profile__input {
  width: 100%;
  padding: 10px 12px 10px 38px;
  border: 1.5px solid var(--color-border-strong);
  border-radius: var(--radius-sm);
  font-size: 14px;
  font-family: var(--font-sans);
  color: var(--color-text);
  background: var(--color-bg);
  outline: none;
  transition: border-color 200ms var(--ease-out), box-shadow 200ms var(--ease-out), background 200ms var(--ease-out);
}

.profile__input:focus {
  border-color: var(--color-accent);
  box-shadow: 0 0 0 3px rgba(249, 199, 0, 0.12), var(--shadow-card);
  background: var(--color-bg);
}

.profile__input::placeholder {
  color: var(--color-text-muted);
}

.profile__input:disabled {
  background: var(--color-surface-2);
  color: var(--color-text-muted);
  cursor: not-allowed;
}

/* ── Buttons ── */
.profile__btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  padding: 12px var(--space-6);
  border: none;
  border-radius: var(--radius-pill);
  font-size: 14px;
  font-weight: 700;
  font-family: var(--font-sans);
  cursor: pointer;
  transition: transform 300ms var(--ease-out), box-shadow 300ms var(--ease-out), background 200ms var(--ease-out);
}

.profile__btn--primary {
  background: var(--color-accent);
  color: var(--color-on-accent);
  box-shadow: 0 2px 8px rgba(255, 188, 37, 0.25);
}

.profile__btn--primary:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: var(--shadow-pop), 0 4px 16px rgba(255, 188, 37, 0.3);
  background: var(--color-accent-strong);
}

.profile__btn--secondary {
  background: var(--color-surface-2);
  color: var(--color-text);
  border: 1px solid var(--color-border);
}

.profile__btn--secondary:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: var(--shadow-card);
  background: var(--color-border);
}

.profile__btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
  transform: none !important;
  box-shadow: none !important;
}

.profile__btn .li-icon {
  font-size: 18px;
}

.profile__spinner {
  width: 18px;
  height: 18px;
  border: 2.5px solid rgba(0, 0, 0, 0.15);
  border-bottom-color: transparent;
  border-radius: 50%;
  animation: profile-spin 700ms var(--ease-out) infinite;
  flex-shrink: 0;
}

@keyframes profile-spin {
  to { transform: rotate(360deg); }
}

/* ── Input error state ── */
.profile__input-wrap--error .profile__input {
  border-color: var(--color-danger);
  box-shadow: 0 0 0 3px rgba(204, 59, 51, 0.1);
}

/* Input with inline action button needs extra right padding so text
   doesn't clip behind the absolutely-positioned check button */
.profile__input-wrap--has-action .profile__input {
  padding-right: 40px;
}

.profile__field-error {
  font-size: 11px;
  font-weight: 500;
  color: var(--color-danger);
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
  border-radius: var(--radius-xs);
  border: none;
  background: transparent;
  color: var(--color-text-muted);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 200ms var(--ease-out), color 200ms var(--ease-out);
}

.profile__input-action:hover:not(:disabled) {
  background: var(--color-success-soft);
  color: var(--color-success);
}

.profile__input-action:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.profile__input-action .li-icon {
  font-size: 16px;
}

.profile__spinner--sm {
  width: 14px;
  height: 14px;
  border-width: 2px;
}

/* ── Responsive ── */
@media (max-width: 768px) {
  .profile__grid {
    grid-template-columns: 1fr;
  }

  .profile__title {
    font-size: 24px;
  }

  .profile__header-badge {
    width: 40px;
    height: 40px;
  }

  .profile__header-badge .li-icon {
    font-size: 20px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .profile,
  .profile__card {
    animation: none !important;
  }

  .profile__btn,
  .profile__input,
  .profile__msg-close {
    transition: none !important;
  }

  .profile__spinner {
    animation-duration: 1.4s !important;
  }
}
</style>
