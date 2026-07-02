<template>
  <div class="adm-modules">
    <p class="adm-modules__desc">
      Globally enable or disable modules. Disabled modules vanish from every user's sidebar and URL until re-enabled.
    </p>

    <div v-if="loading" class="adm-modules__loading">
      <div class="adm-modules__spinner"></div>
      <span>Loading modules...</span>
    </div>

    <div v-else class="adm-modules__grid">
      <div
        v-for="m in modules"
        :key="m.id"
        class="adm-modules__card"
        :class="{ 'is-disabled': !m.is_enabled }"
        @click="$emit('open-module', m)"
      >
        <header class="adm-modules__card-head">
          <span class="material-symbols-outlined adm-modules__card-icon">{{ m.icon }}</span>
          <span class="adm-modules__card-name">{{ m.label }}</span>
          <span
            v-if="m.id === 'admin'"
            class="material-symbols-outlined adm-modules__lock"
            title="Cannot be disabled"
          >lock</span>
        </header>

        <p class="adm-modules__card-desc">{{ m.desc }}</p>

        <footer class="adm-modules__card-foot">
          <span class="adm-modules__meta">
            {{ m.features.length }} feature{{ m.features.length !== 1 ? 's' : '' }} · {{ m.role_count }} role{{ m.role_count !== 1 ? 's' : '' }}
          </span>
          <label class="adm-modules__switch" :class="{ 'is-on': m.is_enabled }" @click.stop>
            <input
              type="checkbox"
              :checked="m.is_enabled"
              :disabled="m.id === 'admin'"
              @change="$emit('toggle-enabled', m.id, $event.target.checked)"
            />
            <span class="adm-modules__switch-text">{{ m.is_enabled ? 'Enabled' : 'Disabled' }}</span>
          </label>
        </footer>

        <span class="adm-modules__card-cta">
          Configure
          <span class="material-symbols-outlined">chevron_right</span>
        </span>
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  modules: Array,
  loading: Boolean,
})

defineEmits(['open-module', 'toggle-enabled'])
</script>

<style scoped>
.adm-modules__desc {
  font-size: 13px;
  color: var(--color-on-surface-muted, #999);
  margin: 0 0 var(--space-l, 16px);
}

.adm-modules__loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-m, 12px);
  padding: var(--space-2xl, 32px);
  color: var(--color-on-surface-muted, #999);
  font-size: 13px;
}

.adm-modules__spinner {
  width: 20px;
  height: 20px;
  border: 2.5px solid rgba(0, 0, 0, 0.06);
  border-top-color: var(--cta-primary-bg, #ffbc25);
  border-radius: 50%;
  animation: adm-modules-spin 0.8s linear infinite;
}

@keyframes adm-modules-spin {
  to { transform: rotate(360deg); }
}

.adm-modules__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: var(--space-m, 12px);
}

.adm-modules__card {
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

.adm-modules__card:hover {
  border-color: var(--cta-primary-bg, #ffbc25);
  box-shadow: var(--shadow-md, 0 6px 20px rgba(0, 0, 0, 0.06));
  transform: translateY(-2px);
}

.adm-modules__card.is-disabled {
  background: var(--color-gray-50, #fafafa);
  opacity: 0.75;
}

.adm-modules__card-head {
  display: flex;
  align-items: center;
  gap: var(--space-s, 6px);
}

.adm-modules__card-icon {
  font-size: 22px;
  color: var(--color-gray-400, #b3b3b3);
}

.adm-modules__card-name {
  font-weight: 700;
  font-size: 15px;
  color: var(--color-on-surface, #333);
  flex: 1;
  min-width: 0;
}

.adm-modules__lock {
  font-size: 16px;
  color: var(--color-on-surface-muted, #999);
}

.adm-modules__card-desc {
  font-size: 12px;
  color: var(--color-on-surface-muted, #999);
  margin: 0;
  line-height: 1.5;
  min-height: 36px;
}

.adm-modules__card-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-s, 8px);
  margin-top: var(--space-xs, 4px);
}

.adm-modules__meta {
  font-size: 12px;
  color: var(--color-on-surface-muted, #999);
}

.adm-modules__switch {
  display: inline-flex;
  align-items: center;
  gap: var(--space-xs, 6px);
  font-size: 12px;
  font-weight: 600;
  color: var(--color-on-surface-muted, #999);
  cursor: pointer;
  user-select: none;
  padding: var(--space-xs, 4px) var(--space-s, 8px);
  border-radius: var(--radius-pill, 999px);
  background: rgba(0, 0, 0, 0.04);
  transition: all var(--dur-short, 200ms) var(--ease-out);
}

.adm-modules__switch.is-on {
  color: var(--color-success, #10b981);
  background: rgba(16, 185, 129, 0.1);
}

.adm-modules__switch input[type='checkbox'] {
  width: 14px;
  height: 14px;
  accent-color: var(--cta-primary-bg, #ffbc25);
  cursor: pointer;
  margin: 0;
}

.adm-modules__switch input:disabled {
  cursor: not-allowed;
}

.adm-modules__card-cta {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  margin-top: var(--space-s, 8px);
  font-size: 12px;
  font-weight: 600;
  color: var(--color-on-surface-muted, #999);
}

.adm-modules__card-cta .material-symbols-outlined {
  font-size: 16px;
  transition: transform var(--dur-short, 200ms) var(--ease-out);
}

.adm-modules__card:hover .adm-modules__card-cta {
  color: var(--color-on-surface-variant, #666);
}

.adm-modules__card:hover .adm-modules__card-cta .material-symbols-outlined {
  transform: translateX(2px);
}
</style>
