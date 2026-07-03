<template>
  <div class="dash-tab">
    <!-- Export -->
    <div class="dash-tab__toolbar">
      <button class="dash-tab__export-btn" @click="dash.exportDashboard()">
        <span class="material-symbols-outlined">file_save</span>
        Export Dashboard
      </button>
    </div>

    <div v-if="dash.loading.value" class="dash-tab__loading">
      <span class="material-symbols-outlined dash-tab__spinner">progress_activity</span>
      Loading dashboard...
    </div>

    <template v-else>
      <!-- Summary Cards -->
      <div class="dash-tab__cards">
        <div class="dash-tab__card">
          <div class="dash-tab__card-icon dash-tab__card-icon--bu">
            <span class="material-symbols-outlined">account_balance</span>
          </div>
          <div class="dash-tab__card-body">
            <div class="dash-tab__card-value">{{ dash.stats.value.buCount }}</div>
            <div class="dash-tab__card-label">BU Accounts</div>
            <div class="dash-tab__card-badges">
              <span class="dash-tab__badge dash-tab__badge--prime">PRIME {{ dash.stats.value.buPrimeCount }}</span>
              <span class="dash-tab__badge dash-tab__badge--paylater">PL {{ dash.stats.value.buPaylaterCount }}</span>
            </div>
          </div>
        </div>

        <div class="dash-tab__card">
          <div class="dash-tab__card-icon dash-tab__card-icon--mw">
            <span class="material-symbols-outlined">store</span>
          </div>
          <div class="dash-tab__card-body">
            <div class="dash-tab__card-value">{{ dash.stats.value.merchantCount }}</div>
            <div class="dash-tab__card-label">Merchants</div>
            <div class="dash-tab__card-badges">
              <span class="dash-tab__badge dash-tab__badge--active">Active {{ dash.stats.value.merchantActive }}</span>
              <span class="dash-tab__badge dash-tab__badge--inactive">Inactive {{ dash.stats.value.merchantInactive }}</span>
            </div>
          </div>
        </div>

        <div class="dash-tab__card">
          <div class="dash-tab__card-icon dash-tab__card-icon--pr">
            <span class="material-symbols-outlined">percent</span>
          </div>
          <div class="dash-tab__card-body">
            <div class="dash-tab__card-value">{{ dash.stats.value.promoCount }}</div>
            <div class="dash-tab__card-label">Promo Rules</div>
            <div class="dash-tab__card-badges">
              <span class="dash-tab__badge dash-tab__badge--active">Active {{ dash.stats.value.promoActive }}</span>
              <span class="dash-tab__badge dash-tab__badge--inactive">Inactive {{ dash.stats.value.promoInactive }}</span>
            </div>
          </div>
        </div>

        <div class="dash-tab__card">
          <div class="dash-tab__card-icon dash-tab__card-icon--budget">
            <span class="material-symbols-outlined">payments</span>
          </div>
          <div class="dash-tab__card-body">
            <div class="dash-tab__card-value">
              <template v-if="dash.stats.value.hasUnlimitedBudget">Unlimited</template>
              <template v-else>{{ fmtNum(dash.stats.value.activeBudget) }}</template>
            </div>
            <div class="dash-tab__card-label">Active Budget</div>
          </div>
        </div>
      </div>

      <!-- Charts Row -->
      <div class="dash-tab__charts">
        <!-- Bar: Merchants per BU -->
        <div class="dash-tab__chart-card">
          <h3 class="dash-tab__chart-title">Merchants per BU</h3>
          <div v-if="dash.merchantsPerBu.value.length" class="dash-tab__bars">
            <div v-for="m in sorted(dash.merchantsPerBu.value)" :key="m.bu_name" class="dash-tab__bar-row">
              <span class="dash-tab__bar-label">{{ m.bu_name }}</span>
              <div class="dash-tab__bar-track">
                <div class="dash-tab__bar-fill" :style="{ width: pct(m.count, maxMerchantCount) }"></div>
              </div>
              <span class="dash-tab__bar-val">{{ m.count }}</span>
            </div>
          </div>
          <div v-else class="dash-tab__empty">No data</div>
        </div>

        <!-- Bar: Promos per BU -->
        <div class="dash-tab__chart-card">
          <h3 class="dash-tab__chart-title">Promos per BU</h3>
          <div v-if="dash.promosPerBu.value.length" class="dash-tab__bars">
            <div v-for="p in sorted(dash.promosPerBu.value)" :key="p.bu_name" class="dash-tab__bar-row">
              <span class="dash-tab__bar-label">{{ p.bu_name }}</span>
              <div class="dash-tab__bar-track">
                <div class="dash-tab__bar-fill dash-tab__bar-fill--pr" :style="{ width: pct(p.count, maxPromoCount) }"></div>
              </div>
              <span class="dash-tab__bar-val">{{ p.count }}</span>
            </div>
          </div>
          <div v-else class="dash-tab__empty">No data</div>
        </div>

        <!-- Donut: Discount Types -->
        <div class="dash-tab__chart-card">
          <h3 class="dash-tab__chart-title">Discount Types</h3>
          <div class="dash-tab__donut-wrap">
            <div class="dash-tab__donut" :style="donutStyle"></div>
            <div class="dash-tab__legend">
              <div class="dash-tab__legend-item"><span class="dash-tab__legend-dot" style="background:#6366F1"></span> PRM % ({{ dash.discountTypes.value.prmPct }})</div>
              <div class="dash-tab__legend-item"><span class="dash-tab__legend-dot" style="background:#8B5CF6"></span> PRM Fixed ({{ dash.discountTypes.value.prmFixed }})</div>
              <div class="dash-tab__legend-item"><span class="dash-tab__legend-dot" style="background:#F59E0B"></span> PL % ({{ dash.discountTypes.value.plPct }})</div>
              <div class="dash-tab__legend-item"><span class="dash-tab__legend-dot" style="background:#EF4444"></span> PL Fixed ({{ dash.discountTypes.value.plFixed }})</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Recent Activity -->
      <div class="dash-tab__recent">
        <div class="dash-tab__recent-card">
          <h3 class="dash-tab__chart-title">Recent Promos</h3>
          <table v-if="dash.recentPromos.value.length" class="dash-tab__mini-table">
            <thead><tr><th>Promo ID</th><th>Name</th><th>Period</th><th>Status</th></tr></thead>
            <tbody>
              <tr v-for="p in dash.recentPromos.value" :key="p.promo_id">
                <td class="dash-tab__code">{{ p.promo_id }}</td>
                <td>{{ p.promo_name }}</td>
                <td class="dash-tab__date">{{ p.start_date }} – {{ p.end_date }}</td>
                <td><span class="dash-tab__status" :class="'dash-tab__status--' + (p.status || '').toLowerCase()">{{ p.status }}</span></td>
              </tr>
            </tbody>
          </table>
          <div v-else class="dash-tab__empty">No promos yet</div>
        </div>

        <div class="dash-tab__recent-card">
          <h3 class="dash-tab__chart-title">Recent Merchants</h3>
          <table v-if="dash.recentMerchants.value.length" class="dash-tab__mini-table">
            <thead><tr><th>ID</th><th>Name</th><th>BU</th><th>Added</th></tr></thead>
            <tbody>
              <tr v-for="m in dash.recentMerchants.value" :key="m.merchant_id">
                <td class="dash-tab__code">{{ m.merchant_id }}</td>
                <td>{{ m.merchant_name }}</td>
                <td>{{ m.bu_name }}</td>
                <td class="dash-tab__date">{{ fmtDate(m.created_at) }}</td>
              </tr>
            </tbody>
          </table>
          <div v-else class="dash-tab__empty">No merchants yet</div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed, onMounted } from 'vue'
