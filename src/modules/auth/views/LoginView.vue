<template>
  <div class="auth">
    <!-- Brand panel — mockups/auth.html; hidden below 900px -->
    <aside class="auth__brand" aria-hidden="true">
      <LiLogo size="sm" :animate="true" :show-subtitle="false" />
      <div>
        <h2 class="auth__brand-title">
          Welcome to <em>SP-lite</em>
        </h2>
        <p class="auth__brand-sub">
          Sign in to continue to your workspace. Don't have an account yet? Ask an admin to add you.
        </p>
      </div>
      <div class="auth__coins"><i></i><i></i><i></i></div>
    </aside>

    <!-- Main column -->
    <main class="auth__main" tabindex="-1">
      <div class="auth__top">
        <LiLogo class="auth__mobile-logo" size="sm" :animate="true" :show-subtitle="false" />
      </div>

      <div class="auth-card">
        <h1 class="auth__title">{{ mode === 'signin' ? 'Sign in' : 'Sign up' }}</h1>

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

        <p class="auth__fine">
          <template v-if="mode === 'signin'">
            Belum punya akun? <button type="button" class="auth__link" @click="toggleMode">Sign up</button>
          </template>
          <template v-else>
            Sudah punya akun? <button type="button" class="auth__link" @click="toggleMode">Sign in</button>
          </template>
        </p>

        <p class="auth__fine">
          <router-link to="/" class="auth__link">
            <LiIcon name="arrow-left" aria-hidden="true" />
            Back to home
          </router-link>
        </p>
      </div>
    </main>
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
/* L2 focused flow, composition ported from mockups/auth.html + app.css .auth:
   two columns ≥900 (brand panel + centred 440px card), brand panel drops <900. */
.auth {
  min-height: 100vh;
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  background: var(--color-bg);
}

/* ── Brand panel ── */
.auth__brand {
  position: relative;
  display: grid;
  align-content: space-between;
  gap: var(--space-8);
  padding: var(--space-10) 56px;
  overflow: hidden;
  background: linear-gradient(155deg, var(--color-accent-soft) 0%, var(--color-accent-tint) 100%);
}

.auth__brand-title {
  margin: 0;
  max-width: 460px;
  font-size: clamp(32px, 3.2vw, 48px);
  line-height: 1.1;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.01em;
  color: var(--color-text-strong);
}

.auth__brand-title em {
  font-style: normal;
  background: linear-gradient(transparent 62%, var(--color-accent) 62%);
}

.auth__brand-sub {
  margin: var(--space-3) 0 0;
  max-width: 420px;
  color: var(--color-text);
}

.auth__coins i {
  position: absolute;
  border-radius: 50%;
  background: var(--color-accent);
  box-shadow: inset -6px -6px 0 var(--color-accent-strong);
  opacity: 0.9;
  animation: auth-coin-in 900ms var(--ease-spring) backwards;
}

.auth__coins i:nth-child(1) { width: 120px; height: 120px; right: -30px; bottom: 90px; animation-delay: 150ms; }
.auth__coins i:nth-child(2) { width: 64px; height: 64px; right: 120px; bottom: 40px; animation-delay: 260ms; }
.auth__coins i:nth-child(3) { width: 36px; height: 36px; right: 70px; bottom: 200px; animation-delay: 380ms; }

@keyframes auth-coin-in {
  from { transform: translateY(40px) scale(0.6); opacity: 0; }
}

/* ── Main column ── */
.auth__main {
  display: grid;
  align-content: center;
  justify-items: center;
  gap: var(--space-4);
  padding: var(--space-8) var(--space-6);
}

.auth__top {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  width: min(440px, 100%);
}

.auth__mobile-logo { display: none; }

.auth-card {
  width: min(440px, 100%);
  display: grid;
  gap: var(--space-6);
}

.auth__title {
  margin: 0;
  font-size: 32px;
  line-height: 40px;
  font-weight: 800;
  letter-spacing: -0.01em;
  color: var(--color-text-strong);
}

/* ── Form ── */
.login-form {
  display: grid;
  gap: var(--space-6);
}

/* ── Field — comfortable 48px (flow-body) ── */
.login-field {
  display: grid;
  gap: 6px;
}

.login-field__label {
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--color-text);
}

.login-field__input-group {
  display: flex;
  align-items: center;
  height: 48px;
  background: var(--color-bg);
  border: 1.5px solid var(--color-border-input);
  border-radius: 10px;
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
}

.login-error--info {
  background: var(--color-info-soft);
  color: var(--color-info);
}

.login-error__icon { flex-shrink: 0; }
.login-error__text { flex: 1; }

.login-error-slide-enter-active { transition: opacity var(--dur-short) var(--ease-enter), transform var(--dur-short) var(--ease-enter); }
.login-error-slide-leave-active { transition: opacity 120ms var(--ease-exit); }
.login-error-slide-enter-from { opacity: 0; transform: translateY(-6px); }
.login-error-slide-leave-to { opacity: 0; }

/* ── Submit — one primary, 48px block ── */
.login-submit {
  width: 100%;
  height: 48px;
  border: none;
  border-radius: var(--radius-pill);
  background: var(--color-accent);
  color: var(--color-on-accent);
  font: inherit;
  font-size: var(--text-base);
  font-weight: 600;
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

/* ── Fine print ── */
.auth__fine {
  margin: 0;
  font-size: 13px;
  line-height: 20px;
  color: var(--color-text-muted);
}

.auth__link {
  color: var(--color-text-strong);
  text-decoration: underline;
  text-underline-offset: 3px;
  font-weight: 600;
  font: inherit;
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.auth__link:hover { color: var(--color-text); }

.auth__link:focus-visible {
  outline: 2px solid var(--color-focus);
  outline-offset: 2px;
  border-radius: var(--radius-xs);
}

/* ── Collapse: brand panel drops below 900, small logo appears ── */
@media (max-width: 900px) {
  .auth { grid-template-columns: minmax(0, 1fr); }
  .auth__brand { display: none; }
  .auth__mobile-logo { display: inline-flex; height: 28px; }
}

/* ── Reduced Motion ── */
@media (prefers-reduced-motion: reduce) {
  .auth__coins i { animation: none; }
  .login-submit:hover:not(:disabled) { transform: none; }
}
</style>
