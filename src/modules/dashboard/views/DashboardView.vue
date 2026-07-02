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

    <!-- QR DD Summary -->
    <section v-if="showQrddSummary" class="dash__section">
      <h2 class="dash__section-title">QR DD Summary</h2>
      <div class="dash__summary-grid">
        <div class="dash__summary-card">
          <span class="dash__summary-num">{{ qrddStats.buCount }}</span>
          <span class="dash__summary-label">BU Accounts</span>
        </div>
        <div class="dash__summary-card">
          <span class="dash__summary-num">{{ qrddStats.merchantActive }}</span>
          <span class="dash__summary-label">Active Merchants</span>
        </div>
        <div class="dash__summary-card">
          <span class="dash__summary-num">{{ qrddStats.promoActive }}</span>
          <span class="dash__summary-label">Active Promos</span>
        </div>
        <div class="dash__summary-card">
          <span class="dash__summary-num">{{ qrddStats.expiringCount }}</span>
          <span class="dash__summary-label">Expiring ≤30 days</span>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed, onMounted } from 'vue'
import { MODULE_REGISTRY } from '@/lib/modules.js'
import { useAuth } from '@/composables/useAuth.js'
import { useAccess } from '@/composables/useAccess.js'
import { useQrddDashboard } from '@/modules/qrdd/composables/useQrddDashboard.js'

const { profile, session } = useAuth()
const { canModule } = useAccess()
const qrddDash = useQrddDashboard()

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

const showQrddSummary = computed(() => canModule('qrdd'))

const qrddStats = computed(() => ({
  buCount: qrddDash.stats.value.buCount,
  merchantActive: qrddDash.stats.value.merchantActive,
  promoActive: qrddDash.stats.value.promoActive,
  expiringCount: qrddDash.expiringPromos.value.length,
}))

onMounted(() => {
  if (canModule('qrdd')) {
    qrddDash.loadAll()
  }
})
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

.dash__summary-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: var(--space-m, 12px);
}
.dash__summary-card {
  display: flex; flex-direction: column; align-items: center; gap: 4px;
  padding: var(--space-l, 16px);
  background: rgba(255,255,255,0.55);
  backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px);
  border: 1px solid rgba(99,102,241,0.1);
  border-radius: var(--radius-md, 16px);
  transition: all 200ms;
}
.dash__summary-card:hover {
  border-color: rgba(99,102,241,0.3);
  box-shadow: 0 4px 16px rgba(99,102,241,0.08);
  transform: translateY(-2px);
}
.dash__summary-num {
  font-size: 28px; font-weight: 800; color: #6366F1;
  letter-spacing: -0.5px; font-family: var(--font-display, 'Inter', sans-serif);
}
.dash__summary-label {
  font-size: 11px; font-weight: 600; color: var(--color-gray-500, #8e8ea0);
  text-transform: uppercase; text-align: center;
}
</style>
