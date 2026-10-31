<template>
  <div class="dash">
    <!-- Header -->
    <header class="dash__header">
      <div class="dash__avatar">{{ initial }}</div>
      <div class="dash__head-body">
        <h1 class="dash__title">Halo, {{ displayName }} 👋</h1>
        <p class="dash__subtitle">
          {{ profile?.role || '—' }}
          <LiBadge :variant="profile?.is_active ? 'success' : 'neutral'" size="sm">
            {{ profile?.is_active ? 'Aktif' : 'Pending' }}
          </LiBadge>
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
          <LiIcon :name="m.icon" class="dash__card-icon" />
          <span class="dash__card-label">{{ m.label }}</span>
          <span class="dash__card-desc">{{ m.desc }}</span>
          <span class="dash__card-cta">
            Buka
            <LiIcon name="arrow-right" />
          </span>
        </router-link>
      </div>
      <div v-else class="dash__empty">
        <LiIcon name="lock" />
        <p>Role lo belum dikasih akses tools. Hubungi admin.</p>
      </div>
    </section>

    <!-- DD MPM Summary -->
    <section v-if="showDdSummary" class="dash__section">
      <h2 class="dash__section-title">DD MPM Summary</h2>
      <div class="dash__summary-grid">
        <div class="dash__summary-card">
          <span class="dash__summary-num">{{ ddStats.buCount }}</span>
          <span class="dash__summary-label">BU Accounts</span>
        </div>
        <div class="dash__summary-card">
          <span class="dash__summary-num">{{ ddStats.merchantActive }}</span>
          <span class="dash__summary-label">Active Merchants</span>
        </div>
        <div class="dash__summary-card">
          <span class="dash__summary-num">{{ ddStats.promoActive }}</span>
          <span class="dash__summary-label">Active Promos</span>
        </div>
        <div class="dash__summary-card">
          <span class="dash__summary-num">{{ ddStats.expiringCount }}</span>
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
import { useDdSummary } from '@/modules/dd/composables/useDdSummary.js'
import LiBadge from '@/lib/components/LiBadge.vue'

const { profile, session } = useAuth()
const { canModule } = useAccess()
const ddSummary = useDdSummary()

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

const showDdSummary = computed(() => canModule('dd'))

const ddStats = computed(() => ddSummary.stats.value)

onMounted(() => {
  if (canModule('dd')) {
    ddSummary.load()
  }
})
</script>

<style scoped>
/* L3 overview (dashboard.html): page head two lines, flat stat tiles, no glass. */
.dash {
  display: flex;
  flex-direction: column;
  gap: var(--space-8);
  animation: dash-in var(--dur-long) var(--ease-enter) both;
}

@keyframes dash-in {
  from { opacity: 0; transform: translateY(8px); }
}

/* ── Page head ── */
.dash__header {
  display: flex;
  align-items: center;
  gap: var(--space-4);
}

.dash__avatar {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: var(--color-accent-soft);
  color: var(--color-accent-text);
  display: grid;
  place-items: center;
  font-weight: 700;
  font-size: var(--text-base);
  flex-shrink: 0;
  box-shadow: 0 0 0 2px var(--color-bg);
}

.dash__title {
  font-weight: 700;
  font-size: 24px;
  line-height: 32px;
  color: var(--color-text-strong);
  margin: 0 0 4px;
}

.dash__subtitle {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin: 0;
  font-size: var(--text-sm);
  color: var(--color-text-muted);
}

/* ── Sections ── */
.dash__section-title {
  font-size: var(--text-xs);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--color-text-muted);
  margin: 0 0 var(--space-3);
}

.dash__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: var(--space-4);
}

.dash__card {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  padding: var(--space-4);
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  text-decoration: none;
  box-shadow: var(--shadow-card);
  transition: border-color var(--dur-quick), box-shadow var(--dur-short) var(--ease-out), transform var(--dur-short) var(--ease-out);
}

.dash__card:hover {
  border-color: var(--color-border-strong);
  box-shadow: 0 8px 20px -8px rgba(0, 5, 58, 0.18);
  transform: var(--lift);
}

.dash__card:focus-visible {
  outline: 2px solid var(--color-focus);
  outline-offset: 2px;
}

.dash__card-icon {
  font-size: 24px;
  color: var(--color-accent-text);
  margin-bottom: var(--space-2);
}

.dash__card-label {
  font-weight: 600;
  font-size: var(--text-sm);
  color: var(--color-text-strong);
}

.dash__card-desc {
  font-size: var(--text-xs);
  color: var(--color-text-muted);
  line-height: var(--leading-xs);
  flex: 1;
}

.dash__card-cta {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  margin-top: var(--space-2);
  font-size: var(--text-xs);
  font-weight: 700;
  color: var(--color-text-strong);
}

.dash__card-cta :deep(.li-icon) {
  transition: transform var(--dur-short) var(--ease-out);
}

.dash__card:hover .dash__card-cta :deep(.li-icon) {
  transform: translateX(3px);
}

.dash__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-12);
  color: var(--color-text-muted);
  font-size: var(--text-sm);
  text-align: center;
  background: var(--color-surface);
  border-radius: var(--radius-lg);
}

/* ── Stat tiles ── */
.dash__summary-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: var(--space-4);
}

.dash__summary-card {
  display: grid;
  gap: var(--space-1);
  justify-items: center;
  padding: var(--space-4);
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-card);
}

.dash__summary-num {
  font-size: var(--text-xl);
  font-weight: 700;
  color: var(--color-text-strong);
  font-variant-numeric: tabular-nums;
  line-height: var(--leading-sm);
}

.dash__summary-label {
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--color-text-muted);
  text-align: center;
}

@media (prefers-reduced-motion: reduce) {
  .dash { animation: none; }
}
</style>
