<template>
  <div class="profile">
    <header class="profile__header">
      <div class="profile__title-group">
        <div class="profile__icon-badge">
          <span class="material-symbols-outlined">account_circle</span>
        </div>
        <div>
          <h1 class="profile__title">Profile</h1>
          <p class="profile__subtitle">Kelola informasi akun kamu</p>
        </div>
      </div>
    </header>

    <LiCard>
      <template #header>
        <h2 class="profile__section-title">Informasi Akun</h2>
      </template>

      <div class="profile__readonly-grid">
        <div>
          <span class="profile__label">Username</span>
          <span class="profile__value">{{ profile?.username || '—' }}</span>
        </div>
        <div>
          <span class="profile__label">Email</span>
          <span class="profile__value">{{ session?.user?.email }}</span>
        </div>
        <div>
          <span class="profile__label">Role</span>
          <LiChip :variant="isAdmin ? 'warning' : 'neutral'">{{ profile?.role }}</LiChip>
        </div>
      </div>

      <form class="profile__form" @submit.prevent="onSaveName">
        <LiTextField v-model="fullName" label="Nama Lengkap" placeholder="Nama kamu" />
        <LiButton type="submit" :loading="savingName" size="sm">Save Changes</LiButton>
      </form>
    </LiCard>

    <LiCard>
      <template #header>
        <h2 class="profile__section-title">Ganti Password</h2>
      </template>

      <form class="profile__form" @submit.prevent="onChangePassword">
        <LiTextField
          v-model="currentPassword"
          type="password"
          label="Password Saat Ini"
          autocomplete="current-password"
        />
        <LiTextField
          v-model="newPassword"
          type="password"
          label="Password Baru"
          helper-text="Minimal 6 karakter"
          autocomplete="new-password"
        />
        <LiTextField
          v-model="confirmPassword"
          type="password"
          label="Konfirmasi Password Baru"
          autocomplete="new-password"
        />
        <LiButton type="submit" :loading="changingPassword" size="sm">Ganti Password</LiButton>
      </form>
    </LiCard>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useAuth } from '../../../composables/useAuth.js'
import { useToast } from '../../../lib/composables/useToast.js'
import LiCard from '../../../lib/components/LiCard.vue'
import LiTextField from '../../../lib/components/LiTextField.vue'
import LiButton from '../../../lib/components/LiButton.vue'
import LiChip from '../../../lib/components/LiChip.vue'

const { session, profile, isAdmin, updateFullName, changePassword } = useAuth()
const toast = useToast()

const fullName = ref(profile.value?.full_name || '')
const savingName = ref(false)

const currentPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const changingPassword = ref(false)

async function onSaveName() {
  savingName.value = true
  try {
    await updateFullName(fullName.value)
    toast.success('Nama berhasil disimpan')
  } catch (err) {
    toast.error(err.message || 'Gagal menyimpan nama')
  } finally {
    savingName.value = false
  }
}

async function onChangePassword() {
  if (newPassword.value.length < 6) {
    toast.error('Password baru minimal 6 karakter')
    return
  }
  if (newPassword.value !== confirmPassword.value) {
    toast.error('Konfirmasi password tidak cocok')
    return
  }

  changingPassword.value = true
  try {
    await changePassword({
      currentPassword: currentPassword.value,
      newPassword: newPassword.value,
    })
    toast.success('Password berhasil diganti')
    currentPassword.value = ''
    newPassword.value = ''
    confirmPassword.value = ''
  } catch (err) {
    toast.error(err.message || 'Gagal mengganti password')
  } finally {
    changingPassword.value = false
  }
}
</script>

<style scoped>
.profile {
  max-width: 640px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: var(--space-xl, 24px);
}

.profile__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.profile__title-group {
  display: flex;
  align-items: center;
  gap: var(--space-m, 12px);
}

.profile__icon-badge {
  width: 44px;
  height: 44px;
  border-radius: var(--radius-sm, 12px);
  background: var(--color-yellow-100, #FFF3D6);
  color: var(--color-orange-400, #FF6B00);
  display: flex;
  align-items: center;
  justify-content: center;
}

.profile__title {
  margin: 0;
  font-size: var(--text-lg, 20px);
  font-weight: 700;
  color: var(--color-gray-900, #1a1a2e);
}

.profile__subtitle {
  margin: 0;
  font-size: var(--text-xs, 14px);
  color: var(--color-gray-600, #808080);
}

.profile__section-title {
  margin: 0;
  font-size: var(--text-sm, 16px);
  font-weight: 700;
  color: var(--color-gray-900, #1a1a2e);
}

.profile__readonly-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: var(--space-l, 16px);
  padding-bottom: var(--space-l, 16px);
  margin-bottom: var(--space-l, 16px);
  border-bottom: 1px solid var(--color-gray-200, #E6E6E6);
}

.profile__readonly-grid > div {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.profile__label {
  font-size: var(--text-xxs, 12px);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-gray-500, #999999);
  font-weight: 600;
}

.profile__value {
  font-size: var(--text-sm, 16px);
  color: var(--color-gray-900, #1a1a2e);
  font-weight: 500;
}

.profile__form {
  display: flex;
  flex-direction: column;
  gap: var(--space-m, 12px);
  align-items: flex-start;
}
</style>
