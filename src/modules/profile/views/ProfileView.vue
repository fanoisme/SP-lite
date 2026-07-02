<template>
  <div class="profile">
    <!-- Header -->
    <div class="profile__header">
      <div class="profile__header-badge">
        <span class="material-symbols-outlined">person</span>
      </div>
      <div class="profile__header-text">
        <h1 class="profile__title">Profile</h1>
        <p class="profile__subtitle">Kelola informasi akun kamu</p>
      </div>
    </div>

    <!-- Messages -->
    <Transition name="profile-msg">
      <div v-if="errorMsg" class="profile__msg profile__msg--error">
        <span class="material-symbols-outlined">error</span>
        <span class="profile__msg-text">{{ errorMsg }}</span>
        <button class="profile__msg-close" @click="errorMsg = ''">
          <span class="material-symbols-outlined">close</span>
        </button>
      </div>
    </Transition>
    <Transition name="profile-msg">
      <div v-if="successMsg" class="profile__msg profile__msg--success">
        <span class="material-symbols-outlined">check_circle</span>
        <span class="profile__msg-text">{{ successMsg }}</span>
        <button class="profile__msg-close" @click="successMsg = ''">
          <span class="material-symbols-outlined">close</span>
        </button>
      </div>
    </Transition>

    <div class="profile__grid">
      <!-- Profile Info Card -->
      <div class="profile__card" style="--card-delay: 0">
        <div class="profile__card-header">
          <div class="profile__card-icon">
            <span class="material-symbols-outlined">person</span>
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
            <div class="profile__input-wrap profile__input-wrap--disabled">
              <span class="material-symbols-outlined profile__input-icon">badge</span>
              <input :value="profile?.username" type="text" class="profile__input" disabled />
            </div>
          </div>
          <div class="profile__field">
            <label class="profile__label">Email</label>
            <div class="profile__input-wrap profile__input-wrap--disabled">
              <span class="material-symbols-outlined profile__input-icon">mail</span>
              <input :value="session?.user?.email" type="text" class="profile__input" disabled />
            </div>
          </div>
          <div class="profile__field">
            <label class="profile__label">Nama Lengkap</label>
            <div class="profile__input-wrap">
              <span class="material-symbols-outlined profile__input-icon">edit</span>
              <input v-model="fullName" type="text" class="profile__input" placeholder="Nama kamu" />
            </div>
          </div>
        </div>

        <button class="profile__btn profile__btn--primary" :disabled="savingName" @click="onSaveName">
          <span v-if="savingName" class="profile__spinner"></span>
          <template v-else>
            <span class="material-symbols-outlined">save</span>
            Save Changes
          </template>
        </button>
      </div>

      <!-- Change Password Card -->
      <div class="profile__card" style="--card-delay: 1">
        <div class="profile__card-header">
          <div class="profile__card-icon profile__card-icon--secondary">
            <span class="material-symbols-outlined">lock</span>
          </div>
          <h2 class="profile__card-title">Ganti Password</h2>
        </div>

        <div class="profile__fields">
          <div class="profile__field">
            <label class="profile__label">Password Saat Ini</label>
            <div class="profile__input-wrap">
              <span class="material-symbols-outlined profile__input-icon">lock</span>
              <input v-model="currentPassword" type="password" class="profile__input" placeholder="Password saat ini" autocomplete="current-password" />
            </div>
          </div>
          <div class="profile__field">
            <label class="profile__label">Password Baru</label>
            <div class="profile__input-wrap">
              <span class="material-symbols-outlined profile__input-icon">key</span>
              <input v-model="newPassword" type="password" class="profile__input" placeholder="Minimal 6 karakter" autocomplete="new-password" />
            </div>
          </div>
          <div class="profile__field">
            <label class="profile__label">Konfirmasi Password Baru</label>
            <div class="profile__input-wrap">
              <span class="material-symbols-outlined profile__input-icon">key</span>
              <input v-model="confirmPassword" type="password" class="profile__input" placeholder="Ulangi password baru" autocomplete="new-password" />
            </div>
          </div>
        </div>

        <button class="profile__btn profile__btn--secondary" :disabled="changingPassword" @click="onChangePassword">
          <span v-if="changingPassword" class="profile__spinner"></span>
          <template v-else>
            <span class="material-symbols-outlined">key</span>
            Ganti Password
          </template>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useAuth } from '../../../composables/useAuth.js'

const { session, profile, isAdmin, updateFullName, changePassword } = useAuth()

