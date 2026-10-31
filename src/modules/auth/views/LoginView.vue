<template>
  <div class="login-page">
    <div class="login-card">
      <!-- Logo -->
      <div class="login-logo">
        <LiLogo size="lg" :animate="true" :compact="true" />
      </div>

      <h1 class="login-title">SP-lite</h1>
      <p class="login-subtitle">QRIS · Template · Video Tools</p>

      <!-- Error / info banner -->
      <Transition name="login-error-slide">
        <div v-if="bannerMsg" class="login-error" :class="{ 'login-error--info': bannerType === 'info' }" role="alert">
          <LiIcon :name="bannerType === 'info' ? 'info' : 'circle-x'" class="login-error__icon" aria-hidden="true" />
          <span class="login-error__text">{{ bannerMsg }}</span>
        </div>
      </Transition>

      <form class="login-form" @submit.prevent="onPasswordSubmit" novalidate>
        <div class="login-field" v-if="mode === 'signin'">
          <label class="login-field__label" for="identifier">Username atau Email</label>
          <div class="login-field__input-group" :class="{ 'is-focused': focus.identifier }">
            <LiIcon name="user" class="login-field__icon" aria-hidden="true" />
            <input
              id="identifier"
              v-model="identifier"
              type="text"
              class="login-field__input"
              placeholder="username atau nama@perusahaan.com"
              autocomplete="username"
              @focus="focus.identifier = true"
              @blur="focus.identifier = false"
            />
          </div>
        </div>

        <template v-else>
          <div class="login-field">
            <label class="login-field__label" for="signup-fullname">Full Name</label>
            <div class="login-field__input-group" :class="{ 'is-focused': focus.signupFullName }">
              <LiIcon name="badge" class="login-field__icon" aria-hidden="true" />
              <input
                id="signup-fullname"
                v-model="signupFullName"
                type="text"
                class="login-field__input"
                placeholder="Your full name"
                autocomplete="name"
                @focus="focus.signupFullName = true"
                @blur="focus.signupFullName = false"
              />
            </div>
          </div>
          <div class="login-field">
            <label class="login-field__label" for="signup-email">Email</label>
            <div class="login-field__input-group" :class="{ 'is-focused': focus.signupEmail }">
              <LiIcon name="mail" class="login-field__icon" aria-hidden="true" />
              <input
                id="signup-email"
                v-model="signupEmail"
                type="email"
                class="login-field__input"
                placeholder="nama@perusahaan.com"
                autocomplete="email"
                @focus="focus.signupEmail = true"
                @blur="focus.signupEmail = false"
              />
            </div>
          </div>
          <div class="login-field">
            <label class="login-field__label" for="signup-username">Username</label>
            <div class="login-field__input-group" :class="{ 'is-focused': focus.signupUsername }">
              <LiIcon name="at-sign" class="login-field__icon" aria-hidden="true" />
              <input
                id="signup-username"
                v-model="signupUsername"
                type="text"
                class="login-field__input"
                placeholder="username"
                autocomplete="username"
                @focus="focus.signupUsername = true"
                @blur="focus.signupUsername = false"
              />
            </div>
          </div>
        </template>

        <div class="login-field">
          <label class="login-field__label" for="password">Password</label>
          <div class="login-field__input-group" :class="{ 'is-focused': focus.password }">
            <LiIcon name="lock" class="login-field__icon" aria-hidden="true" />
            <input
              id="password"
              v-model="password"
              :type="showPassword ? 'text' : 'password'"
              class="login-field__input"
              placeholder="••••••••"
              :autocomplete="mode === 'signin' ? 'current-password' : 'new-password'"
              @focus="focus.password = true"
              @blur="focus.password = false"
            />
            <button
              type="button"
              class="login-field__toggle"
              @click="showPassword = !showPassword"
              :aria-label="showPassword ? 'Hide password' : 'Show password'"
              :aria-pressed="showPassword"
            >
              <LiIcon :name="showPassword ? 'eye-off' : 'eye'" />
            </button>
          </div>
        </div>

        <button type="submit" class="login-submit" :class="{ 'login-submit--loading': submitting }" :disabled="submitting">
          <Transition name="login-btn-crossfade" mode="out-in">
            <span v-if="submitting" key="spinner" class="login-submit__spinner-wrap">
              <span class="login-submit__spinner"></span>
              {{ mode === 'signin' ? 'Signing in...' : 'Signing up...' }}
            </span>
            <span v-else key="label">{{ mode === 'signin' ? 'Sign In' : 'Sign Up' }}</span>
          </Transition>
        </button>
      </form>

      <button type="button" class="login-mode-switch" @click="toggleMode">
        {{ mode === 'signin' ? "Belum punya akun? Sign up" : 'Sudah punya akun? Sign in' }}
      </button>

      <router-link to="/" class="login-back">
        <LiIcon name="arrow-left" aria-hidden="true" />
        Back to home
      </router-link>
    </div>
  </div>
