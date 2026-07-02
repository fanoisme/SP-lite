<template>
  <div class="admin">
    <header class="admin__header">
      <div class="admin__title-group">
        <div class="admin__icon-badge">
          <span class="material-symbols-outlined">admin_panel_settings</span>
        </div>
        <div>
          <h1 class="admin__title">Admin</h1>
          <p class="admin__subtitle">Kelola role dan status akun pengguna</p>
        </div>
      </div>
    </header>

    <LiCard padding="none">
      <LiTable :data="profiles" :columns="columns" :loading="loading" row-key="id">
        <template #cell-username="{ row }">
          {{ row.username || '—' }}
          <span v-if="row.id === currentUserId" class="admin__you-badge">you</span>
        </template>

        <template #cell-role="{ row }">
          <LiSelect
            :model-value="row.role"
            :options="roleOptions"
            :disabled="row.id === currentUserId"
            @update:model-value="(val) => updateRole(row, val)"
          />
        </template>

        <template #cell-is_active="{ row }">
          <LiToggle
            :model-value="row.is_active"
            :disabled="row.id === currentUserId"
            @update:model-value="(val) => updateActive(row, val)"
          />
        </template>

        <template #cell-created_at="{ value }">
          {{ new Date(value).toLocaleDateString() }}
        </template>
      </LiTable>
    </LiCard>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { supabase } from '../../../lib/supabase.js'
import { useAuth } from '../../../composables/useAuth.js'
import { useToast } from '../../../lib/composables/useToast.js'
import LiCard from '../../../lib/components/LiCard.vue'
import LiTable from '../../../lib/components/LiTable.vue'
import LiSelect from '../../../lib/components/LiSelect.vue'
import LiToggle from '../../../lib/components/LiToggle.vue'

const { session } = useAuth()
const toast = useToast()

const currentUserId = session.value?.user?.id
const profiles = ref([])
const loading = ref(true)

const columns = [
  { key: 'username', label: 'Username' },
  { key: 'full_name', label: 'Nama' },
  { key: 'role', label: 'Role' },
  { key: 'is_active', label: 'Aktif' },
  { key: 'created_at', label: 'Dibuat' },
]

const roleOptions = [
  { label: 'User', value: 'user' },
  { label: 'Admin', value: 'admin' },
]

async function loadProfiles() {
  loading.value = true
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    toast.error('Gagal memuat daftar pengguna')
  } else {
    profiles.value = data
  }
  loading.value = false
}

async function updateRole(row, role) {
  const { error } = await supabase.from('profiles').update({ role }).eq('id', row.id)
  if (error) {
    toast.error('Gagal mengubah role')
    return
  }
  row.role = role
  toast.success(`${row.username || row.id} sekarang ${role}`)
}

async function updateActive(row, is_active) {
  const { error } = await supabase.from('profiles').update({ is_active }).eq('id', row.id)
  if (error) {
    toast.error('Gagal mengubah status')
    return
  }
  row.is_active = is_active
  toast.success(`${row.username || row.id} ${is_active ? 'diaktifkan' : 'dinonaktifkan'}`)
}

onMounted(loadProfiles)
</script>

<style scoped>
.admin {
  max-width: 960px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: var(--space-xl, 24px);
}

.admin__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.admin__title-group {
  display: flex;
  align-items: center;
  gap: var(--space-m, 12px);
}

.admin__icon-badge {
  width: 44px;
  height: 44px;
  border-radius: var(--radius-sm, 12px);
  background: var(--color-yellow-100, #FFF3D6);
  color: var(--color-orange-400, #FF6B00);
  display: flex;
  align-items: center;
  justify-content: center;
}

.admin__title {
  margin: 0;
  font-size: var(--text-lg, 20px);
  font-weight: 700;
  color: var(--color-gray-900, #1a1a2e);
}

.admin__subtitle {
  margin: 0;
  font-size: var(--text-xs, 14px);
  color: var(--color-gray-600, #808080);
}

.admin__you-badge {
  margin-left: 6px;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--color-orange-400, #FF6B00);
}
</style>
