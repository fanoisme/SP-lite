<template>
  <div class="admin">
    <!-- Header -->
    <header class="admin__header">
      <div class="admin__header-content">
        <div class="admin__title-group">
          <div class="admin__icon-badge">
            <span class="material-symbols-outlined">admin_panel_settings</span>
          </div>
          <div>
            <h1 class="admin__title">Admin Panel</h1>
            <p class="admin__subtitle">Kelola role dan status akun pengguna</p>
          </div>
        </div>
        <div class="admin__stats">
          <span class="admin__stat-chip">
            <span class="material-symbols-outlined">group</span>
            {{ profiles.length }} users
          </span>
          <span class="admin__stat-chip">
            <span class="material-symbols-outlined">shield_person</span>
            {{ adminCount }} admin
          </span>
          <span class="admin__stat-chip">
            <span class="material-symbols-outlined">toggle_on</span>
            {{ activeCount }} active
          </span>
        </div>
      </div>
    </header>

    <div v-if="loading" class="admin__loading">
      <span class="admin__spinner"></span>
      Loading users...
    </div>

    <div v-else-if="profiles.length === 0" class="admin__empty">
      <span class="material-symbols-outlined">group_off</span>
      <p>Belum ada user yang signup.</p>
    </div>

    <div v-else class="admin__list">
      <div
        v-for="(row, idx) in profiles"
        :key="row.id"
        class="admin__user-item"
        :style="{ '--item-idx': idx }"
      >
        <div class="admin__user-avatar">
          <span>{{ (row.username || row.id).charAt(0).toUpperCase() }}</span>
        </div>

        <div class="admin__user-body">
          <span class="admin__user-name">
            {{ row.username || '—' }}
            <span v-if="row.id === currentUserId" class="admin__you-badge">you</span>
          </span>
          <span class="admin__user-meta">{{ row.full_name || 'Tanpa nama' }} · sejak {{ formatDate(row.created_at) }}</span>
        </div>

        <div class="admin__user-controls">
          <select
            class="admin__role-select"
            :class="`admin__role-select--${row.role}`"
            :value="row.role"
            :disabled="row.id === currentUserId"
            @change="updateRole(row, $event.target.value)"
          >
            <option value="user">User</option>
            <option value="admin">Admin</option>
          </select>

          <label class="admin__toggle" :class="{ 'admin__toggle--disabled': row.id === currentUserId }">
            <input
              type="checkbox"
              :checked="row.is_active"
              :disabled="row.id === currentUserId"
              @change="updateActive(row, $event.target.checked)"
            />
            <span class="admin__toggle-track">
              <span class="admin__toggle-thumb"></span>
            </span>
          </label>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { supabase } from '../../../lib/supabase.js'
import { useAuth } from '../../../composables/useAuth.js'
import { useToast } from '../../../lib/composables/useToast.js'

const { session } = useAuth()
const toast = useToast()

const currentUserId = session.value?.user?.id
const profiles = ref([])
const loading = ref(true)

const adminCount = computed(() => profiles.value.filter(p => p.role === 'admin').length)
const activeCount = computed(() => profiles.value.filter(p => p.is_active).length)

function formatDate(value) {
  return new Date(value).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}

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
  max-width: 900px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: var(--space-l, 16px);
  animation: admin-in 500ms var(--ease-smooth, cubic-bezier(0.16, 1, 0.3, 1)) both;
}

@keyframes admin-in {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}

/* ── Header ── */
.admin__header {
  animation: headerReveal 600ms var(--ease-smooth) both;
}

@keyframes headerReveal {
  from { opacity: 0; transform: translateY(-16px); }
  to { opacity: 1; transform: translateY(0); }
}

.admin__header-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-l, 16px);
  flex-wrap: wrap;
}

.admin__title-group {
  display: flex;
  align-items: center;
  gap: var(--space-m, 12px);
}