</template>

<script setup>
import { ref, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '../../../composables/useAuth.js'
import LiLogo from '../../../lib/components/LiLogo.vue'

const router = useRouter()
const { signInWithPassword, signUp } = useAuth()

const mode = ref('signin') // 'signin' | 'signup'
const submitting = ref(false)
const showPassword = ref(false)

const identifier = ref('')
const password = ref('')
const signupEmail = ref('')
const signupUsername = ref('')
const signupFullName = ref('')

const focus = ref({
  identifier: false,
  signupFullName: false,
  signupEmail: false,
  signupUsername: false,
  password: false,
})

const bannerMsg = ref('')
const bannerType = ref('error') // 'error' | 'info'
let bannerTimer = null

function showBanner(msg, type = 'error') {
  bannerMsg.value = msg
  bannerType.value = type
  if (bannerTimer) clearTimeout(bannerTimer)
  bannerTimer = setTimeout(() => { bannerMsg.value = '' }, 6000)
}

onUnmounted(() => {
  if (bannerTimer) clearTimeout(bannerTimer)
})

function toggleMode() {
  mode.value = mode.value === 'signin' ? 'signup' : 'signin'
  bannerMsg.value = ''
}

async function onPasswordSubmit() {
  submitting.value = true
  bannerMsg.value = ''
  try {
    if (mode.value === 'signin') {
      await signInWithPassword({ identifier: identifier.value, password: password.value })
      router.push({ name: 'dashboard' })
    } else {
      if (!signupFullName.value.trim()) {
        showBanner('Full name is required')
        return
      }
      if (!signupUsername.value.trim()) {
        showBanner('Username is required')
        return
      }
      const usernameRegex = /^[a-z0-9._-]{3,32}$/
      if (!usernameRegex.test(signupUsername.value.trim())) {
        showBanner('Username: 3-32 characters, lowercase letters, numbers, dots, hyphens, underscores only')
        return
      }
      await signUp({
        email: signupEmail.value,
        password: password.value,
        username: signupUsername.value,
        fullName: signupFullName.value,
      })
      showBanner('Akun dibuat. Menunggu aktivasi dari admin sebelum bisa sign in.', 'info')
      signupFullName.value = ''
      signupUsername.value = ''
      signupEmail.value = ''
      mode.value = 'signin'
    }
  } catch (err) {
    showBanner(err.message || 'Gagal, coba lagi')
  } finally {
    submitting.value = false
  }
}

</script>

<style scoped>
/* L2 focused flow (auth.html): bare centred card, comfortable density
   (48px controls), exactly one primary action. */
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-surface);
  padding: var(--space-6) var(--space-4);
}

.login-card {
  width: 100%;
  max-width: 640px;
  padding: var(--space-10) var(--space-10) var(--space-8);
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-card);
  animation: login-card-in var(--dur-medium) var(--ease-enter) both;
}

@keyframes login-card-in {
  from { opacity: 0; transform: translateY(12px); }
}

/* ── Logo ── */
.login-logo {
  display: flex;
  justify-content: center;
  margin-bottom: var(--space-6);
}

/* ── Title ── */
.login-title {
  text-align: center;
  font-weight: 600;
  font-size: var(--text-lg);
  line-height: var(--leading-lg);
  color: var(--color-text-strong);
  margin: 0 0 var(--space-1);
}

.login-subtitle {
  text-align: center;
  font-size: var(--text-sm);
  color: var(--color-text-muted);
  margin: 0 0 var(--space-8);
}

/* ── Form ── */
.login-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
}

/* ── Field — comfortable 48px ── */
.login-field {
  display: grid;
  gap: 6px;
}

.login-field__label {
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--color-text);
}

.login-field__input-group {
  display: flex;
  align-items: center;
  height: 48px;
  background: var(--color-bg);
  border: 1px solid var(--color-border-input);
  border-radius: var(--radius-sm);
  transition: border-color var(--dur-quick), box-shadow var(--dur-short) var(--ease-out);
}

.login-field__input-group.is-focused {
  border-color: var(--color-focus);
  box-shadow: 0 0 0 4px var(--glow-focus);
}

.login-field__icon {
  color: var(--color-text-muted);
  padding: 0 var(--space-1) 0 var(--space-4);
  flex-shrink: 0;
  transition: color var(--dur-quick);
}

