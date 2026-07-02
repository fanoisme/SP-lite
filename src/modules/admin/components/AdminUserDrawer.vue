<template>
  <LiModal :modelValue="true" @update:modelValue="tryClose" title="User access" size="lg">
    <div v-if="loading" class="aud__spinner">
      <LiSpinner />
    </div>
    <div v-else class="aud__drawer">
      <!-- Section 1: identity -->
      <section class="aud__identity">
        <div class="aud__avatar">{{ (user.username || '?')[0].toUpperCase() }}</div>
        <div class="aud__id-body">
          <h3 class="aud__username">{{ user.username }}</h3>
          <p class="aud__muted">
            {{ user.full_name || '—' }}
            <span class="aud__sep">·</span>
            role <span class="aud__role-tag">{{ user.role }}</span>
          </p>
        </div>
      </section>

      <!-- Section 2: effective access (read-only preview) -->
      <section class="aud__effective">
        <h4 class="aud__section-title">Effective access</h4>
        <div v-if="effective.modules.length" class="aud__eff-list">
          <div v-for="mId in effective.modules" :key="mId" class="aud__eff-mod">
            <span class="aud__mod-name">{{ labelFor(mId) }}</span>
            <span class="aud__chips">
              <span
                v-for="f in effective.features[mId] || []"
                :key="f"
                class="aud__chip"
              >{{ featureLabel(mId, f) }}</span>
              <span v-if="!(effective.features[mId] || []).length" class="aud__muted">whole module</span>
            </span>
          </div>
        </div>
        <p v-else class="aud__muted">No module access.</p>
      </section>

      <!-- Section 3: overrides (hidden for Admin role — overrides do not apply) -->
      <section v-if="user.role !== 'Admin'" class="aud__overrides">
        <h4 class="aud__section-title">Custom overrides</h4>
        <p class="aud__hint">Grant or deny access beyond the role baseline. Inherit = use role default.</p>
        <div v-for="m in modules" :key="m.id" class="aud__ov-mod">
          <div class="aud__ov-row">
            <span class="aud__mod-name">{{ m.label }}</span>
            <TriToggle
              :modelValue="overrideMode(m.id, '')"
              :aria-label="`${m.label} module override`"
              @update:modelValue="setOverride(m.id, '', $event)"
            />
          </div>
          <div v-for="f in m.features" :key="f.id" class="aud__ov-row aud__ov-row--sub">
            <span class="aud__feat-name">{{ f.label }}</span>
            <TriToggle
              :modelValue="overrideMode(m.id, f.id)"
              :aria-label="`${m.label} ${f.label} override`"
              @update:modelValue="setOverride(m.id, f.id, $event)"
            />
          </div>
        </div>
      </section>
      <p v-else class="aud__note">
        <span class="material-symbols-outlined">info</span>
        Admin role always has full access — overrides do not apply.
      </p>
    </div>

    <template #footer>
      <button class="aud__cancel-btn" @click="tryClose">Close</button>
      <button
        v-if="user.role !== 'Admin'"
        class="aud__save-btn"
        :disabled="saving || !dirty"
        @click="save"
      >
        {{ saving ? 'Saving…' : 'Save overrides' }}
      </button>
    </template>
  </LiModal>
</template>

<script setup>
import { ref, computed, watchEffect } from 'vue'
import LiModal from '@lib/components/LiModal.vue'
import LiSpinner from '@lib/components/LiSpinner.vue'
import TriToggle from './TriToggle.vue'
import { useModules } from '@/composables/useModules.js'
import { useAdminUserAccess } from '../composables/useAdminUserAccess.js'

const props = defineProps({ user: { type: Object, required: true } })
const emit = defineEmits(['close', 'changed'])

const { registry, loadRegistry } = useModules()
const { overrides, effective, loading, saving, loadUserAccess, saveUserAccess } = useAdminUserAccess()

// local working copy: Map<"mId|fId", mode>
const draft = ref(new Map())
const dirty = ref(false)

watchEffect(async () => {
  if (props.user?.id) {
    await loadUserAccess(props.user.id)
    await loadRegistry()
    draft.value = new Map(
      overrides.value.map(o => [`${o.moduleId}|${o.featureId || ''}`, o.mode]),
    )
    dirty.value = false
  }
})

const modules = computed(() => registry.value || [])

function labelFor(id) {
  const m = (registry.value || []).find(m => m.id === id)
  return m?.label || id
}
function featureLabel(mId, fId) {
  const m = (registry.value || []).find(m => m.id === mId)
  return m?.features.find(f => f.id === fId)?.label || fId
}

function overrideMode(mId, fId) {
  return draft.value.get(`${mId}|${fId}`) || 'inherit'
}
function setOverride(mId, fId, mode) {
  const key = `${mId}|${fId}`
  const next = new Map(draft.value)
  if (mode === 'inherit') next.delete(key)
  else next.set(key, mode)
  draft.value = next
  dirty.value = true
}

async function save() {
  const next = [...draft.value.entries()].map(([k, mode]) => {
    const [moduleId, featureId] = k.split('|')
    return { moduleId, featureId: featureId || '', mode }
  })
  const ok = await saveUserAccess(props.user.id, next)
  if (ok) {
    dirty.value = false
    emit('changed')
  }
}

