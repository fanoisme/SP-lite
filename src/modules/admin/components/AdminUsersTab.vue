<template>
  <div class="adm-users">
    <!-- Toolbar -->
    <div class="adm-users__toolbar">
      <LiTextField
        v-model="searchQuery"
        placeholder="Search users..."
        iconLeft="search"
        class="adm-users__search"
      />
      <button class="adm-users__add-btn" @click="$emit('add-user')">
        <span class="material-symbols-outlined">person_add</span>
        Add User
      </button>
    </div>

    <p class="adm-users__hint">
      <span class="material-symbols-outlined">info</span>
      Users can also self-register — those accounts stay pending until you activate them.
    </p>

    <!-- Users table inside glass card -->
    <LiGlassCard variant="light" size="md" :hoverable="false" class="adm-users__card">
      <LiTable
        :data="paginatedUsers"
        :columns="columns"
        :loading="loading"
        rowKey="id"
        @sort="onSort"
      >
        <!-- Username cell -->
        <template #cell-username="{ row }">
          <div class="adm-users__username">
            <span class="adm-users__avatar">{{ (row.username || '?')[0].toUpperCase() }}</span>
            <span class="adm-users__name">{{ row.username }}</span>
            <span
              v-if="row.has_overrides"
              class="adm-users__custom-dot"
              title="Has custom access overrides"
            >●</span>
            <LiChip v-if="!row.is_active" variant="warning" size="sm" iconLeft="schedule">pending</LiChip>
            <LiChip v-else variant="success" size="sm" iconLeft="check_circle">active</LiChip>
            <LiChip v-if="row.id === currentUserId" variant="brand" size="sm">you</LiChip>
          </div>
        </template>

        <!-- Role cell -->
        <template #cell-role="{ row }">
          <LiSelect
            :modelValue="row.role"
            :options="roleOptions"
            :disabled="row.id === currentUserId"
            @update:modelValue="$emit('update-role', row.id, $event)"
            class="adm-users__role-select"
          />
        </template>

        <!-- Created cell -->
        <template #cell-created_at="{ value }">
          <span class="adm-users__date">{{ formatDate(value) }}</span>
        </template>

        <!-- Actions cell -->
        <template #cell-actions="{ row }">
          <div class="adm-users__actions">
            <button
              class="adm-users__status-btn"
              :class="row.is_active ? 'is-active' : 'is-pending'"
              :disabled="row.id === currentUserId"
              :title="row.is_active ? 'Deactivate account' : 'Activate account'"
              @click="$emit('update-active', row.id, !row.is_active)"
            >
              <span class="material-symbols-outlined">{{ row.is_active ? 'check_circle' : 'hourglass_empty' }}</span>
            </button>
            <button
              class="adm-users__manage-btn"
              @click="$emit('open-user', row)"
              title="Manage access"
            >
              <span class="material-symbols-outlined">tune</span>
            </button>
            <button
              class="adm-users__delete-btn"
              :disabled="row.id === currentUserId"
              @click="$emit('delete-user', row)"
              title="Delete user"
            >
              <span class="material-symbols-outlined">delete</span>
            </button>
          </div>
        </template>
      </LiTable>

      <!-- Empty state -->
      <LiEmptyState
        v-if="!loading && paginatedUsers.length === 0"
        icon="group_off"
        title="No users found"
        :description="searchQuery ? 'Try a different search' : 'No registered users yet.'"
      />

      <!-- Pagination -->
      <div v-if="totalPages > 1" class="adm-users__pagination">
        <LiPagination v-model="currentPage" :totalPages="totalPages" />
      </div>
    </LiGlassCard>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import LiGlassCard from '@lib/components/LiGlassCard.vue'
import LiTable from '@lib/components/LiTable.vue'
import LiTextField from '@lib/components/LiTextField.vue'
import LiSelect from '@lib/components/LiSelect.vue'
import LiPagination from '@lib/components/LiPagination.vue'
import LiChip from '@lib/components/LiChip.vue'
import LiEmptyState from '@lib/components/LiEmptyState.vue'

const props = defineProps({
  users: Array,
  paginatedUsers: Array,
  loading: Boolean,
  searchQuery: String,
  currentPage: Number,
  totalPages: Number,
  roleOptions: Array,
  currentUserId: [String, Number],
  sortKey: String,
  sortOrder: String,
})

const emit = defineEmits([
  'update:searchQuery',
  'update:currentPage',
  'add-user',
  'delete-user',
  'update-role',
  'update-active',
  'open-user',
  'sort',
])

// Proxy v-model for search + page
const searchQuery = computed({
  get: () => props.searchQuery,
  set: (v) => emit('update:searchQuery', v),
})

const currentPage = computed({
  get: () => props.currentPage,
  set: (v) => emit('update:currentPage', v),
})

