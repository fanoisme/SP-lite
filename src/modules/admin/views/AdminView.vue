<template>
  <div class="admin">
    <!-- Header -->
    <header class="admin__header">
      <div class="admin__header-content">
        <div class="admin__title-group">
          <div class="admin__icon-badge">
            <LiIcon name="shield" />
          </div>
          <div>
            <h1 class="admin__title">Admin Panel</h1>
            <p class="admin__subtitle">Manage users, roles, and module access</p>
          </div>
        </div>
        <div class="admin__stats">
          <span class="admin__stat-chip">
            <LiIcon name="users" />
            {{ stats.users }} users
          </span>
          <span class="admin__stat-chip">
            <LiIcon name="shield-user" />
            {{ stats.roles }} roles
          </span>
          <span class="admin__stat-chip">
            <LiIcon name="layout-grid" />
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
          :aria-pressed="activeTab === index"
          @click="switchTab(index)"
        >
          <LiIcon :name="tab.icon" class="admin__tab-icon" />
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
            <LiIcon name="trash-2" />
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
  { id: 'users', label: 'Users', desc: 'Manage users', icon: 'users' },
  { id: 'roles', label: 'Roles', desc: 'Role management', icon: 'shield-user' },
  { id: 'modules', label: 'Modules', desc: 'Module access', icon: 'layout-grid' },
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
  padding: var(--space-4) var(--space-6);
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  animation: admin-in 500ms var(--ease-enter) both;
}

@keyframes admin-in {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}

/* ── Header ── */
.admin__header {
  animation: headerReveal 600ms var(--ease-enter) both;
}

@keyframes headerReveal {
  from { opacity: 0; transform: translateY(-16px); }
  to { opacity: 1; transform: translateY(0); }
}

.admin__header-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
}

.admin__title-group {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.admin__icon-badge {
  width: 48px;
  height: 48px;
  border-radius: var(--radius-md);
  background: linear-gradient(135deg, var(--color-accent), var(--color-accent-strong));
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 16px rgba(255, 188, 37, 0.3);
  flex-shrink: 0;
}

.admin__icon-badge .li-icon {
  font-size: 24px;
  color: var(--color-bg);
}

.admin__title {
  font-family: var(--font-sans);
  font-weight: 700;
  font-size: 24px;
  color: var(--color-text);
  margin: 0 0 var(--space-1);
  letter-spacing: -0.5px;
}

.admin__subtitle {
  font-size: 13px;
  color: var(--color-text-muted);
  margin: 0;
}

/* ── Header Stats ── */
.admin__stats {
  display: flex;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.admin__stat-chip {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-1) var(--space-3);
  border-radius: var(--radius-pill);
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-muted);
}

.admin__stat-chip .li-icon {
  font-size: 14px;
  color: var(--color-accent);
}

/* ── Panel Transitions ── */
.panel-slide-enter-active {
  transition: all var(--dur-medium) var(--ease-enter);
}

.panel-slide-leave-active {
  transition: all var(--dur-short) var(--ease-move);
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
  color: var(--color-text-muted);
  line-height: 1.6;
  margin: 0;
}

.admin__delete-text strong {
  color: var(--color-text);
  font-weight: 600;
}

.admin__delete-actions {
  display: flex;
  gap: var(--space-2);
  justify-content: flex-end;
}

.admin__cancel-btn {
  padding: 10px 20px;
  background: none;
  border: 1.5px solid var(--color-border-strong);
  border-radius: var(--radius-pill);
  font-size: 13px;
  font-weight: 600;
  font-family: var(--font-sans);
  color: var(--color-text-muted);
  cursor: pointer;
  transition: all var(--dur-short) var(--ease-out);
}

.admin__cancel-btn:hover {
  border-color: var(--color-text-placeholder);
  color: var(--color-text);
}

.admin__danger-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: 10px 24px;
  background: var(--color-danger);
  color: var(--color-bg);
  border: none;
  border-radius: var(--radius-pill);
  font-size: 13px;
  font-weight: 700;
  font-family: var(--font-sans);
  cursor: pointer;
  transition: all var(--dur-short) var(--ease-out);
}

.admin__danger-btn:hover {
  background: var(--color-danger);
  transform: translateY(-1px);
}

.admin__danger-btn .li-icon {
  font-size: 16px;
}

/* ── Responsive ── */
@media (max-width: 768px) {
  .admin {
    padding: var(--space-4);
    gap: var(--space-4);
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

  .admin__icon-badge .li-icon {
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
  background: var(--color-hover); 
  border: 1px solid rgba(0,0,0,0.06); border-radius: var(--radius-md);
  padding: 5px; gap: 2px;
}
.admin__tab {
  flex: 1; display: flex; flex-direction: column; align-items: center; gap: 2px;
  padding: 14px 12px; border: none; border-radius: var(--radius-sm);
  background: transparent; cursor: pointer;
  font-family: var(--font-sans);
  transition: all 300ms ease-out;
  position: relative; z-index: 1;
}
.admin__tab:hover { background: var(--color-hover); }
.admin__tab--active { color: var(--color-text); }
.admin__tab-icon { font-size: 22px; color: var(--color-text-muted); transition: color 300ms ease-out, transform 300ms cubic-bezier(0.34, 1.56, 0.64, 1); }
.admin__tab--active .admin__tab-icon { color: var(--color-accent); transform: scale(1.1); }
.admin__tab-label { font-size: 13px; font-weight: 600; color: var(--color-text); transition: color 300ms ease-out; }
.admin__tab--active .admin__tab-label { color: var(--color-text); }
.admin__tab-indicator {
  position: absolute; top: 5px; height: calc(100% - 10px);
  background: var(--color-bg); border-radius: var(--radius-sm);
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