function tryClose() {
  if (dirty.value && !window.confirm('Discard unsaved changes?')) return
  emit('close')
}
</script>

<style scoped>
.aud__spinner {
  display: flex;
  justify-content: center;
  padding: var(--space-xl, 32px);
}

.aud__drawer {
  display: flex;
  flex-direction: column;
  gap: var(--space-l, 20px);
}

/* Section 1 — identity */
.aud__identity {
  display: flex;
  align-items: center;
  gap: var(--space-m, 12px);
  padding-bottom: var(--space-m, 12px);
  border-bottom: 1px solid var(--color-gray-100, #f2f2f2);
}

.aud__avatar {
  width: 40px;
  height: 40px;
  border-radius: var(--radius-sm, 12px);
  background: linear-gradient(135deg, var(--color-blue-100, #E6E6FF), var(--color-blue-200, #60A5FA));
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 15px;
  font-weight: 700;
  color: var(--color-blue-500, #0047B2);
  flex-shrink: 0;
}

.aud__id-body {
  min-width: 0;
}

.aud__username {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  color: var(--color-on-surface, #333);
}

.aud__muted {
  margin: 4px 0 0;
  font-size: 13px;
  color: var(--color-on-surface-muted, #999);
}

.aud__sep {
  margin: 0 6px;
  opacity: 0.6;
}

.aud__role-tag {
  font-weight: 600;
  color: var(--color-on-surface-variant, #666);
}

/* Section titles */
.aud__section-title {
  margin: 0 0 var(--space-s, 8px);
  font-size: 13px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-on-surface-muted, #999);
}

.aud__hint {
  margin: 0 0 var(--space-m, 12px);
  font-size: 12px;
  color: var(--color-on-surface-muted, #999);
}

/* Section 2 — effective */
.aud__eff-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-s, 8px);
}

.aud__eff-mod {
  display: flex;
  align-items: center;
  gap: var(--space-m, 12px);
  flex-wrap: wrap;
}

.aud__mod-name {
  min-width: 140px;
  font-weight: 600;
  font-size: 13px;
  color: var(--color-on-surface, #333);
}

.aud__chips {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 4px;
}

.aud__chip {
  padding: 2px 10px;
  border-radius: var(--radius-pill, 999px);
  background: var(--color-gray-100, #f2f2f2);
  font-size: 11px;
  font-weight: 500;
  color: var(--color-on-surface-variant, #666);
}

/* Section 3 — overrides */
.aud__overrides {
  display: flex;
  flex-direction: column;
  gap: var(--space-m, 12px);
}

.aud__ov-mod {
  padding: var(--space-s, 8px) 0;
  border-top: 1px solid var(--color-gray-100, #f2f2f2);
}

.aud__ov-mod:first-of-type {
  border-top: none;
  padding-top: 0;
}

.aud__ov-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-m, 12px);
  padding: 4px 0;
}

.aud__ov-row--sub {
  padding-left: var(--space-m, 12px);
}

.aud__feat-name {
  font-size: 13px;
  color: var(--color-on-surface-variant, #666);
}

.aud__note {
  display: flex;
  align-items: center;
  gap: var(--space-s, 8px);
  margin: 0;
  padding: var(--space-m, 12px) var(--space-l, 16px);
  border-radius: var(--radius-md, 12px);
  background: var(--color-gray-100, #f2f2f2);
  font-size: 13px;
  color: var(--color-on-surface-variant, #666);
}

.aud__note .material-symbols-outlined {
  font-size: 18px;
  color: var(--color-on-surface-muted, #999);
}

/* Footer buttons — mirror .admin__cancel-btn / .adm-users__add-btn */
.aud__cancel-btn {
  padding: 10px 20px;
  background: none;
  border: 1.5px solid var(--color-outline, #ccc);
  border-radius: var(--radius-pill, 999px);
  font-size: 13px;
  font-weight: 600;
  font-family: var(--font-body, 'Inter', sans-serif);
  color: var(--color-on-surface-variant, #666);
  cursor: pointer;
  transition: all var(--dur-short, 200ms) var(--ease-out);
}

.aud__cancel-btn:hover {
  border-color: var(--color-gray-400, #b3b3b3);
  color: var(--color-on-surface, #333);
}

.aud__save-btn {
  padding: 10px 24px;
  background: var(--cta-primary-bg, #FFBC25);
  color: var(--cta-primary-text, #1e1e1e);
  border: none;
  border-radius: var(--radius-pill, 999px);
  font-size: 13px;
  font-weight: 700;
  font-family: var(--font-body, 'Inter', sans-serif);
  cursor: pointer;
  transition: all var(--dur-short, 200ms) var(--ease-out);
}

.aud__save-btn:hover:not(:disabled) {
  background: var(--cta-primary-hover, #FFB60A);
  transform: translateY(-1px);
}

.aud__save-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

@media (max-width: 640px) {
  .aud__mod-name {
    min-width: 0;
    flex: 1;
  }
  .aud__ov-row {
    flex-wrap: wrap;
  }
}
</style>
