<template>
  <LiModal :modelValue="true" @update:modelValue="$emit('close')" title="Role access" size="lg">
    <div class="ard__head">
      <div class="ard__head-main">
        <h3 class="ard__title">{{ role.name }}</h3>
        <span class="ard__summary">{{ summary }}</span>
      </div>
      <LiChip v-if="role.is_system" variant="warning" size="sm" iconLeft="lock">system</LiChip>
    </div>

    <div class="ard__list">
      <div v-for="m in modules" :key="m.id" class="ard__mod">
        <div class="ard__mod-head">
          <label class="ard__check">
            <input
              type="checkbox"
              :checked="isModuleOn(m.id)"
              :disabled="isModuleLocked(m.id)"
              @change="onToggleModule(m.id, $event.target.checked)"
            />
            <span class="material-symbols-outlined ard__mod-icon">{{ m.icon }}</span>
            <span class="ard__mod-label">{{ m.label }}</span>
          </label>
          <span class="ard__mod-desc">{{ m.desc }}</span>
        </div>

        <div v-if="isModuleOn(m.id) && m.features.length" class="ard__feats">
          <label v-for="f in m.features" :key="f.id" class="ard__check ard__check--sub">
            <input
              type="checkbox"
              :checked="isFeatureOn(m.id, f.id)"
              @change="onToggleFeature(m.id, f.id, $event.target.checked)"
            />
            <span class="ard__feat-label">{{ f.label }}</span>
            <span class="ard__feat-desc">{{ f.desc }}</span>
          </label>
          <p v-if="featuresGranted(role.name, m.id) === null" class="ard__hint">
            <span class="material-symbols-outlined">info</span>
            No explicit feature set — role gets all features of {{ m.label }} (default).
          </p>
        </div>
      </div>
    </div>

    <template #footer>
      <button class="ard__done-btn" @click="$emit('close')">Done</button>
    </template>
  </LiModal>
</template>

<script setup>
import { computed, ref, onMounted } from 'vue'
import LiModal from '@lib/components/LiModal.vue'
import LiChip from '@lib/components/LiChip.vue'
import { useModules } from '@/composables/useModules.js'
import { useAdminAccess } from '../composables/useAdminAccess.js'

const props = defineProps({ role: { type: Object, required: true } })
defineEmits(['close'])

const { registry, loadRegistry } = useModules()
const {
  isModuleGranted, toggleModule,
  featuresGranted, setRoleFeatures,
} = useAdminAccess()

// Local draft of explicit feature sets: moduleId -> Set<featureId>.
// Absent entry = no explicit row → UI shows "all (default)".
const draftFeatures = ref({})

onMounted(async () => {
  await loadRegistry()
  const seed = {}
  for (const m of (registry.value || [])) {
    const cur = featuresGranted(props.role.name, m.id)
    if (cur) seed[m.id] = new Set(cur)
  }
  draftFeatures.value = seed
})

const modules = computed(() => registry.value || [])
const summary = computed(() => {
  const onMods = modules.value.filter(m => isModuleGranted(props.role.name, m.id))
  return `${onMods.length}/${modules.value.length} modules · ${props.role.user_count || 0} user(s)`
})

function isModuleLocked(mId) {
  // System role's grip on the admin module cannot be released.
  return props.role.is_system && mId === 'admin'
}
function isModuleOn(mId) {
  return isModuleGranted(props.role.name, mId)
}
function isFeatureOn(mId, fId) {
  const explicit = featuresGranted(props.role.name, mId)
  if (explicit === null) return true // default-all → check every feature
  return (draftFeatures.value[mId] || new Set()).has(fId)
}

async function onToggleModule(mId, on) {
  await toggleModule(props.role.name, mId)
}

async function onToggleFeature(mId, fId, on) {
  const mod = modules.value.find(m => m.id === mId)
  // Materialise the full set from default-all on first edit so the explicit
  // row replaces (not narrows) the default — other features stay granted.
  const explicit = featuresGranted(props.role.name, mId)
  const cur = new Set(draftFeatures.value[mId] || explicit || mod.features.map(f => f.id))
  if (on) cur.add(fId); else cur.delete(fId)
  draftFeatures.value = { ...draftFeatures.value, [mId]: cur }
  await setRoleFeatures(props.role.name, mId, [...cur])
}
</script>

<style scoped>
.ard__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-m, 12px);
  padding-bottom: var(--space-m, 12px);
  border-bottom: 1px solid var(--color-gray-100, #f2f2f2);
}

.ard__head-main {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.ard__title {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  color: var(--color-on-surface, #333);
}

.ard__summary {
  font-size: 12px;
  color: var(--color-on-surface-muted, #999);
}

.ard__list {
  display: flex;
  flex-direction: column;
  gap: var(--space-s, 8px);
  margin-top: var(--space-m, 12px);
}

.ard__mod {
  padding: var(--space-m, 12px) 0;
  border-top: 1px solid var(--color-gray-100, #f2f2f2);
}

.ard__mod:first-child {
  border-top: none;
  padding-top: 0;
}

.ard__mod-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-m, 12px);
  flex-wrap: wrap;
}

.ard__check {
  display: inline-flex;
  align-items: center;
  gap: var(--space-s, 8px);
  font-size: 13px;
  font-weight: 600;
  color: var(--color-on-surface, #333);
  cursor: pointer;
  user-select: none;
}

.ard__check input[type='checkbox'] {
  width: 16px;
  height: 16px;
  accent-color: var(--cta-primary-bg, #ffbc25);
  cursor: pointer;
}

.ard__check input:disabled {
  cursor: not-allowed;
}

.ard__mod-icon {
  font-size: 20px;
  color: var(--color-gray-400, #b3b3b3);
}

.ard__mod-label {
  font-size: 14px;
}

.ard__mod-desc {
  font-size: 12px;
  color: var(--color-on-surface-muted, #999);
}

.ard__feats {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs, 4px);
  padding: var(--space-s, 8px) 0 var(--space-xs, 4px) var(--space-xl, 28px);
}

.ard__check--sub {
  font-weight: 500;
  flex-wrap: wrap;
}

.ard__feat-label {
  font-size: 13px;
  color: var(--color-on-surface-variant, #666);
}

.ard__feat-desc {
  font-size: 11px;
  color: var(--color-on-surface-muted, #999);
  margin-left: var(--space-xs, 4px);
}

.ard__hint {
  display: flex;
  align-items: center;
  gap: var(--space-xs, 6px);
  margin: var(--space-s, 8px) 0 0;
  font-size: 12px;
  color: var(--color-on-surface-muted, #999);
  font-style: italic;
}

.ard__hint .material-symbols-outlined {
  font-size: 14px;
}

.ard__done-btn {
  padding: 10px 24px;
  background: var(--cta-primary-bg, #ffbc25);
  color: var(--cta-primary-text, #1e1e1e);
  border: none;
  border-radius: var(--radius-pill, 999px);
  font-size: 13px;
  font-weight: 700;
  font-family: var(--font-body, 'Inter', sans-serif);
  cursor: pointer;
  transition: all var(--dur-short, 200ms) var(--ease-out);
}

.ard__done-btn:hover {
  background: var(--cta-primary-hover, #ffb60a);
  transform: translateY(-1px);
}
</style>
