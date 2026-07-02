<template>
  <div class="dash">
    <!-- Header -->
    <header class="dash__header">
      <div class="dash__avatar">{{ initial }}</div>
      <div class="dash__head-body">
        <h1 class="dash__title">Halo, {{ displayName }} 👋</h1>
        <p class="dash__subtitle">
          <span class="dash__role-tag">{{ profile?.role || '—' }}</span>
          <span class="dash__sep">·</span>
          <span>{{ profile?.is_active ? 'Aktif' : 'Pending' }}</span>
        </p>
      </div>
    </header>

    <!-- Tools -->
    <section class="dash__section">
      <h2 class="dash__section-title">Tools</h2>
      <div v-if="tools.length" class="dash__grid">
        <router-link
          v-for="m in tools"
          :key="m.id"
          :to="m.path"
          class="dash__card"
        >
          <span class="material-symbols-outlined dash__card-icon">{{ m.icon }}</span>
          <span class="dash__card-label">{{ m.label }}</span>
          <span class="dash__card-desc">{{ m.desc }}</span>
          <span class="dash__card-cta">
            Buka
            <span class="material-symbols-outlined">arrow_forward</span>
          </span>
        </router-link>
      </div>
      <div v-else class="dash__empty">
        <span class="material-symbols-outlined">lock</span>
        <p>Role lo belum dikasih akses tools. Hubungi admin.</p>
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { MODULE_REGISTRY } from '@/lib/modules.js'
import { useAuth } from '@/composables/useAuth.js'
import { useAccess } from '@/composables/useAccess.js'

const { profile, session } = useAuth()
const { canModule } = useAccess()

const displayName = computed(() =>
  profile.value?.full_name || profile.value?.username || session.value?.user?.email || 'ada'
)
const initial = computed(() =>
  (displayName.value || '?').charAt(0).toUpperCase()
)

// Accessible tool modules (exclude dashboard itself + admin panel).
const tools = computed(() =>
  MODULE_REGISTRY
    .filter(m => !['dashboard', 'admin'].includes(m.id))
    .filter(m => canModule(m.id))
)
</script>

<style scoped>
.dash {
  max-width: 960px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: var(--space-xl, 32px);
  animation: dash-in 500ms var(--ease-smooth, cubic-bezier(0.16, 1, 0.3, 1)) both;
}

@keyframes dash-in {
  from { opacity: 0; transform: translateY(16px); }
  to { opacity: 1; transform: translateY(0); }
}

/* ── Header ── */
.dash__header {
  display: flex;
  align-items: center;
  gap: var(--space-m, 12px);
  padding: var(--space-l, 16px) var(--space-xl, 24px);
  background: rgba(255, 255, 255, 0.7);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border: 1px solid rgba(0, 0, 0, 0.05);
  border-radius: var(--radius-lg, 20px);
  box-shadow: var(--shadow-sm);
}

.dash__avatar {
  width: 52px;
  height: 52px;
  border-radius: var(--radius-md, 16px);
  background: linear-gradient(135deg, var(--cta-primary-bg, #FFBC25), var(--color-orange-300, #FF8C00));
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--font-display, 'Inter', sans-serif);
  font-weight: 700;
  font-size: 22px;
  color: var(--cta-primary-text, #1E1E1E);
  flex-shrink: 0;
}

.dash__head-body {
  min-width: 0;
}

.dash__title {
  font-family: var(--font-display, 'Inter', sans-serif);
  font-weight: 700;
  font-size: 22px;
  color: var(--color-on-surface, #333);
  margin: 0 0 4px;
  letter-spacing: -0.5px;
}

.dash__subtitle {
  display: flex;
  align-items: center;
  gap: var(--space-xs, 6px);
  margin: 0;
  font-size: 13px;
  color: var(--color-on-surface-muted, #999);
}

.dash__role-tag {
  font-weight: 700;
  color: var(--cta-primary-bg, #FFBC25);
}

.dash__sep {
  opacity: 0.5;
}

/* ── Section ── */
.dash__section-title {
  font-size: 13px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.6px;
  color: var(--color-on-surface-muted, #999);
  margin: 0 0 var(--space-m, 12px);
}

.dash__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: var(--space-m, 12px);
}

.dash__card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: var(--space-xs, 4px);
  padding: var(--space-l, 16px);
  background: rgba(255, 255, 255, 0.75);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border: 1px solid rgba(0, 0, 0, 0.05);
  border-radius: var(--radius-md, 16px);
  text-decoration: none;
  transition: all var(--dur-short, 200ms) var(--ease-out);
  box-shadow: var(--shadow-sm);
}

.dash__card:hover {
  border-color: var(--cta-primary-bg, #FFBC25);
  box-shadow: var(--shadow-md);
  transform: translateY(-3px);
}

.dash__card-icon {
  font-size: 28px;
  color: var(--cta-primary-bg, #FFBC25);
  margin-bottom: var(--space-xs, 4px);
}

.dash__card-label {
  font-weight: 700;
  font-size: 15px;
  color: var(--color-on-surface, #333);
}

.dash__card-desc {
  font-size: 12px;
  color: var(--color-on-surface-muted, #999);
  line-height: 1.4;
  flex: 1;
}

.dash__card-cta {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  margin-top: var(--space-s, 8px);
  font-size: 12px;
  font-weight: 700;
  color: var(--cta-primary-bg, #FFBC25);
}

.dash__card-cta .material-symbols-outlined {
  font-size: 16px;
  transition: transform var(--dur-short, 200ms) var(--ease-out);
}

.dash__card:hover .dash__card-cta .material-symbols-outlined {
  transform: translateX(3px);
}

.dash__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-s, 8px);
  padding: var(--space-3xl, 48px);
  color: var(--color-on-surface-muted, #999);
  font-size: 13px;
  text-align: center;
  background: rgba(255, 255, 255, 0.5);
  border-radius: var(--radius-md, 16px);
}

.dash__empty .material-symbols-outlined {
  font-size: 32px;
  color: var(--color-gray-300, #ccc);
}

@media (max-width: 640px) {
  .dash__title { font-size: 18px; }
  .dash__avatar { width: 44px; height: 44px; font-size: 18px; }
}
</style>
