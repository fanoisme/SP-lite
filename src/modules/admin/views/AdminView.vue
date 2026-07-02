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
            <p class="admin__subtitle">Manage users, roles, and module access</p>
          </div>
        </div>
        <div class="admin__stats">
          <span class="admin__stat-chip">
            <span class="material-symbols-outlined">group</span>
            {{ stats.users }} users
          </span>
          <span class="admin__stat-chip">
            <span class="material-symbols-outlined">shield_person</span>
            {{ stats.roles }} roles
          </span>
          <span class="admin__stat-chip">
            <span class="material-symbols-outlined">apps</span>
            {{ stats.modulesEnabled }}/{{ stats.modulesTotal }} modules
          </span>
        </div>
      </div>
    </header>

    <!-- Pill Tabs -->
    <nav class="admin__tabs-wrapper">
      <div class="admin__tabs">
        <button
          v-for="(tab, index) in tabDefs"
          :key="tab.id"
          class="admin__tab"
          :class="{ 'admin__tab--active': activeTab === index }"
          @click="switchTab(index)"
        >
          <span class="material-symbols-outlined admin__tab-icon">{{ tab.icon }}</span>
          <span class="admin__tab-label">{{ tab.label }}</span>
        </button>
        <div class="admin__tab-indicator" :style="indicatorStyle" />
      </div>
    </nav>

    <!-- Tab Content -->
    <Transition name="panel-slide" mode="out-in">
      <AdminUsersTab
        v-if="activeTab === 0"
        key="users"
        :users="users"
        :paginatedUsers="paginatedUsers"
        :loading="usersLoading"
        :searchQuery="searchQuery"
        :currentPage="currentPage"
        :totalPages="totalPages"
        :roleOptions="roleOptions"
        :currentUserId="currentUserId"
        :sortKey="sortKey"
        :sortOrder="sortOrder"
        @update:searchQuery="searchQuery = $event"
        @update:currentPage="currentPage = $event"
        @sort="onSort"
        @add-user="showUserModal = true"
        @delete-user="onDeleteUser"
        @update-role="onUpdateRole"
        @update-active="onUpdateActive"
        @open-user="onOpenUser"
      />

      <AdminRolesTab
        v-else-if="activeTab === 1"
        key="roles"
        :roles="roles"
        :loading="rolesLoading"
        @add-role="editingRole = null; showRoleModal = true"
        @edit-role="onOpenRole"
        @rename-role="editingRole = $event; showRoleModal = true"
        @delete-role="onDeleteRole"
      />

      <AdminModulesTab
        v-else-if="activeTab === 2"
        key="modules"
        :modules="allModules"
        :loading="modulesLoading"
        @open-module="openModule = $event"
        @toggle-enabled="onToggleEnabled"
      />
    </Transition>

    <!-- Per-role create/rename modal -->
    <AdminRoleModal
      v-if="showRoleModal"
      :role="editingRole"
      @save="onSaveRole"
      @close="showRoleModal = false; editingRole = null"
    />

    <!-- Admin create-user modal (delegated to the admin-create-user Edge Function) -->
    <AdminUserModal
      v-if="showUserModal"
      :roleOptions="roleOptions"
      @save="onCreateUser"
      @close="showUserModal = false"
    />

    <!-- Per-user access drawer -->
    <AdminUserDrawer
      v-if="openUser"
      :user="openUser"
      @close="openUser = null"
      @changed="loadUsers"
    />

    <!-- Per-role access drawer -->
    <AdminRoleDrawer
      v-if="openRole"
      :role="openRole"
      @close="openRole = null"
    />

    <!-- Module global-state drawer -->
    <AdminModuleDrawer
      v-if="openModule"
      :mod="openModule"
      :roles="roles"
      @close="openModule = null"
    />

    <!-- Delete Confirm -->
    <LiModal
      v-if="deleteTarget"
      :modelValue="true"
      title="Confirm Delete"
      size="sm"
      @update:modelValue="deleteTarget = null"
    >
      <p class="admin__delete-text">
        Are you sure you want to delete <strong>{{ deleteTarget.label }}</strong>?
        This action cannot be undone.
      </p>
      <template #footer>
        <div class="admin__delete-actions">
          <button class="admin__cancel-btn" @click="deleteTarget = null">Cancel</button>
          <button class="admin__danger-btn" @click="confirmDelete">
            <span class="material-symbols-outlined">delete</span>
            Delete
          </button>
        </div>
      </template>
    </LiModal>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { useAdminUsers } from '../composables/useAdminUsers.js'
