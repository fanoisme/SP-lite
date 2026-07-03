<template>
  <div class="login-page">
    <!-- Ambient mesh background -->
    <div class="login-mesh-bg" aria-hidden="true">
      <div class="login-orb login-orb--1"></div>
      <div class="login-orb login-orb--2"></div>
      <div class="login-orb login-orb--3"></div>
    </div>

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
          <span class="material-symbols-outlined login-error__icon" aria-hidden="true">
            {{ bannerType === 'info' ? 'info' : 'error' }}
          </span>
          <span class="login-error__text">{{ bannerMsg }}</span>
        </div>
      </Transition>

      <form class="login-form" @submit.prevent="onPasswordSubmit" novalidate>
        <div class="login-field" v-if="mode === 'signin'">
          <label class="login-field__label" for="identifier">Username atau Email</label>
          <div class="login-field__input-group" :class="{ 'is-focused': focus.identifier }">
            <span class="material-symbols-outlined login-field__icon" aria-hidden="true">person</span>
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
              <span class="material-symbols-outlined login-field__icon" aria-hidden="true">badge</span>
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
              <span class="material-symbols-outlined login-field__icon" aria-hidden="true">mail</span>
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
              <span class="material-symbols-outlined login-field__icon" aria-hidden="true">alternate_email</span>
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
            <span class="material-symbols-outlined login-field__icon" aria-hidden="true">lock</span>
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
            >
              <span class="material-symbols-outlined">{{ showPassword ? 'visibility_off' : 'visibility' }}</span>
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
        <span class="material-symbols-outlined" aria-hidden="true">arrow_back</span>
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
.login-page {
  position: relative;
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-page-bg, #E6E6E6);
  overflow: hidden;
  padding: var(--space-l, 16px) 0;
}

/* ── Mesh Background ── */
.login-mesh-bg {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: var(--z-base, 0);
}

.login-orb {
  position: absolute;
  border-radius: 50%;
  filter: blur(30px);
  opacity: 0.3;
  animation: login-drift 25s cubic-bezier(0.4, 0, 0.2, 1) infinite alternate;
}