.admin__icon-badge {
  width: 48px;
  height: 48px;
  border-radius: var(--radius-md, 16px);
  background: linear-gradient(135deg, var(--cta-primary-bg, #FFBC25), var(--color-orange-300, #FF8C00));
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 16px rgba(255, 188, 37, 0.3);
  flex-shrink: 0;
}

.admin__icon-badge .material-symbols-outlined {
  font-size: 24px;
  color: var(--color-gray-0, #fff);
}

.admin__title {
  font-family: var(--font-display, 'Inter', sans-serif);
  font-weight: 700;
  font-size: 24px;
  color: var(--color-on-surface, #333);
  margin: 0 0 var(--space-xs, 4px);
  letter-spacing: -0.5px;
}

.admin__subtitle {
  font-size: 13px;
  color: var(--color-on-surface-muted, #999);
  margin: 0;
}

.admin__stats {
  display: flex;
  gap: var(--space-s, 8px);
  flex-wrap: wrap;
}

.admin__stat-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: var(--radius-pill, 999px);
  background: rgba(255, 255, 255, 0.6);
  border: 1px solid var(--glass-border, rgba(0, 0, 0, 0.06));
  font-size: 12px;
  font-weight: 600;
  color: var(--color-on-surface-variant, #666);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}

.admin__stat-chip .material-symbols-outlined {
  font-size: 14px;
  color: var(--cta-primary-bg, #FFBC25);
}

/* ── Loading / empty ── */
.admin__loading,
.admin__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-m, 12px);
  padding: var(--space-3xl, 48px);
  color: var(--color-on-surface-muted, #999);
  font-size: 14px;
}

.admin__loading {
  flex-direction: row;
}

.admin__empty .material-symbols-outlined {
  font-size: 36px;
  color: var(--color-gray-300, #ccc);
}

.admin__spinner {
  width: 18px;
  height: 18px;
  border: 2.5px solid rgba(0, 0, 0, 0.15);
  border-bottom-color: transparent;
  border-radius: 50%;
  animation: admin-spin 700ms var(--ease-out) infinite;
}

@keyframes admin-spin {
  to { transform: rotate(360deg); }
}

/* ── List ── */
.admin__list {
  display: flex;
  flex-direction: column;
  gap: var(--space-s, 8px);
}

.admin__user-item {
  display: flex;
  align-items: center;
  gap: var(--space-m, 12px);
  padding: var(--space-m, 12px) var(--space-l, 16px);
  background: rgba(255, 255, 255, 0.7);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border: 1px solid rgba(0, 0, 0, 0.05);
  border-radius: var(--radius-md, 16px);
  transition: background 200ms var(--ease-out), box-shadow 300ms var(--ease-out), transform 300ms var(--ease-out);
  animation: admin-item-in 400ms var(--ease-smooth) both;
  animation-delay: calc(var(--item-idx, 0) * 60ms);
}

@keyframes admin-item-in {
  from { opacity: 0; transform: translateX(-12px); }
  to { opacity: 1; transform: translateX(0); }
}

.admin__user-item:hover {
  background: rgba(255, 255, 255, 0.9);
  box-shadow: var(--shadow-sm);
  transform: translateX(2px);
}

.admin__user-avatar {
  width: 40px;
  height: 40px;
  border-radius: var(--radius-sm, 12px);
  background: linear-gradient(135deg, var(--cta-primary-bg, #FFBC25), var(--color-orange-200, #FFA726));
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  font-family: var(--font-display, 'Inter', sans-serif);
  font-weight: 700;
  color: var(--cta-primary-text, #1E1E1E);
}

.admin__user-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.admin__user-name {
  font-size: 14px;
  font-weight: 700;
  color: var(--color-on-surface, #333);
}

.admin__you-badge {
  margin-left: 6px;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--color-orange-400, #FF6B00);
}

.admin__user-meta {
  font-size: 12px;
  color: var(--color-on-surface-muted, #999);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.admin__user-controls {
  display: flex;
  align-items: center;
  gap: var(--space-m, 12px);
  flex-shrink: 0;
}

.admin__role-select {
  appearance: none;
  padding: 6px 28px 6px 12px;
  border-radius: var(--radius-pill, 999px);
  border: 1.5px solid rgba(0, 0, 0, 0.08);
  font-size: 12px;
  font-weight: 700;
  font-family: var(--font-body, 'Inter', sans-serif);
  cursor: pointer;
  background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 16 16' fill='none'%3E%3Cpath d='M4 6L8 10L12 6' stroke='%23999' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E") no-repeat right 8px center;
  transition: opacity 200ms var(--ease-out);
}

.admin__role-select:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.admin__role-select--user {
  background-color: var(--color-gray-100, #F2F2F2);
  color: var(--color-on-surface-variant, #666);
}

.admin__role-select--admin {
  background-color: var(--color-error-container, #FDECEE);
  color: var(--color-on-error-container, #A33129);
}

.admin__toggle {
  display: inline-flex;
  cursor: pointer;
}

.admin__toggle--disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.admin__toggle input {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
}

.admin__toggle-track {
  position: relative;
  width: 40px;
  height: 22px;
  border-radius: var(--radius-pill, 999px);
  background: var(--color-gray-300, #CCCCCC);
  transition: background 200ms var(--ease-out);
}

.admin__toggle input:checked + .admin__toggle-track {
  background: var(--color-success, #10B981);
}

.admin__toggle-thumb {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--color-gray-0, #fff);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
  transition: transform 200ms var(--ease-out);
}

.admin__toggle input:checked + .admin__toggle-track .admin__toggle-thumb {
  transform: translateX(18px);
}

/* ── Responsive ── */
@media (max-width: 640px) {
  .admin__header-content {
    flex-direction: column;
    align-items: flex-start;
  }

  .admin__user-item {
    flex-wrap: wrap;
  }

  .admin__user-controls {
    width: 100%;
    justify-content: space-between;
    padding-left: 52px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .admin,
  .admin__header,
  .admin__user-item {
    animation: none !important;
  }
}
</style>
