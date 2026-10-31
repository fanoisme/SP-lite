<template>
  <div class="adm-roles">
    <div class="adm-roles__toolbar">
      <h3 class="adm-roles__heading">Manage Roles</h3>
      <button class="adm-roles__add-btn" @click="$emit('add-role')">
        <LiIcon name="plus" />
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
            <LiIcon name="shield-user" class="adm-roles__card-icon" />
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
            :aria-label="`Rename role ${role.name}`"
            :title="role.is_system ? 'Cannot rename system role' : 'Rename role'"
            @click="$emit('rename-role', role)"
          >
            <LiIcon name="pencil" />
          </button>
          <button
            class="adm-roles__action-btn adm-roles__action-btn--danger"
            :disabled="role.is_system || (role.user_count > 0)"
            :aria-label="`Delete role ${role.name}`"
            :title="deleteTooltip(role)"
            @click="$emit('delete-role', role)"
          >
            <LiIcon name="trash-2" />
          </button>
        </div>

        <span class="adm-roles__card-cta">
          Configure access
          <LiIcon name="chevron-right" />
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
  margin-bottom: var(--space-4);
}

.adm-roles__heading {
  font-family: var(--font-sans);
  font-weight: 700;
  font-size: 16px;
  color: var(--color-text);
  margin: 0;
}

.adm-roles__add-btn {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: 10px 20px;
  background: var(--color-accent);
  color: var(--color-on-accent);
  border: none;
  border-radius: var(--radius-pill, 999px);
  font-weight: 600;
  font-size: 13px;
  font-family: var(--font-sans);
  cursor: pointer;
  transition: all var(--dur-short, 200ms) var(--ease-out);
  white-space: nowrap;
}

.adm-roles__add-btn:hover {
  background: var(--color-accent-strong);
  transform: translateY(-2px);
}

.adm-roles__add-btn .li-icon {
  font-size: 18px;
}

.adm-roles__loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-3);
  padding: var(--space-8);
  color: var(--color-text-muted);
  font-size: 13px;
}

.adm-roles__spinner {
  width: 20px;
  height: 20px;
  border: 2.5px solid var(--color-border);
  border-top-color: var(--color-accent);
  border-radius: 50%;
  animation: adm-roles-spin 0.8s linear infinite;
}

@keyframes adm-roles-spin {
  to { transform: rotate(360deg); }
}

.adm-roles__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: var(--space-3);
}

.adm-roles__card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-4);
  background: var(--color-bg);
  border: 1px solid var(--color-surface-2);
  border-radius: var(--radius-md, 16px);
  box-shadow: var(--shadow-card);
  cursor: pointer;
  transition: all var(--dur-short, 200ms) var(--ease-out);
}

.adm-roles__card:hover {
  border-color: var(--color-accent);
  box-shadow: var(--shadow-pop);
  transform: translateY(-2px);
}

.adm-roles__card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
}

.adm-roles__card-name {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  font-weight: 700;
  font-size: 15px;
  color: var(--color-text);
}

.adm-roles__card-icon {
  font-size: 20px;
  color: var(--color-text-placeholder);
}

.adm-roles__card-meta {
  font-size: 12px;
  color: var(--color-text-muted);
}

.adm-roles__card-actions {
  display: flex;
  gap: var(--space-1);
  margin-top: var(--space-1);
}

.adm-roles__action-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: var(--space-2);
  border-radius: var(--radius-sm, 12px);
  color: var(--color-text-placeholder);
  transition: all var(--dur-short, 200ms) var(--ease-out);
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.adm-roles__action-btn:hover:not(:disabled) {
  color: var(--color-text-muted);
  background: var(--color-border);
}

.adm-roles__action-btn--danger:hover:not(:disabled) {
  color: var(--color-danger);
  background: rgba(200, 62, 59, 0.08);
}

.adm-roles__action-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.adm-roles__action-btn .li-icon {
  font-size: 18px;
}

.adm-roles__card-cta {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  margin-top: var(--space-2);
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-muted);
}

.adm-roles__card-cta .li-icon {
  font-size: 16px;
  transition: transform var(--dur-short, 200ms) var(--ease-out);
}

.adm-roles__card:hover .adm-roles__card-cta {
  color: var(--color-text-muted);
}

.adm-roles__card:hover .adm-roles__card-cta .li-icon {
  transform: translateX(2px);
}
</style>