import { useAdminRoles } from '../composables/useAdminRoles.js'
import { useAdminAccess } from '../composables/useAdminAccess.js'
import AdminUsersTab from '../components/AdminUsersTab.vue'
import AdminRolesTab from '../components/AdminRolesTab.vue'
import AdminModulesTab from '../components/AdminModulesTab.vue'
import AdminRoleModal from '../components/AdminRoleModal.vue'
import AdminUserModal from '../components/AdminUserModal.vue'
import AdminUserDrawer from '../components/AdminUserDrawer.vue'
import AdminRoleDrawer from '../components/AdminRoleDrawer.vue'
import AdminModuleDrawer from '../components/AdminModuleDrawer.vue'
import LiModal from '@lib/components/LiModal.vue'

// Composables
const {
  users, loading: usersLoading, error: usersError, currentUser,
  searchQuery, sortKey, sortOrder, currentPage, pageSize,
  filteredUsers, sortedUsers, paginatedUsers, totalPages,
  setSort, loadUsers, createUser, updateUserRole, updateUserActive, deleteUser,
} = useAdminUsers()

const {
  roles, loading: rolesLoading, error: rolesError,
  loadRoles, createRole, renameRole, deleteRole,
} = useAdminRoles()

const {
  allModules, accessMap,
  loadModules, loadAccess, isModuleGranted, toggleModule,
  loadFeatureAccess, setModuleEnabled,
} = useAdminAccess()

// Tab state
const activeTab = ref(0)
const tabDefs = [
  { id: 'users', label: 'Users', desc: 'Manage users', icon: 'group' },
  { id: 'roles', label: 'Roles', desc: 'Role management', icon: 'shield_person' },
  { id: 'modules', label: 'Modules', desc: 'Module access', icon: 'apps' },
]

// Pill tab indicator
const indicatorStyle = ref({})

function switchTab(index) {
  activeTab.value = index
  nextTick(() => updateIndicator())
}

function updateIndicator() {
  const tabEl = document.querySelectorAll('.admin__tab')[activeTab.value]
  if (tabEl) {
    indicatorStyle.value = {
      left: `${tabEl.offsetLeft}px`,
      width: `${tabEl.offsetWidth}px`,
    }
  }
}

function onResize() { nextTick(() => updateIndicator()) }

// Header quick-stats
const stats = computed(() => ({
  users: users.value.length,
  roles: roles.value.length,
  modulesEnabled: allModules.value.filter(m => m.is_enabled !== false).length,
  modulesTotal: allModules.value.length,
}))

// Derived
const currentUserId = computed(() => currentUser.value?.id)
const roleOptions = computed(() =>
  roles.value.map(r => ({ label: r.name, value: r.name })),
)

// Modals
const showUserModal = ref(false)
const showRoleModal = ref(false)
const editingRole = ref(null)
const deleteTarget = ref(null)  // { type: 'user'|'role', id, label }
const openUser = ref(null)
const openRole = ref(null)
const openModule = ref(null)
const modulesLoading = ref(true)

function onOpenUser(u) {
  openUser.value = u
}

function onOpenRole(r) {
  openRole.value = r
}

// ── Users ──

function onSort({ key, order }) {
  sortKey.value = key
  sortOrder.value = order
}

async function onUpdateRole(userId, newRole) {
  await updateUserRole(userId, newRole)
}