import { useQrddDashboard } from '../composables/useQrddDashboard.js'

const dash = useQrddDashboard()

const maxMerchantCount = computed(() =>
  Math.max(1, ...dash.merchantsPerBu.value.map(m => m.count))
)
const maxPromoCount = computed(() =>
  Math.max(1, ...dash.promosPerBu.value.map(p => p.count))
)

const donutStyle = computed(() => {
  const dt = dash.discountTypes.value
  const total = dt.prmPct + dt.prmFixed + dt.plPct + dt.plFixed || 1
  const p1 = (dt.prmPct / total) * 100
  const p2 = (dt.prmFixed / total) * 100
  const p3 = (dt.plPct / total) * 100
  const p4 = (dt.plFixed / total) * 100
  return {
    background: `conic-gradient(#6366F1 0% ${p1}%, #8B5CF6 ${p1}% ${p1 + p2}%, #F59E0B ${p1 + p2}% ${p1 + p2 + p3}%, #EF4444 ${p1 + p2 + p3}% 100%)`,
  }
})

function sorted(arr) { return [...arr].sort((a, b) => b.count - a.count) }
function pct(v, max) { return (v / max * 100) + '%' }
function fmtNum(v) { return Number(v).toLocaleString() }
function fmtDate(d) { return d ? new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '—' }