.login-orb--1 {
  width: 500px;
  height: 500px;
  background: radial-gradient(circle, var(--color-yellow-100, #FFF3D6), transparent 70%);
  top: -10%;
  right: -5%;
  animation-duration: 22s;
}

.login-orb--2 {
  width: 400px;
  height: 400px;
  background: radial-gradient(circle, var(--color-blue-100, #E6E6FF), transparent 70%);
  bottom: -10%;
  left: 200px;
  animation-duration: 28s;
  animation-delay: -5s;
}

.login-orb--3 {
  width: 350px;
  height: 350px;
  background: radial-gradient(circle, var(--color-yellow-100, #FFF3D6), transparent 70%);
  top: 40%;
  left: 40%;
  opacity: 0.25;
  animation-duration: 32s;
  animation-delay: -10s;
}

@keyframes login-drift {
  0% { transform: translate(0, 0) scale(1); }
  33% { transform: translate(30px, -20px) scale(1.05); }
  66% { transform: translate(-20px, 15px) scale(0.95); }
  100% { transform: translate(10px, -10px) scale(1.02); }
}

/* ── Card ── */
.login-card {
  position: relative;
  z-index: var(--z-content, 1);
  width: 100%;
  max-width: 420px;
  margin: 0 clamp(12px, 2vw, 24px);
  padding: clamp(32px, 4vw, 44px) clamp(24px, 3vw, 40px);
  background: rgba(255, 255, 255, 0.82);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border-radius: var(--radius-lg, 24px);
  border: 1.5px solid var(--glass-edge-glow, rgba(255, 255, 255, 0.2));
  box-shadow:
    0 8px 32px rgba(0, 0, 0, 0.08),
    0 2px 8px rgba(0, 0, 0, 0.04),
    inset 0 1px 0 rgba(255, 255, 255, 0.6);
  animation: login-card-in 700ms var(--ease-spring, cubic-bezier(0.34, 1.56, 0.64, 1)) both;
}

@keyframes login-card-in {
  0% {
    opacity: 0;
    transform: translateY(40px) scale(0.92);
  }
  60% {
    opacity: 1;
    transform: translateY(-6px) scale(1.01);
  }
  80% {
    transform: translateY(2px) scale(0.998);
  }
  100% {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

/* ── Logo ── */
.login-logo {
  display: flex;
  justify-content: center;
  margin-bottom: clamp(16px, 2vw, 24px);
}

/* ── Title ── */
.login-title {
  text-align: center;
  font-family: var(--font-display, 'Inter', sans-serif);
  font-weight: 700;
  font-size: clamp(24px, 3vw, 30px);
  letter-spacing: -0.5px;
  color: var(--color-on-surface, #333);
  margin: 0 0 4px;
}

.login-subtitle {
  text-align: center;
  font-size: clamp(12px, 1.2vw, 14px);
  font-weight: 500;
  color: var(--color-on-surface-muted, #999);
  margin: 0 0 clamp(20px, 2.5vw, 28px);
}

/* ── Form ── */
.login-form {
  display: flex;
  flex-direction: column;
  gap: clamp(14px, 2vw, 18px);
}

/* ── Field ── */
.login-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.login-field__label {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-gray-700, #666);
}

.login-field__optional {
  font-weight: 400;
  color: var(--color-gray-400, #B3B3B3);
}

.login-field__input-group {
  display: flex;
  align-items: center;
  background: var(--color-surface-bright, #fff);
  border: 1.5px solid var(--color-outline, #CCC);
  border-radius: var(--radius-sm, 12px);
  overflow: hidden;
  transition:
    border-color 250ms var(--ease-out),
    box-shadow 250ms var(--ease-out);
}

.login-field__input-group.is-focused {
  border-color: var(--color-yellow-400, #F9C700);
  box-shadow: 0 0 0 3px rgba(249, 199, 0, 0.12);
}

.login-field__icon {
  font-size: 20px;
  color: var(--color-gray-400, #B3B3B3);
  padding: 0 4px 0 14px;
  flex-shrink: 0;
  transition: color 250ms var(--ease-out);
}

.login-field__input-group.is-focused .login-field__icon {
  color: var(--color-yellow-500, #F4A600);
}

.login-field__input {
  flex: 1;
  border: none;
  background: transparent;
  padding: 13px 14px 13px 8px;
  font-size: 15px;
  font-family: var(--font-body, 'Inter', sans-serif);
  color: var(--color-on-surface, #333);
  outline: none;
  min-width: 0;
}

.login-field__input::placeholder {
  color: var(--color-gray-400, #B3B3B3);
}

.login-field__toggle {
  background: none;
  border: none;
  cursor: pointer;
  padding: var(--space-s, 8px) 12px;
  color: var(--color-gray-400, #B3B3B3);
  display: flex;
  align-items: center;
  border-radius: var(--radius-xs, 8px);
  transition: color 200ms var(--ease-out), background 200ms var(--ease-out);
}

.login-field__toggle:hover {
  color: var(--color-gray-700, #666);
  background: rgba(0, 0, 0, 0.04);
}

.login-field__toggle .material-symbols-outlined {
  font-size: 20px;
}

/* ── Error / info banner ── */
.login-error {
  display: flex;
  align-items: center;
  gap: var(--space-s, 8px);
  padding: 10px 14px;
  background: var(--color-error-container, #FDECEE);
  border-radius: var(--radius-sm, 12px);
  color: var(--color-on-error-container, #A33129);
  font-size: 13px;
  font-weight: 500;
  margin-bottom: clamp(14px, 2vw, 18px);
}

.login-error--info {
  background: var(--color-info-container, #E6E6FF);
  color: var(--color-on-info-container, #0047B2);
}

.login-error__icon {
  font-size: 18px;
  flex-shrink: 0;
}

.login-error__text {
  flex: 1;
}

.login-error-slide-enter-active {
  animation: login-error-in 400ms var(--ease-spring, cubic-bezier(0.34, 1.56, 0.64, 1)) both;
}

.login-error-slide-leave-active {
  animation: login-error-out 250ms var(--ease-out) both;
}

@keyframes login-error-in {
  0% { opacity: 0; transform: translateY(-8px) scaleY(0.8); max-height: 0; }
  100% { opacity: 1; transform: translateY(0) scaleY(1); max-height: 80px; }
}

@keyframes login-error-out {
  0% { opacity: 1; transform: translateY(0) scaleY(1); max-height: 80px; }
  100% { opacity: 0; transform: translateY(-4px) scaleY(0.9); max-height: 0; }
}

/* ── Submit Button ── */
.login-submit {
  width: 100%;
  height: 48px;
  border: none;
  border-radius: var(--radius-sm, 12px);
  background: var(--cta-primary-bg, #FFBC25);
  color: var(--cta-primary-text, #1E1E1E);
  font-family: var(--font-display, 'Inter', sans-serif);
  font-weight: 700;
  font-size: 15px;
  letter-spacing: -0.2px;
  cursor: pointer;
  position: relative;
  overflow: hidden;
  transition:
    transform 300ms var(--ease-spring),
    background 300ms var(--ease-out),
    box-shadow 400ms var(--ease-out);
  box-shadow: var(--shadow-sm);
}

.login-submit:hover:not(:disabled) {
  background: var(--cta-primary-hover, #FFB60A);
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}

.login-submit:active:not(:disabled) {
  transform: scale(0.97);
  transition-duration: 120ms;
}

.login-submit:disabled {
  cursor: not-allowed;
  opacity: 0.75;
}

.login-submit__spinner-wrap {
  display: inline-flex;
  align-items: center;
  gap: var(--space-s, 8px);
}

.login-submit__spinner {
  display: inline-block;
  width: 18px;
  height: 18px;
  border: 2.5px solid rgba(0, 0, 0, 0.15);
  border-top-color: rgba(0, 0, 0, 0.6);
  border-radius: 50%;
  animation: login-spin 800ms cubic-bezier(0.4, 0, 0.2, 1) infinite;
}

@keyframes login-spin {
  to { transform: rotate(360deg); }
}

.login-btn-crossfade-enter-active {
  transition: opacity 150ms var(--ease-out);
}

.login-btn-crossfade-leave-active {
  transition: opacity 100ms var(--ease-out);
}

.login-btn-crossfade-enter-from,
.login-btn-crossfade-leave-to {
  opacity: 0;
}

/* ── Mode switch ── */
.login-mode-switch {
  display: block;
  width: 100%;
  background: none;
  border: none;
  cursor: pointer;
  margin-top: clamp(12px, 1.5vw, 16px);
  font-size: 12px;
  font-weight: 600;
  color: var(--color-blue-400, #2563EB);
  text-align: center;
  font-family: var(--font-body, 'Inter', sans-serif);
}

.login-mode-switch:hover {
  text-decoration: underline;
}

/* ── Back Link ── */
.login-back {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  margin-top: clamp(12px, 1.5vw, 18px);
  font-size: 12px;
  font-weight: 500;
  color: var(--color-on-surface-muted, #999);
  text-decoration: none;
  transition: color 250ms var(--ease-out), transform 250ms var(--ease-smooth);
}

.login-back:hover {
  color: var(--color-gray-800, #4D4D4D);
  transform: translateX(-2px);
}

.login-back .material-symbols-outlined {
  font-size: 16px;
}

/* ── Responsive ── */
@media (max-width: 480px) {
  .login-card {
    margin: 0 var(--space-l, 16px);
  }
}

/* ── Reduced Motion ── */
@media (prefers-reduced-motion: reduce) {
  .login-orb { animation: none; }
  .login-card { animation: none; opacity: 1; }
  .login-submit { transition: background 200ms var(--ease-out); }
  .login-submit:hover:not(:disabled) { transform: none; }
  .login-back:hover { transform: none; }
}
</style>