async function onCreateUser(userData, done) {
  const ok = await createUser(userData)
  if (ok) {
    showUserModal.value = false
    done(null)
  } else {
    done(usersError.value || 'Failed to create user')
  }
}

async function onUpdateActive(userId, is_active) {
  await updateUserActive(userId, is_active)
}

function onDeleteUser(user) {
  deleteTarget.value = { type: 'user', id: user.id, label: user.username }
}

// ── Roles ──

async function onSaveRole(name, done) {
  let ok
  if (editingRole.value) {
    ok = await renameRole(editingRole.value.id, name)
  } else {
    ok = await createRole(name)
  }
  if (ok) {
    showRoleModal.value = false
    editingRole.value = null
    done(null)
    // Reload access map since role names may have changed
    await loadAccess(roles.value.map(r => r.name))
  } else {
    done(rolesError.value || 'Failed to save role')
  }
}

function onDeleteRole(role) {
  deleteTarget.value = { type: 'role', id: role.id, label: role.name }
}

// ── Modules ──

async function onToggleEnabled(moduleId, on) {
  await setModuleEnabled(moduleId, on)
  await loadModules()  // refresh is_enabled + role counts
  if (openModule.value && openModule.value.id === moduleId) {
    openModule.value = allModules.value.find(m => m.id === moduleId) || openModule.value
  }
}

// ── Delete Confirm ──

async function confirmDelete() {
  if (!deleteTarget.value) return
  const { type, id } = deleteTarget.value
  if (type === 'user') {
    await deleteUser(id)
  } else if (type === 'role') {
    await deleteRole(id)
  }
  deleteTarget.value = null
}

// ── Init ──

onMounted(async () => {
  await Promise.all([loadUsers(), loadRoles(), loadModules(), loadFeatureAccess()])
  modulesLoading.value = false
  await loadAccess(roles.value.map(r => r.name))
  nextTick(() => updateIndicator())
  window.addEventListener('resize', onResize)
})

onUnmounted(() => {
  window.removeEventListener('resize', onResize)
})
</script>

<style scoped>
.admin {
  max-width: 1280px;
  margin: 0 auto;
  padding: var(--space-lg, 24px) var(--space-xl, 32px);
  display: flex;
  flex-direction: column;
  gap: var(--space-lg, 24px);
  animation: admin-in 500ms var(--ease-smooth, cubic-bezier(0.16, 1, 0.3, 1)) both;
}

@keyframes admin-in {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}

/* ── Header ── */
.admin__header {
  animation: headerReveal 600ms var(--ease-smooth, cubic-bezier(0.16, 1, 0.3, 1)) both;
}

@keyframes headerReveal {
  from { opacity: 0; transform: translateY(-16px); }
  to { opacity: 1; transform: translateY(0); }
}

.admin__header-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-lg, 16px);
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

/* ── Header Stats ── */
.admin__stats {
  display: flex;
  gap: var(--space-s, 8px);
  flex-wrap: wrap;
}

