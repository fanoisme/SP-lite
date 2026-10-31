<template>
  <LiModal :modelValue="true" @update:modelValue="$emit('close')" :title="mod.label" size="lg">
    <p class="amd__desc">{{ mod.desc }}</p>

    <section class="amd__section">
      <h4 class="amd__heading">Global state</h4>
      <label class="amd__switch" :class="{ 'is-on': enabled }">
        <input
          type="checkbox"
          :checked="enabled"
          :disabled="mod.id === 'admin'"
          @change="onToggle($event.target.checked)"
        />
        <span>{{ enabled ? 'Enabled for everyone' : 'Disabled for everyone' }}</span>
        <LiIcon
          v-if="mod.id === 'admin'"
          name="lock"
          class="amd__lock"
          title="Cannot be disabled"
        />
      </label>
      <p v-if="mod.id === 'admin'" class="amd__hint">The admin module cannot be disabled (anti-lockout).</p>
    </section>

    <section v-if="mod.features && mod.features.length" class="amd__section">
      <h4 class="amd__heading">Features</h4>
      <ul class="amd__feats">
        <li v-for="f in mod.features" :key="f.id" class="amd__feat">
          <strong>{{ f.label }}</strong>
          <span class="amd__feat-desc">{{ f.desc }}</span>
        </li>
      </ul>
    </section>

    <section class="amd__section">
      <h4 class="amd__heading">Roles with access</h4>
      <div class="amd__chips">
        <span v-for="r in rolesWithAccess" :key="r" class="amd__chip">{{ r }}</span>
        <span v-if="!rolesWithAccess.length" class="amd__hint">No roles have this module.</span>
      </div>
    </section>

    <template #footer>
      <button class="amd__done-btn" @click="$emit('close')">Done</button>
    </template>
  </LiModal>
</template>

<script setup>
import { ref, computed } from 'vue'
import LiModal from '@lib/components/LiModal.vue'
import { useAdminAccess } from '../composables/useAdminAccess.js'

const props = defineProps({
  mod: { type: Object, required: true },
  roles: { type: Array, default: () => [] },
})
defineEmits(['close'])

const { isModuleEnabled, setModuleEnabled, isModuleGranted, loadModules } = useAdminAccess()

const enabled = ref(isModuleEnabled(props.mod.id))

const rolesWithAccess = computed(() =>
  (props.roles || [])
    .filter(r => isModuleGranted(r.name, props.mod.id))
    .map(r => r.name),
)

async function onToggle(on) {
  const ok = await setModuleEnabled(props.mod.id, on)
  enabled.value = ok ? on : !on
  if (ok) await loadModules()  // refresh Modules-tab card (is_enabled + role_count)
}
</script>

<style scoped>
.amd__desc {
  font-size: 13px;
  color: var(--color-text-muted);
  margin: 0 0 var(--space-3);
}

.amd__section {
  padding: var(--space-3) 0;
  border-top: 1px solid var(--color-surface-2);
}

.amd__section:first-of-type {
  border-top: none;
  padding-top: 0;
}

.amd__heading {
  margin: 0 0 var(--space-2);
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.6px;
  color: var(--color-text-muted);
}

.amd__switch {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-muted);
  cursor: pointer;
  user-select: none;
  padding: var(--space-1) var(--space-3);
  border-radius: var(--radius-pill);
  background: var(--color-border);
}

.amd__switch.is-on {
  color: var(--color-success);
  background: rgba(16, 185, 129, 0.1);
}

.amd__switch input[type='checkbox'] {
  width: 16px;
  height: 16px;
  accent-color: var(--color-accent);
  cursor: pointer;
}

.amd__switch input:disabled {
  cursor: not-allowed;
}

.amd__lock {
  font-size: 16px;
  color: var(--color-text-muted);
}

.amd__hint {
  margin: var(--space-2) 0 0;
  font-size: 12px;
  color: var(--color-text-muted);
  font-style: italic;
}

.amd__feats {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.amd__feat {
  font-size: 13px;
  color: var(--color-text-muted);
}

.amd__feat strong {
  color: var(--color-text);
  font-weight: 600;
}

.amd__feat-desc {
  margin-left: var(--space-1);
  color: var(--color-text-muted);
}

.amd__chips {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1);
}

.amd__chip {
  display: inline-flex;
  align-items: center;
  padding: var(--space-1) var(--space-3);
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-muted);
  background: var(--color-border);
  border-radius: var(--radius-pill);
}

.amd__done-btn {
  padding: 10px 24px;
  background: var(--color-accent);
  color: var(--color-on-accent);
  border: none;
  border-radius: var(--radius-pill);
  font-size: 13px;
  font-weight: 700;
  font-family: var(--font-sans);
  cursor: pointer;
  transition: all var(--dur-short) var(--ease-out);
}

.amd__done-btn:hover {
  background: var(--color-accent-strong);
  transform: translateY(-1px);
}
</style>
