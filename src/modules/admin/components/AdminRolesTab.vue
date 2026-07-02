<template>
  <div class="adm-roles">
    <div class="adm-roles__toolbar">
      <h3 class="adm-roles__heading">Manage Roles</h3>
      <button class="adm-roles__add-btn" @click="$emit('add-role')">
        <span class="material-symbols-outlined">add</span>
        Add Role
      </button>
    </div>

    <div v-if="loading" class="adm-roles__loading">
      <div class="adm-roles__spinner"></div>
      <span>Loading roles...</span>
    </div>

    <LiEmptyState
      v-else-if="roles.length === 0"
      icon="shield_person"
      title="No roles found"
      description="Create your first role to get started"
    />

    <div v-else class="adm-roles__grid">
      <div
        v-for="role in roles"
        :key="role.id"
        class="adm-roles__card"
        @click="$emit('edit-role', role)"
      >
        <div class="adm-roles__card-head">
          <div class="adm-roles__card-name">
            <span class="material-symbols-outlined adm-roles__card-icon">shield_person</span>
            <span>{{ role.name }}</span>
          </div>
          <LiChip v-if="role.is_system" variant="warning" size="sm" iconLeft="lock">
            system
          </LiChip>
        </div>

        <div class="adm-roles__card-meta">
          {{ role.user_count || 0 }} user{{ (role.user_count || 0) !== 1 ? 's' : '' }}
        </div>

        <div class="adm-roles__card-actions" @click.stop>
          <button
            class="adm-roles__action-btn"
            :disabled="role.is_system"
            :title="role.is_system ? 'Cannot rename system role' : 'Rename role'"
            @click="$emit('rename-role', role)"
          >
            <span class="material-symbols-outlined">edit</span>
          </button>
          <button
            class="adm-roles__action-btn adm-roles__action-btn--danger"
            :disabled="role.is_system || (role.user_count > 0)"
            :title="deleteTooltip(role)"
            @click="$emit('delete-role', role)"
          >
            <span class="material-symbols-outlined">delete</span>
          </button>
        </div>

        <span class="adm-roles__card-cta">
          Configure access
          <span class="material-symbols-outlined">chevron_right</span>
        </span>
      </div>
    </div>
  </div>
</template>

<script setup>
import LiChip from '@lib/components/LiChip.vue'
import LiEmptyState from '@lib/components/LiEmptyState.vue'

defineProps({
  roles: Array,
  loading: Boolean,
})

defineEmits(['add-role', 'edit-role', 'rename-role', 'delete-role'])

function deleteTooltip(role) {
  if (role.is_system) return 'Cannot delete system role'
  if (role.user_count > 0) return `${role.user_count} user(s) still assigned`
  return 'Delete role'
}
</script>

<style scoped>
.adm-roles__toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-l, 16px);
}

.adm-roles__heading {
  font-family: var(--font-display, 'Inter', sans-serif);
  font-weight: 700;
  font-size: 16px;
  color: var(--color-on-surface, #333);
  margin: 0;
}

.adm-roles__add-btn {
  display: flex;
  align-items: center;
  gap: var(--space-s, 6px);
  padding: 10px 20px;
  background: var(--cta-primary-bg, #ffbc25);
  color: var(--cta-primary-text, #1e1e1e);
  border: none;
  border-radius: var(--radius-pill, 999px);
  font-weight: 600;
  font-size: 13px;
  font-family: var(--font-body, 'Inter', sans-serif);
  cursor: pointer;
  transition: all var(--dur-short, 200ms) var(--ease-out);
  white-space: nowrap;
}

.adm-roles__add-btn:hover {
  background: var(--cta-primary-hover, #ffb60a);
  transform: translateY(-2px);
}

.adm-roles__add-btn .material-symbols-outlined {
  font-size: 18px;
}

.adm-roles__loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-m, 12px);
  padding: var(--space-2xl, 32px);
  color: var(--color-on-surface-muted, #999);
  font-size: 13px;
}

.adm-roles__spinner {
  width: 20px;
  height: 20px;
  border: 2.5px solid rgba(0, 0, 0, 0.06);
  border-top-color: var(--cta-primary-bg, #ffbc25);
  border-radius: 50%;
  animation: adm-roles-spin 0.8s linear infinite;
}

@keyframes adm-roles-spin {
  to { transform: rotate(360deg); }
}

.adm-roles__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: var(--space-m, 12px);
}

.adm-roles__card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: var(--space-s, 6px);
  padding: var(--space-l, 16px);
  background: var(--color-gray-0, #fff);
  border: 1px solid var(--color-gray-100, #f2f2f2);
  border-radius: var(--radius-md, 16px);
  box-shadow: var(--shadow-sm, 0 1px 3px rgba(0, 0, 0, 0.04));
  cursor: pointer;
  transition: all var(--dur-short, 200ms) var(--ease-out);
}

.adm-roles__card:hover {
  border-color: var(--cta-primary-bg, #ffbc25);
  box-shadow: var(--shadow-md, 0 6px 20px rgba(0, 0, 0, 0.06));
  transform: translateY(-2px);
}

.adm-roles__card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-s, 8px);
}

.adm-roles__card-name {
  display: inline-flex;
  align-items: center;
  gap: var(--space-s, 6px);
  font-weight: 700;
  font-size: 15px;
  color: var(--color-on-surface, #333);
}

.adm-roles__card-icon {
  font-size: 20px;
  color: var(--color-gray-400, #b3b3b3);
}

.adm-roles__card-meta {
  font-size: 12px;
  color: var(--color-on-surface-muted, #999);
}

.adm-roles__card-actions {
  display: flex;
  gap: var(--space-xs, 4px);
  margin-top: var(--space-xs, 4px);
}

.adm-roles__action-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: var(--space-s, 6px);
  border-radius: var(--radius-sm, 12px);
  color: var(--color-gray-400, #b3b3b3);
  transition: all var(--dur-short, 200ms) var(--ease-out);
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.adm-roles__action-btn:hover:not(:disabled) {
  color: var(--color-on-surface-variant, #666);
  background: rgba(0, 0, 0, 0.05);
}

.adm-roles__action-btn--danger:hover:not(:disabled) {
  color: var(--color-error, #c83e3b);
  background: rgba(200, 62, 59, 0.08);
}

.adm-roles__action-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.adm-roles__action-btn .material-symbols-outlined {
  font-size: 18px;
}

.adm-roles__card-cta {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  margin-top: var(--space-s, 8px);
  font-size: 12px;
  font-weight: 600;
  color: var(--color-on-surface-muted, #999);
}

.adm-roles__card-cta .material-symbols-outlined {
  font-size: 16px;
  transition: transform var(--dur-short, 200ms) var(--ease-out);
}

.adm-roles__card:hover .adm-roles__card-cta {
  color: var(--color-on-surface-variant, #666);
}

.adm-roles__card:hover .adm-roles__card-cta .material-symbols-outlined {
  transform: translateX(2px);
}
</style>
