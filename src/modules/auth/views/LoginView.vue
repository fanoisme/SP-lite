<template>
  <div class="login">
    <div class="login__card-wrap">
      <LiLogo size="md" :animate="true" :show-subtitle="true" />

      <LiCard class="login__card">
        <LiTabs v-model="activeTab" :tabs="tabs">
          <!-- Password tab (username or email) -->
          <div v-if="activeTab === 0" class="login__panel">
            <LiBanner
              v-if="mode === 'signup'"
              variant="info"
              message="Buat akun baru. Username opsional — kalau dikosongkan, dibuat otomatis dari email."
            />

            <form class="login__form" @submit.prevent="onPasswordSubmit">
              <LiTextField
                v-if="mode === 'signin'"
                v-model="identifier"
                label="Username atau email"
                placeholder="username atau nama@perusahaan.com"
                autocomplete="username"
              />
              <LiTextField
                v-else
                v-model="signupEmail"
                type="email"
                label="Email"
                placeholder="nama@perusahaan.com"
                autocomplete="email"
              />
              <LiTextField
                v-if="mode === 'signup'"
                v-model="signupUsername"
                label="Username (opsional)"
                placeholder="username"
                autocomplete="username"
              />
              <LiTextField
                v-model="password"
                type="password"
                label="Password"
                placeholder="••••••••"
                :autocomplete="mode === 'signin' ? 'current-password' : 'new-password'"
              />

              <LiButton type="submit" :loading="submitting" style="width: 100%">
                {{ mode === 'signin' ? 'Sign In' : 'Sign Up' }}
              </LiButton>
            </form>

            <button type="button" class="login__mode-switch" @click="toggleMode">
              {{ mode === 'signin' ? "Belum punya akun? Sign up" : 'Sudah punya akun? Sign in' }}
            </button>
          </div>

          <!-- Magic link tab -->
          <div v-else class="login__panel">
            <p class="login__hint">Kami kirim link login ke email kamu, tanpa password.</p>
            <form class="login__form" @submit.prevent="onMagicLinkSubmit">
              <LiTextField
                v-model="magicEmail"
                type="email"
                label="Email"
                placeholder="nama@perusahaan.com"
                autocomplete="email"
              />
              <LiButton type="submit" :loading="submitting" style="width: 100%">
                Kirim Magic Link
              </LiButton>
            </form>
          </div>
        </LiTabs>
      </LiCard>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '../../../composables/useAuth.js'
import { useToast } from '../../../lib/composables/useToast.js'
import LiLogo from '../../../lib/components/LiLogo.vue'
import LiCard from '../../../lib/components/LiCard.vue'
import LiTabs from '../../../lib/components/LiTabs.vue'
import LiTextField from '../../../lib/components/LiTextField.vue'
import LiButton from '../../../lib/components/LiButton.vue'
import LiBanner from '../../../lib/components/LiBanner.vue'

const router = useRouter()
const { signInWithPassword, signInWithMagicLink, signUp } = useAuth()
const toast = useToast()

const tabs = [
  { label: 'Password' },
  { label: 'Magic Link' },
]
const activeTab = ref(0)
const mode = ref('signin') // 'signin' | 'signup'
const submitting = ref(false)

const identifier = ref('')
const password = ref('')
const signupEmail = ref('')
const signupUsername = ref('')
const magicEmail = ref('')

function toggleMode() {
  mode.value = mode.value === 'signin' ? 'signup' : 'signin'
}

async function onPasswordSubmit() {
  submitting.value = true
  try {
    if (mode.value === 'signin') {
      await signInWithPassword({ identifier: identifier.value, password: password.value })
      toast.success('Berhasil masuk')
      router.push({ name: 'qris' })
    } else {
      await signUp({
        email: signupEmail.value,
        password: password.value,
        username: signupUsername.value,
      })
      toast.success('Akun dibuat — cek email untuk konfirmasi, lalu sign in.')
      mode.value = 'signin'
    }
  } catch (err) {
    toast.error(err.message || 'Gagal, coba lagi')
  } finally {
    submitting.value = false
  }
}

async function onMagicLinkSubmit() {
  submitting.value = true
  try {
    await signInWithMagicLink(magicEmail.value)
    toast.success('Magic link terkirim, cek email kamu')
  } catch (err) {
    toast.error(err.message || 'Gagal mengirim magic link')
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped>
.login {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-l, 16px);
}

.login__card-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-xl, 24px);
  width: 100%;
  max-width: 380px;
}

.login__card {
  width: 100%;
}

.login__panel {
  display: flex;
  flex-direction: column;
  gap: var(--space-l, 16px);
}

.login__form {
  display: flex;
  flex-direction: column;
  gap: var(--space-m, 12px);
}

.login__hint {
  margin: 0;
  font-size: var(--text-xs, 14px);
  color: var(--color-gray-600, #808080);
}

.login__mode-switch {
  background: none;
  border: none;
  color: var(--color-blue-400, #2563EB);
  font-size: var(--text-xs, 14px);
  cursor: pointer;
  text-align: center;
  padding: 4px;
}

.login__mode-switch:hover {
  text-decoration: underline;
}
</style>