.admin__stat-chip {
  display: inline-flex;
  align-items: center;
  gap: var(--space-xs, 6px);
  padding: var(--space-xs, 6px) var(--space-m, 12px);
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

/* ── Panel Transitions ── */
.panel-slide-enter-active {
  transition: all var(--dur-medium, 300ms) var(--ease-smooth, cubic-bezier(0.16, 1, 0.3, 1));
}

.panel-slide-leave-active {
  transition: all var(--dur-short, 200ms) var(--ease-snap, cubic-bezier(0.6, 0, 0.2, 1));
}

.panel-slide-enter-from {
  opacity: 0;
  transform: translateY(12px);
}

.panel-slide-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

/* ── Delete Modal ── */
.admin__delete-text {
  font-size: 14px;
  color: var(--color-on-surface-variant, #666);
  line-height: 1.6;
  margin: 0;
}

.admin__delete-text strong {
  color: var(--color-on-surface, #333);
  font-weight: 600;
}

.admin__delete-actions {
  display: flex;
  gap: var(--space-s, 8px);
  justify-content: flex-end;
}

.admin__cancel-btn {
  padding: 10px 20px;
  background: none;
  border: 1.5px solid var(--color-outline, #CCC);
  border-radius: var(--radius-pill, 999px);
  font-size: 13px;
  font-weight: 600;
  font-family: var(--font-body, 'Inter', sans-serif);
  color: var(--color-on-surface-variant, #666);
  cursor: pointer;
  transition: all var(--dur-short, 200ms) var(--ease-out);
}

.admin__cancel-btn:hover {
  border-color: var(--color-gray-400, #B3B3B3);
  color: var(--color-on-surface, #333);
}

.admin__danger-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--space-s, 8px);
  padding: 10px 24px;
  background: var(--color-error, #C83E3B);
  color: #fff;
  border: none;
  border-radius: var(--radius-pill, 999px);
  font-size: 13px;
  font-weight: 700;
  font-family: var(--font-body, 'Inter', sans-serif);
  cursor: pointer;
  transition: all var(--dur-short, 200ms) var(--ease-out);
}

.admin__danger-btn:hover {
  background: #A33129;
  transform: translateY(-1px);
}

.admin__danger-btn .material-symbols-outlined {
  font-size: 16px;
}

/* ── Responsive ── */
@media (max-width: 768px) {
  .admin {
    padding: var(--space-l, 16px);
    gap: var(--space-l, 16px);
  }

  .admin__header-content {
    flex-direction: column;
    align-items: flex-start;
  }

  .admin__title {
    font-size: 20px;
  }

  .admin__icon-badge {
    width: 40px;
    height: 40px;
  }

  .admin__icon-badge .material-symbols-outlined {
    font-size: 20px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .admin,
  .admin__header {
    animation: none;
  }

  .panel-slide-enter-active,
  .panel-slide-leave-active {
    transition-duration: 0ms;
  }
}

/* ── Pill Tabs ── */
.admin__tabs-wrapper { }
.admin__tabs {
  display: flex; position: relative;
  background: rgba(255,255,255,0.5); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(0,0,0,0.06); border-radius: var(--radius-md, 16px);
  padding: 5px; gap: 2px;
}
.admin__tab {
  flex: 1; display: flex; flex-direction: column; align-items: center; gap: 2px;
  padding: 14px 12px; border: none; border-radius: var(--radius-sm, 12px);
  background: transparent; cursor: pointer;
  font-family: var(--font-body, 'Inter', sans-serif);
  transition: all 300ms ease-out;
  position: relative; z-index: 1;
}
.admin__tab:hover { background: rgba(255,255,255,0.5); }
.admin__tab--active { color: var(--color-on-surface, #1a1a2e); }
.admin__tab-icon { font-size: 22px; color: var(--color-gray-500, #8e8ea0); transition: color 300ms ease-out, transform 300ms cubic-bezier(0.34, 1.56, 0.64, 1); }
.admin__tab--active .admin__tab-icon { color: var(--cta-primary-bg, #FFBC25); transform: scale(1.1); }
.admin__tab-label { font-size: 13px; font-weight: 600; color: var(--color-gray-700, #555); transition: color 300ms ease-out; }
.admin__tab--active .admin__tab-label { color: var(--color-on-surface, #1a1a2e); }
.admin__tab-indicator {
  position: absolute; top: 5px; height: calc(100% - 10px);
  background: #fff; border-radius: var(--radius-sm, 12px);
  box-shadow: 0 2px 8px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.02);
  transition: all 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
  z-index: 0;
}
@media (max-width: 768px) {
  .admin__tab { padding: 10px 8px; min-width: 0; flex-shrink: 0; }
}
@media (max-width: 480px) {
  .admin__tab-label { font-size: 12px; }
  .admin__tab-icon { font-size: 18px; }
}
@media (prefers-reduced-motion: reduce) {
  .admin__tab-indicator { transition: none; }
  .admin__tab-icon { transition: none; }
}
</style>