onMounted(() => dash.loadAll())
</script>

<style scoped>
.dash-tab { display: flex; flex-direction: column; gap: 20px; animation: dash-in 0.4s ease-out both; }
@keyframes dash-in { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }

.dash-tab__toolbar { display: flex; justify-content: flex-end; }
.dash-tab__export-btn {
  display: flex; align-items: center; gap: 6px;
  padding: 8px 16px;
  background: transparent; color: var(--color-gray-600, #666);
  border: 1px solid rgba(0,0,0,0.1); border-radius: var(--radius-pill, 999px);
  font-weight: 600; font-size: 13px; font-family: var(--font-body, 'Inter', sans-serif);
  cursor: pointer; transition: all 200ms;
}
.dash-tab__export-btn:hover { background: rgba(0,0,0,0.04); border-color: rgba(0,0,0,0.2); }
.dash-tab__export-btn .material-symbols-outlined { font-size: 18px; }

.dash-tab__loading { display: flex; align-items: center; gap: 8px; justify-content: center; padding: 48px; color: var(--color-gray-400); font-size: 14px; }
.dash-tab__spinner { animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

/* Cards */
.dash-tab__cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; }
.dash-tab__card {
  display: flex; gap: 14px; padding: 20px;
  background: rgba(255,255,255,0.7); backdrop-filter: blur(8px);
  border: 1px solid rgba(0,0,0,0.06); border-radius: var(--radius-md, 16px);
  box-shadow: var(--shadow-sm, 0 2px 8px rgba(0,0,0,0.04));
}
.dash-tab__card-icon {
  width: 44px; height: 44px; display: flex; align-items: center; justify-content: center;
  border-radius: var(--radius-sm, 12px); flex-shrink: 0;
}
.dash-tab__card-icon .material-symbols-outlined { font-size: 22px; color: #fff; }
.dash-tab__card-icon--bu { background: linear-gradient(135deg, #6366F1, #8B5CF6); }
.dash-tab__card-icon--mw { background: linear-gradient(135deg, #10B981, #34D399); }
.dash-tab__card-icon--pr { background: linear-gradient(135deg, #F59E0B, #FBBF24); }
.dash-tab__card-icon--budget { background: linear-gradient(135deg, #EF4444, #F87171); }
.dash-tab__card-body { display: flex; flex-direction: column; gap: 2px; }
.dash-tab__card-value { font-size: 24px; font-weight: 800; color: var(--color-on-surface, #333); letter-spacing: -0.5px; }
.dash-tab__card-label { font-size: 12px; color: var(--color-gray-400); font-weight: 600; text-transform: uppercase; }
.dash-tab__card-badges { display: flex; gap: 6px; margin-top: 4px; }
.dash-tab__badge { font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 999px; }
.dash-tab__badge--prime { background: #E6E6FF; color: #0047B2; }
.dash-tab__badge--paylater { background: #FFF3D6; color: #CC7000; }
.dash-tab__badge--active { background: #E6F4EA; color: #137333; }
.dash-tab__badge--inactive { background: #F1F3F4; color: #5F6368; }

/* Charts */
.dash-tab__charts { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; }
.dash-tab__chart-card {
  padding: 16px;
  background: rgba(255,255,255,0.7); backdrop-filter: blur(8px);
  border: 1px solid rgba(0,0,0,0.06); border-radius: var(--radius-md, 16px);
}
.dash-tab__chart-title { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: var(--color-gray-400); margin: 0 0 12px; }
.dash-tab__bars { display: flex; flex-direction: column; gap: 8px; }
.dash-tab__bar-row { display: flex; align-items: center; gap: 8px; }
.dash-tab__bar-label { width: 80px; font-size: 11px; font-weight: 600; color: var(--color-gray-600); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex-shrink: 0; }
.dash-tab__bar-track { flex: 1; height: 8px; background: rgba(0,0,0,0.06); border-radius: 4px; overflow: hidden; }
.dash-tab__bar-fill { height: 100%; background: #6366F1; border-radius: 4px; transition: width 0.6s ease-out; }
.dash-tab__bar-fill--pr { background: #F59E0B; }
.dash-tab__bar-val { width: 32px; text-align: right; font-size: 11px; font-weight: 700; color: var(--color-gray-700); }
.dash-tab__empty { color: var(--color-gray-400); font-size: 12px; text-align: center; padding: 24px; }

/* Donut */
.dash-tab__donut-wrap { display: flex; align-items: center; gap: 16px; justify-content: center; flex-wrap: wrap; }
.dash-tab__donut { width: 80px; height: 80px; border-radius: 50%; position: relative; }
.dash-tab__donut::after {
  content: ''; position: absolute; inset: 16px; border-radius: 50%; background: #fff;
}
.dash-tab__legend { font-size: 10px; display: flex; flex-direction: column; gap: 4px; }
.dash-tab__legend-item { display: flex; align-items: center; gap: 6px; color: var(--color-gray-600); font-weight: 600; }
.dash-tab__legend-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }

/* Recent */
.dash-tab__recent { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.dash-tab__recent-card {
  padding: 16px;
  background: rgba(255,255,255,0.7); backdrop-filter: blur(8px);
  border: 1px solid rgba(0,0,0,0.06); border-radius: var(--radius-md, 16px);
}
.dash-tab__mini-table { width: 100%; border-collapse: collapse; font-size: 12px; }
.dash-tab__mini-table th { text-align: left; font-size: 10px; font-weight: 700; text-transform: uppercase; color: var(--color-gray-400); padding: 4px 6px; border-bottom: 1px solid rgba(0,0,0,0.06); }
.dash-tab__mini-table td { padding: 4px 6px; color: var(--color-gray-700); }
.dash-tab__code { font-family: 'SF Mono','Fira Code',monospace; font-size: 11px; color: var(--color-gray-600); }
.dash-tab__date { font-size: 11px; color: var(--color-gray-400); }
.dash-tab__status { display: inline-block; padding: 1px 6px; border-radius: 999px; font-size: 10px; font-weight: 700; }
.dash-tab__status--active { background: #E6F4EA; color: #137333; }
.dash-tab__status--inactive { background: #F1F3F4; color: #5F6368; }

@media (max-width: 768px) {
  .dash-tab__charts { grid-template-columns: 1fr; }
  .dash-tab__recent { grid-template-columns: 1fr; }
  .dash-tab__cards { grid-template-columns: 1fr 1fr; }
}
@media (max-width: 480px) {
  .dash-tab__cards { grid-template-columns: 1fr; }
}
</style>