const columns = [
  { key: 'username', label: 'Username', sortable: true },
  { key: 'full_name', label: 'Full Name', sortable: true },
  { key: 'role', label: 'Role' },
  { key: 'created_at', label: 'Created', sortable: true },
  { key: 'actions', label: '', width: '128px' },
]

function onSort({ key, order }) {
  emit('sort', { key, order })
}

function formatDate(dateStr) {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}
</script>

<style scoped>
.adm-users__toolbar {
  display: flex;
  align-items: center;
  gap: var(--space-m, 12px);
  margin-bottom: var(--space-l, 16px);
}

.adm-users__search {
  flex: 1;
  max-width: 320px;
}

.adm-users__add-btn {
  display: flex;
  align-items: center;
  gap: var(--space-s, 6px);
  padding: 10px 20px;
  background: var(--cta-primary-bg, #FFBC25);
  color: var(--cta-primary-text, #1E1E1E);
  border: none;
  border-radius: var(--radius-pill, 999px);
  font-weight: 600;
  font-size: 13px;
  font-family: var(--font-body, 'Inter', sans-serif);
  cursor: pointer;
  transition: all var(--dur-short, 200ms) var(--ease-out);
  white-space: nowrap;
}

.adm-users__add-btn:hover {
  background: var(--cta-primary-hover, #FFB60A);
  transform: translateY(-2px);
}

.adm-users__add-btn .material-symbols-outlined {
  font-size: 18px;
}

.adm-users__hint {
  display: inline-flex;
  align-items: center;
  gap: var(--space-xs, 6px);
  margin: 0;
  font-size: 12px;
  color: var(--color-on-surface-muted, #999);
}

.adm-users__hint .material-symbols-outlined {
  font-size: 16px;
}

.adm-users__card {
  padding: 0;
  overflow: hidden;
}

.adm-users__username {
  display: flex;
  align-items: center;
  gap: var(--space-s, 8px);
}

.adm-users__avatar {
  width: 28px;
  height: 28px;
  border-radius: var(--radius-xs, 8px);
  background: linear-gradient(135deg, var(--color-blue-100, #E6E6FF), var(--color-blue-200, #60A5FA));
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 700;
  color: var(--color-blue-500, #0047B2);
  flex-shrink: 0;
}

.adm-users__name {
  font-weight: 600;
  color: var(--color-on-surface, #333);
}

.adm-users__custom-dot {
  color: var(--cta-primary-bg, #FFBC25);
  font-size: 10px;
  line-height: 1;
  margin-left: -2px;
}

.adm-users__actions {
  display: inline-flex;
  align-items: center;
  gap: 2px;
}

.adm-users__status-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: var(--space-s, 6px);
  border-radius: var(--radius-sm, 12px);
  transition: all var(--dur-short, 200ms) var(--ease-out);
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.adm-users__status-btn .material-symbols-outlined {
  font-size: 18px;
}

.adm-users__status-btn.is-active {
  color: var(--color-success, #10B981);
}

.adm-users__status-btn.is-pending {
  color: var(--color-on-surface-muted, #999);
}

.adm-users__status-btn:hover:not(:disabled) {
  background: rgba(0, 0, 0, 0.05);
}

.adm-users__status-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.adm-users__manage-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: var(--space-s, 6px);
  border-radius: var(--radius-sm, 12px);
  color: var(--color-gray-400, #B3B3B3);
  transition: all var(--dur-short, 200ms) var(--ease-out);
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.adm-users__manage-btn:hover {
  color: var(--cta-primary-bg, #FFBC25);
  background: rgba(255, 188, 37, 0.12);
}

.adm-users__manage-btn .material-symbols-outlined {
  font-size: 18px;
}

.adm-users__role-select {
  min-width: 140px;
}

.adm-users__date {
  font-size: 12px;
  color: var(--color-on-surface-muted, #999);
  font-variant-numeric: tabular-nums;
}

.adm-users__pagination {
  display: flex;
  justify-content: center;
  padding: var(--space-l, 16px);
  border-top: 1px solid rgba(0, 0, 0, 0.04);
}

.adm-users__delete-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: var(--space-s, 6px);
  border-radius: var(--radius-sm, 12px);
  color: var(--color-gray-400, #B3B3B3);
  transition: all var(--dur-short, 200ms) var(--ease-out);
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.adm-users__delete-btn:hover:not(:disabled) {
  color: var(--color-error, #C83E3B);
  background: rgba(200, 62, 59, 0.08);
}

.adm-users__delete-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.adm-users__delete-btn .material-symbols-outlined {
  font-size: 18px;
}

@media (max-width: 640px) {
  .adm-users__toolbar {
    flex-direction: column;
    align-items: stretch;
  }
  .adm-users__search {
    max-width: 100%;
  }
}
</style>