.login-field__input-group.is-focused .login-field__icon {
  color: var(--color-text);
}

.login-field__input {
  flex: 1;
  border: none;
  background: transparent;
  padding: 0 var(--space-4) 0 var(--space-2);
  font: inherit;
  font-size: var(--text-base);
  color: var(--color-text-strong);
  outline: none;
  min-width: 0;
}

.login-field__input::placeholder {
  color: var(--color-text-placeholder);
}

.login-field__toggle {
  background: none;
  border: none;
  cursor: pointer;
  padding: var(--space-2) var(--space-3);
  color: var(--color-text-muted);
  display: flex;
  align-items: center;
  border-radius: var(--radius-sm);
  transition: color var(--dur-quick), background var(--dur-quick);
}

.login-field__toggle:hover {
  color: var(--color-text-strong);
  background: var(--color-hover);
}

.login-field__toggle:focus-visible {
  outline: 2px solid var(--color-focus);
  outline-offset: 2px;
}

/* ── Error / info banner ── */
.login-error {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-3);
  background: var(--color-danger-soft);
  border-radius: 10px;
  color: var(--color-danger);
  font-size: var(--text-sm);
  font-weight: 500;
  margin-bottom: var(--space-4);
}

.login-error--info {
  background: var(--color-info-soft);
  color: var(--color-info);
}

.login-error__icon {
  flex-shrink: 0;
}

.login-error__text {
  flex: 1;
}

.login-error-slide-enter-active { transition: opacity var(--dur-short) var(--ease-enter), transform var(--dur-short) var(--ease-enter); }
.login-error-slide-leave-active { transition: opacity 120ms var(--ease-exit); }
.login-error-slide-enter-from { opacity: 0; transform: translateY(-6px); }
.login-error-slide-leave-to { opacity: 0; }

/* ── Submit — the one primary action ── */
.login-submit {
  width: 100%;
  height: 48px;
  border: none;
  border-radius: var(--radius-pill);
  background: var(--color-accent);
  color: var(--color-on-accent);
  font: inherit;
  font-weight: 700;
  font-size: var(--text-base);
  cursor: pointer;
  transition:
    background var(--dur-quick),
    box-shadow var(--dur-short) var(--ease-out),
    transform var(--dur-instant) var(--ease-out);
}

.login-submit:hover:not(:disabled) {
  background: var(--color-accent-strong);
  box-shadow: 0 6px 16px -6px rgba(255, 165, 0, 0.55);
}

.login-submit:active:not(:disabled) { transform: scale(0.97); }

.login-submit:focus-visible {
  outline: 2px solid var(--color-on-accent);
  outline-offset: 2px;
}

.login-submit:disabled {
  cursor: not-allowed;
  background: var(--color-surface-2);
  color: var(--color-text-muted);
}

.login-submit__spinner-wrap {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
}

.login-submit__spinner {
  display: inline-block;
  width: 18px;
  height: 18px;
  border: 2px solid currentColor;
  border-right-color: transparent;
  border-radius: 50%;
  animation: login-spin 700ms linear infinite;
}

@keyframes login-spin {
  to { transform: rotate(360deg); }
}

.login-btn-crossfade-enter-active { transition: opacity var(--dur-quick); }
.login-btn-crossfade-leave-active { transition: opacity 120ms; }
.login-btn-crossfade-enter-from,
.login-btn-crossfade-leave-to { opacity: 0; }

/* ── Mode switch ── */
.login-mode-switch {
  display: block;
  width: 100%;
  background: none;
  border: none;
  cursor: pointer;
  margin-top: var(--space-4);
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--color-text-strong);
  text-align: center;
}

.login-mode-switch:hover { text-decoration: underline; text-underline-offset: 4px; }
.login-mode-switch:focus-visible { outline: 2px solid var(--color-focus); outline-offset: 2px; border-radius: var(--radius-xs); }

/* ── Back Link ── */
.login-back {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  margin-top: var(--space-4);
  font-size: var(--text-sm);
  font-weight: 500;
  color: var(--color-text-muted);
  text-decoration: none;
  transition: color var(--dur-quick);
}

.login-back:hover { color: var(--color-text-strong); }

/* ── Responsive ── */
@media (max-width: 600px) {
  .login-card {
    padding: var(--space-8) var(--space-6);
  }
}

/* ── Reduced Motion ── */
@media (prefers-reduced-motion: reduce) {
  .login-card { animation: none; }
  .login-submit:hover:not(:disabled) { transform: none; }
}
</style>
