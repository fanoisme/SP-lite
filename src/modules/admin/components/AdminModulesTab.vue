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
          <LiIcon :name="m.icon" class="adm-modules__card-icon" />
          <span class="adm-modules__card-name">{{ m.label }}</span>
          <LiIcon
            v-if="m.id === 'admin'"
            name="lock"
            class="adm-modules__lock"
            title="Cannot be disabled"
          />
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
          <LiIcon name="chevron-right" />
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
  color: var(--color-text-muted);
  margin: 0 0 var(--space-4);
}

.adm-modules__loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-3);
  padding: var(--space-8);
  color: var(--color-text-muted);
  font-size: 13px;
}

.adm-modules__spinner {
  width: 20px;
  height: 20px;
  border: 2.5px solid var(--color-border);
  border-top-color: var(--color-accent);
  border-radius: 50%;
  animation: adm-modules-spin 0.8s linear infinite;
}

@keyframes adm-modules-spin {
  to { transform: rotate(360deg); }
}

.adm-modules__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: var(--space-3);
}

.adm-modules__card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-4);
  background: var(--color-bg);
  border: 1px solid var(--color-surface-2);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-card);
  cursor: pointer;
  transition: all var(--dur-short) var(--ease-out);
}

.adm-modules__card:hover {
  border-color: var(--color-accent);
  box-shadow: var(--shadow-pop);
  transform: translateY(-2px);
}

.adm-modules__card.is-disabled {
  background: var(--color-surface);
  opacity: 0.75;
}

.adm-modules__card-head {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.adm-modules__card-icon {
  font-size: 22px;
  color: var(--color-text-placeholder);
}

.adm-modules__card-name {
  font-weight: 700;
  font-size: 15px;
  color: var(--color-text);
  flex: 1;
  min-width: 0;
}

.adm-modules__lock {
  font-size: 16px;
  color: var(--color-text-muted);
}

.adm-modules__card-desc {
  font-size: 12px;
  color: var(--color-text-muted);
  margin: 0;
  line-height: 1.5;
  min-height: 36px;
}

.adm-modules__card-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  margin-top: var(--space-1);
}

.adm-modules__meta {
  font-size: 12px;
  color: var(--color-text-muted);
}

.adm-modules__switch {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-muted);
  cursor: pointer;
  user-select: none;
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-pill);
  background: var(--color-border);
  transition: all var(--dur-short) var(--ease-out);
}

.adm-modules__switch.is-on {
  color: var(--color-success);
  background: rgba(16, 185, 129, 0.1);
}

.adm-modules__switch input[type='checkbox'] {
  width: 14px;
  height: 14px;
  accent-color: var(--color-accent);
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
  margin-top: var(--space-2);
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-muted);
}

.adm-modules__card-cta .li-icon {
  font-size: 16px;
  transition: transform var(--dur-short) var(--ease-out);
}

.adm-modules__card:hover .adm-modules__card-cta {
  color: var(--color-text-muted);
}

.adm-modules__card:hover .adm-modules__card-cta .li-icon {
  transform: translateX(2px);
}
</style>