const fullName = ref(profile.value?.full_name || '')
const savingName = ref(false)

const currentPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const changingPassword = ref(false)

const errorMsg = ref('')
const successMsg = ref('')

const avatarLetter = (profile.value?.full_name || profile.value?.username || '?').charAt(0).toUpperCase()

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
  padding-top: var(--space-xl, 24px);
  animation: profile-enter 500ms var(--ease-smooth) both;
}

@keyframes profile-enter {
  from { opacity: 0; transform: translateY(20px); }
  to   { opacity: 1; transform: translateY(0); }
}

/* ── Header ── */
.profile__header {
  display: flex;
  align-items: center;
  gap: var(--space-l, 16px);
  margin-bottom: var(--space-xl, 24px);
}

.profile__header-badge {
  width: 48px;
  height: 48px;
  border-radius: var(--radius-md, 16px);
  background: linear-gradient(135deg, var(--cta-primary-bg, #FFBC25), var(--color-orange-300, #FF8C00));
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  box-shadow: var(--shadow-sm);
}

.profile__header-badge .material-symbols-outlined {
  font-size: 24px;
  color: var(--cta-primary-text, #1E1E1E);
}

.profile__header-text {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs, 4px);
}

.profile__title {
  font-family: var(--font-display, 'Inter', sans-serif);
  font-weight: 700;
  font-size: 28px;
  color: var(--color-on-surface, #333);
  margin: 0;
  letter-spacing: -0.5px;
  line-height: 1.1;
}

.profile__subtitle {
  font-size: 14px;
  color: var(--color-on-surface-muted, #999);
  margin: 0;
}

/* ── Messages ── */
.profile__msg {
  display: flex;
  align-items: center;
  gap: var(--space-s, 8px);
  padding: var(--space-m, 12px) var(--space-l, 16px);
  border-radius: var(--radius-sm, 12px);
  font-size: 13px;
  font-weight: 500;
  margin-bottom: var(--space-l, 16px);
}

.profile__msg--error {
  background: var(--color-error-container, #FDECEE);
  color: var(--color-on-error-container, #A33129);
  border: 1px solid rgba(163, 49, 41, 0.12);
}

.profile__msg--success {
  background: var(--color-success-container, #ECFF8F);
  color: var(--color-on-success-container, #17A3E6);
  border: 1px solid rgba(23, 163, 230, 0.12);
}

.profile__msg .material-symbols-outlined {
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
  padding: var(--space-xs, 4px);
  color: inherit;
  opacity: 0.5;
  border-radius: var(--radius-xs, 8px);
  transition: opacity 200ms var(--ease-out), background 200ms var(--ease-out);
}

.profile__msg-close:hover {
  opacity: 1;
  background: rgba(0, 0, 0, 0.05);
}

.profile__msg-close .material-symbols-outlined {
  font-size: 16px;
}

.profile-msg-enter-active { transition: all 300ms var(--ease-smooth); }
.profile-msg-leave-active { transition: all 200ms var(--ease-out); }
.profile-msg-enter-from { opacity: 0; transform: translateY(-8px); }
.profile-msg-leave-to { opacity: 0; transform: translateY(-4px); }

/* ── Grid ── */
.profile__grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-l, 16px);
}

/* ── Card ── */
.profile__card {
  background: rgba(255, 255, 255, 0.7);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border: 1px solid var(--glass-border, rgba(255, 255, 255, 0.12));
  border-radius: var(--radius-lg, 24px);
  padding: var(--space-xl, 24px);
  box-shadow: var(--shadow-sm);
  display: flex;
  flex-direction: column;
  gap: var(--space-l, 16px);
  animation: profile-card-in 600ms var(--ease-smooth) both;
  animation-delay: calc(var(--card-delay, 0) * 120ms);
}

@keyframes profile-card-in {
  from { opacity: 0; transform: translateY(24px) scale(0.97); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}

.profile__card-header {
  display: flex;
  align-items: flex-start;
  gap: var(--space-m, 12px);
}

.profile__card-icon {
  width: 40px;
  height: 40px;
  border-radius: var(--radius-sm, 12px);
  background: var(--color-warning-container, #FFF3D6);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.profile__card-icon .material-symbols-outlined {
  font-size: 20px;
  color: var(--color-on-warning-container, #FF3000);
}

.profile__card-icon--secondary {
  background: var(--color-info-container, #E6E6FF);
}

.profile__card-icon--secondary .material-symbols-outlined {
  color: var(--color-on-info-container, #0047B2);
}

.profile__card-title {
  font-family: var(--font-display, 'Inter', sans-serif);
  font-weight: 700;
  font-size: 16px;
  color: var(--color-on-surface, #333);
  margin: 0;
  line-height: 1.3;
}

/* ── Avatar ── */
.profile__avatar-section {
  display: flex;
  align-items: center;
  gap: var(--space-l, 16px);
  padding-bottom: var(--space-l, 16px);
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
}

.profile__avatar {
  width: 56px;
  height: 56px;
  border-radius: var(--radius-md, 16px);
  background: linear-gradient(135deg, var(--cta-primary-bg, #FFBC25), var(--color-orange-200, #FFA726));
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  box-shadow: var(--shadow-sm);
}

.profile__avatar-letter {
  font-family: var(--font-display, 'Inter', sans-serif);
  font-weight: 700;
  font-size: 24px;
  color: var(--cta-primary-text, #1E1E1E);
}

.profile__avatar-info {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs, 4px);
}

.profile__avatar-name {
  font-family: var(--font-display, 'Inter', sans-serif);
  font-weight: 700;
  font-size: 18px;
  color: var(--color-on-surface, #333);
}

.profile__role-chip {
  display: inline-flex;
  align-items: center;
  padding: 2px 10px;
  border-radius: var(--radius-pill, 999px);
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.3px;
  width: fit-content;
}

.profile__role-chip--admin {
  background: var(--color-error-container, #FDECEE);
  color: var(--color-on-error-container, #A33129);
}

.profile__role-chip--user {
  background: var(--color-warning-container, #FFF3D6);
  color: var(--color-on-warning-container, #FF3000);
}

/* ── Fields ── */
.profile__fields {
  display: flex;
  flex-direction: column;
  gap: var(--space-m, 12px);
}

.profile__field {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs, 4px);
}

.profile__label {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-on-surface-variant, #808080);
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
  color: var(--color-on-surface-muted, #B3B3B3);
  pointer-events: none;
  transition: color 200ms var(--ease-out);
}

.profile__input {
  width: 100%;
  padding: 10px 12px 10px 38px;
  border: 1.5px solid rgba(0, 0, 0, 0.08);
  border-radius: var(--radius-sm, 12px);
  font-size: 14px;
  font-family: var(--font-body, 'Inter', sans-serif);
  color: var(--color-on-surface, #333);
  background: rgba(255, 255, 255, 0.6);
  outline: none;
  transition: border-color 200ms var(--ease-out), box-shadow 200ms var(--ease-out), background 200ms var(--ease-out);
}

.profile__input:focus {
  border-color: var(--color-yellow-400, #F9C700);
  box-shadow: 0 0 0 3px rgba(249, 199, 0, 0.12), var(--shadow-sm);
  background: rgba(255, 255, 255, 0.9);
}

.profile__input::placeholder {
  color: var(--color-on-surface-muted, #B3B3B3);
}

.profile__input:disabled {
  background: var(--color-surface-disabled, #EDF0F2);
  color: var(--color-on-surface-muted, #999);
  cursor: not-allowed;
}

/* ── Buttons ── */
.profile__btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-s, 8px);
  padding: 12px var(--space-xl, 24px);
  border: none;
  border-radius: var(--radius-pill, 999px);
  font-size: 14px;
  font-weight: 700;
  font-family: var(--font-body, 'Inter', sans-serif);
  cursor: pointer;
  transition: transform 300ms var(--ease-out), box-shadow 300ms var(--ease-out), background 200ms var(--ease-out);
}

.profile__btn--primary {
  background: var(--cta-primary-bg, #FFBC25);
  color: var(--cta-primary-text, #1E1E1E);
  box-shadow: 0 2px 8px rgba(255, 188, 37, 0.25);
}

.profile__btn--primary:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: var(--shadow-md), 0 4px 16px rgba(255, 188, 37, 0.3);
  background: var(--cta-primary-hover, #FFB60A);
}

.profile__btn--secondary {
  background: var(--color-gray-100, #F2F2F2);
  color: var(--color-on-surface, #333);
  border: 1px solid var(--color-outline-variant, #E6E6E6);
}

.profile__btn--secondary:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: var(--shadow-sm);
  background: var(--color-gray-200, #E6E6E6);
}

.profile__btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
  transform: none !important;
  box-shadow: none !important;
}

.profile__btn .material-symbols-outlined {
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

  .profile__header-badge .material-symbols-outlined {
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
