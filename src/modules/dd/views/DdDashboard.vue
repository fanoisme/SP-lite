<template>
  <section class="ddash">
    <header class="ddash__head">
      <div>
        <h1 class="ddash__title">Dashboard</h1>
        <p class="ddash__sub">{{ subtitle }}</p>
      </div>
      <button
        class="ddash__refresh" :class="{ 'ddash__refresh--busy': loading }"
        type="button" :disabled="loading" @click="load"
      >
        <LiIcon name="refresh" />
        {{ loading ? 'Refreshing…' : 'Refresh' }}
      </button>
    </header>

    <LiBanner
      v-if="error" :model-value="true" variant="warning"
      title="Partly loaded" :message="error"
    />

    <!-- ══ Headline counts ══════════════════════════════════════════════ -->
    <div v-if="show.counts" class="ddash__kpis">
      <template v-if="loading && !counts.length">
        <LiSkeletonCard v-for="i in 3" :key="i" :has-header="false" :lines="2" />
      </template>
      <template v-else>
        <component
          v-for="c in counts" :key="c.id"
          :is="linkTag(c.to)" v-bind="linkProps(c.to)" class="ddash__kpi"
        >
          <LiIcon :name="c.icon" class="ddash__kpiico" />
          <span class="ddash__kpivalue">
            <template v-if="c.count != null">{{ formatNumber(c.count) }}</template>
            <span v-else class="ddash__muted">{{ EM_DASH }}</span>
          </span>
          <span class="ddash__kpilabel">{{ c.label }}</span>
          <span class="ddash__kpimeta">{{ c.targetDb }}.{{ c.targetTable }}</span>
        </component>
      </template>
    </div>
    <p v-if="errors.counts" class="ddash__cardError">{{ errors.counts }}</p>

    <LiEmptyState
      v-if="!show.counts && !loading"
      icon="lock" title="Nothing granted yet" size="md"
      description="Your role does not include any DD table. Ask an administrator for access."
    />

    <div class="ddash__sections">
      <!-- ══ Expiring soon ══════════════════════════════════════════════ -->
      <article v-if="show.expiring" class="ddash__card ddash__card--wide">
        <header class="ddash__cardhead">
          <div class="ddash__cardid">
            <LiIcon name="hourglass_bottom" class="ddash__cardico" />
            <div>
              <h2 class="ddash__cardtitle">Expiring soon</h2>
              <p class="ddash__cardsub">Promos ending in the next {{ EXPIRY_WINDOW_DAYS }} days</p>
            </div>
          </div>
          <LiBadge
            :label="String(expiringTotal)"
            :variant="expiringTotal ? 'warning' : 'neutral'" size="sm" is-pill
          />
        </header>

        <p v-if="errors.expiring" class="ddash__cardError">{{ errors.expiring }}</p>
        <div v-else-if="loading" class="ddash__skels">
          <LiSkeleton v-for="i in 4" :key="i" height="30px" />
        </div>
        <ul v-else-if="expiring.length" class="ddash__list">
          <li v-for="p in shown(expiring, 'expiring', 8)" :key="p.key">
            <component :is="linkTag(p.to)" v-bind="linkProps(p.to)" class="ddash__row">
              <span class="ddash__dot" :class="dotClass(p.days)" />
              <span class="ddash__rowmain">
                <span class="ddash__rowtitle">{{ p.name }}</span>
                <span class="ddash__rowmeta">
                  {{ p.bu || EM_DASH }} · ends {{ formatDate(p.date) }}
                </span>
              </span>
              <LiBadge
                v-if="p.status && p.status !== 'ACTIVE'"
                :label="p.status" variant="neutral" size="sm" is-pill
              />
              <LiBadge :label="dayLabel(p.days)" :variant="dayVariant(p.days)" size="sm" is-pill />
            </component>
          </li>
        </ul>
        <LiEmptyState
          v-else icon="event_available" size="sm" title="All clear"
          :description="`Nothing expiring in the next ${EXPIRY_WINDOW_DAYS} days.`"
        />
        <button
          v-if="!loading && expiring.length > 8" class="ddash__more"
          type="button" @click="toggle('expiring')"
        >
          {{ expanded.expiring ? 'Show fewer' : `Show all ${expiring.length}` }}
        </button>
      </article>

      <!-- ══ Needs attention ════════════════════════════════════════════ -->
      <article v-if="show.attention" class="ddash__card">
        <header class="ddash__cardhead">
          <div class="ddash__cardid">
            <LiIcon name="report" class="ddash__cardico" />
            <div>
              <h2 class="ddash__cardtitle">Needs attention</h2>
              <p class="ddash__cardsub">Rows that are wrong, not merely aging</p>
            </div>
          </div>
          <LiBadge
            :label="String(attention.length)"
            :variant="attention.length ? 'error' : 'neutral'" size="sm" is-pill
          />
        </header>

        <p v-if="errors.attention" class="ddash__cardError">{{ errors.attention }}</p>
        <div v-else-if="loading" class="ddash__skels">
          <LiSkeleton v-for="i in 4" :key="i" height="30px" />
        </div>
        <ul v-else-if="attention.length" class="ddash__list">
          <li v-for="a in shown(attention, 'attention', 6)" :key="a.key">
            <component :is="linkTag(a.to)" v-bind="linkProps(a.to)" class="ddash__row">
              <span class="ddash__dot ddash__dot--bad" />
              <span class="ddash__rowmain">
                <span class="ddash__rowtitle">{{ a.title }}</span>
                <span class="ddash__rowmeta">{{ a.reason }}</span>
              </span>
            </component>
          </li>
        </ul>
        <LiEmptyState
          v-else icon="verified" size="sm" title="Everything checks out"
          description="No inconsistent rows found across the tables you can read."
        />
        <button
          v-if="!loading && attention.length > 6" class="ddash__more"
          type="button" @click="toggle('attention')"
        >
          {{ expanded.attention ? 'Show fewer' : `Show all ${attention.length}` }}
        </button>
      </article>

      <!-- ══ Starting soon ══════════════════════════════════════════════ -->
      <article v-if="show.starting" class="ddash__card">
        <header class="ddash__cardhead">
          <div class="ddash__cardid">
            <LiIcon name="schedule" class="ddash__cardico" />
            <div>
              <h2 class="ddash__cardtitle">Starting soon</h2>
              <p class="ddash__cardsub">Promos going live in the next {{ STARTING_WINDOW_DAYS }} days</p>
            </div>
          </div>
          <LiBadge
            :label="String(startingTotal)"
            :variant="startingTotal ? 'info' : 'neutral'" size="sm" is-pill
          />
        </header>

        <p v-if="errors.starting" class="ddash__cardError">{{ errors.starting }}</p>
        <div v-else-if="loading" class="ddash__skels">
          <LiSkeleton v-for="i in 4" :key="i" height="30px" />
        </div>
        <ul v-else-if="starting.length" class="ddash__list">
          <li v-for="p in shown(starting, 'starting', 6)" :key="p.key">
            <component :is="linkTag(p.to)" v-bind="linkProps(p.to)" class="ddash__row">
              <span class="ddash__dot ddash__dot--info" />
              <span class="ddash__rowmain">
                <span class="ddash__rowtitle">{{ p.name }}</span>
                <span class="ddash__rowmeta">
                  {{ p.bu || EM_DASH }} · starts {{ formatDate(p.date) }}
                </span>
              </span>
              <LiBadge :label="dayLabel(p.days)" variant="info" size="sm" is-pill />
            </component>
          </li>
        </ul>
        <LiEmptyState
          v-else icon="event_upcoming" size="sm" title="Nothing scheduled"
          :description="`No promo starts in the next ${STARTING_WINDOW_DAYS} days.`"
        />
        <button
          v-if="!loading && starting.length > 6" class="ddash__more"
          type="button" @click="toggle('starting')"
        >
          {{ expanded.starting ? 'Show fewer' : `Show all ${starting.length}` }}
        </button>
      </article>

      <!-- ══ BU coverage ════════════════════════════════════════════════ -->
      <article v-if="show.coverage" class="ddash__card">
        <header class="ddash__cardhead">
          <div class="ddash__cardid">
            <LiIcon name="account_tree" class="ddash__cardico" />
            <div>
              <h2 class="ddash__cardtitle">BU coverage</h2>
              <p class="ddash__cardsub">What points at each business unit — emptiest first</p>
            </div>
          </div>
        </header>

        <p v-if="errors.coverage" class="ddash__cardError">{{ errors.coverage }}</p>
        <div v-else-if="loading" class="ddash__skels">
          <LiSkeleton v-for="i in 5" :key="i" height="26px" />
        </div>
        <ul v-else-if="coverage.length" class="ddash__list">
          <li v-for="c in shown(coverage, 'coverage', 8)" :key="c.bu" class="ddash__cov">
            <span class="ddash__covname">{{ c.bu }}</span>
            <span class="ddash__covbar">
              <span class="ddash__covfill" :style="{ width: `${c.share}%` }" />
            </span>
            <span class="ddash__covnums">
              {{ c.merchants ?? EM_DASH }} merch · {{ c.promos ?? EM_DASH }} promo
            </span>
            <LiBadge v-if="c.empty" label="unused" variant="warning" size="sm" is-pill />
          </li>
        </ul>
        <LiEmptyState
          v-else icon="account_balance" size="sm" title="No business units"
          description="Nothing to cover until a BU account exists."
        />
        <button
          v-if="!loading && coverage.length > 8" class="ddash__more"
          type="button" @click="toggle('coverage')"
        >
          {{ expanded.coverage ? 'Show fewer' : `Show all ${coverage.length}` }}
        </button>
      </article>

      <!-- ══ Recent changes ═════════════════════════════════════════════ -->
      <article v-if="show.recent" class="ddash__card">
        <header class="ddash__cardhead">
          <div class="ddash__cardid">
            <LiIcon name="history" class="ddash__cardico" />
            <div>
              <h2 class="ddash__cardtitle">Recent changes</h2>
              <p class="ddash__cardsub">The last {{ RECENT_LIMIT }} entries you can see</p>
            </div>
          </div>
          <RouterLink v-if="canMenu('audit')" :to="{ name: 'dd-audit' }" class="ddash__cardlink">
            Full log
          </RouterLink>
        </header>

        <p v-if="errors.recent" class="ddash__cardError">{{ errors.recent }}</p>
        <div v-else-if="loading" class="ddash__skels">
          <LiSkeleton v-for="i in 5" :key="i" height="26px" />
        </div>
        <ul v-else-if="recent.length" class="ddash__list">
          <li v-for="r in recent" :key="r.audit_id">
            <component :is="linkTag(r.to)" v-bind="linkProps(r.to)" class="ddash__row">
              <span class="ddash__rowmain">
                <span class="ddash__rowtitle">{{ r.actor || 'SYSTEM' }}</span>
                <span class="ddash__rowmeta">
                  {{ r.tableLabel }} · <code class="ddash__key">{{ r.record_key }}</code>
                </span>
              </span>
              <span class="ddash__when">{{ formatRelative(r.ts) }}</span>
              <LiBadge :label="r.action" :variant="actionVariant(r.action)" size="sm" is-pill />
            </component>
          </li>
        </ul>
        <LiEmptyState
          v-else icon="history_toggle_off" size="sm" title="No changes recorded"
          description="Nothing has been written to these tables yet."
        />
      </article>
    </div>
  </section>
</template>

<script setup>
import { computed, reactive, onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import LiBadge from '@lib/components/LiBadge.vue'
import LiBanner from '@lib/components/LiBanner.vue'
import LiEmptyState from '@lib/components/LiEmptyState.vue'
import LiSkeleton from '@lib/components/LiSkeleton.vue'
import LiSkeletonCard from '@lib/components/LiSkeletonCard.vue'
import { formatDate, formatNumber, formatRelative, EM_DASH } from '../lib/format.js'
import { useDdAccess } from '../composables/useDdAccess.js'
import { useDdDashboard } from '../composables/useDdDashboard.js'

const { canMenu } = useDdAccess()
const {
  loading, error, errors, load,
  counts, expiring, expiringTotal, attention, starting, startingTotal, coverage, recent,
  show, visibleTables,
  EXPIRY_WINDOW_DAYS, STARTING_WINDOW_DAYS, RECENT_LIMIT,
} = useDdDashboard()

const subtitle = computed(() => {
  const tables = visibleTables.value.length
  if (!tables) return 'No discount tables are granted to your role.'
  const dbs = new Set(visibleTables.value.map(t => t.targetDb)).size
  return `${tables} table${tables === 1 ? '' : 's'} across ${dbs} database${dbs === 1 ? '' : 's'}.`
})

// Long lists are truncated in place rather than paged: the point of the panel
// is the first few rows, and expanding must not cost another round trip.
const expanded = reactive({ expiring: false, attention: false, starting: false, coverage: false })
const shown = (list, key, n) => (expanded[key] ? list : list.slice(0, n))
const toggle = (key) => { expanded[key] = !expanded[key] }

// A row links to a manage screen only where access allows one; the composable
// resolves that and hands back null, which renders as a plain, inert row.
const linkTag = to => (to ? RouterLink : 'div')
const linkProps = to => (to ? { to } : {})

const dayLabel = (d) => {
  if (d == null) return EM_DASH
  if (d === 0) return 'today'
  if (d === 1) return 'tomorrow'
  return `in ${d} days`
}

// Inside a week is the point at which an expiry stops being a note and starts
// being a task — the badge and the dot shift together so either one reads.
const dayVariant = d => (d != null && d <= 7 ? 'error' : 'warning')
const dotClass = d => (d != null && d <= 7 ? 'ddash__dot--bad' : 'ddash__dot--warn')

function actionVariant(action) {
  if (action === 'INSERT') return 'success'
  if (action === 'UPDATE') return 'warning'
  if (action === 'DELETE') return 'error'
  return 'neutral'
}

onMounted(load)
</script>

<style scoped>
.ddash { display: flex; flex-direction: column; gap: var(--space-lg, 24px); }

.ddash__head { display: flex; align-items: flex-end; justify-content: space-between; gap: 12px; }
.ddash__title { font-size: 24px; font-weight: 800; margin: 0; letter-spacing: -0.4px; }
.ddash__sub { font-size: 14px; color: var(--color-gray-500, #8e8ea0); margin: 2px 0 0; }
.ddash__muted { color: var(--color-gray-400, #aaa); font-weight: 400; }

.ddash__refresh {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 8px 16px; border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: var(--radius-pill, 999px); background: transparent;
  font-family: var(--font-body, 'Inter', sans-serif);
  font-size: 13px; font-weight: 600; color: var(--color-gray-700, #666);
  cursor: pointer; transition: all 200ms; white-space: nowrap;
}
.ddash__refresh:hover:not(:disabled) { background: rgba(0, 0, 0, 0.04); }
.ddash__refresh:disabled { opacity: 0.6; cursor: progress; }
.ddash__refresh .li-icon { font-size: 17px; }
.ddash__refresh--busy .li-icon { animation: ddash-spin 700ms linear infinite; }
@keyframes ddash-spin { to { transform: rotate(360deg); } }

/* ── Headline counts ───────────────────────────────────────────────────── */
.ddash__kpis {
  display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
  gap: var(--space-md, 16px);
}
.ddash__kpi {
  position: relative; display: flex; flex-direction: column;
  padding: 18px 20px; border-radius: var(--radius-md, 16px);
  background: rgba(255, 255, 255, 0.6);
  border: 1px solid rgba(0, 0, 0, 0.06);
  text-decoration: none; color: inherit;
  transition: transform 200ms, border-color 200ms, box-shadow 200ms;
}
/* Only a card that goes somewhere lifts — an inert card must not invite a click. */
a.ddash__kpi:hover {
  transform: translateY(-2px); border-color: rgba(99, 102, 241, 0.35);
  box-shadow: 0 6px 18px rgba(99, 102, 241, 0.12);
}
.ddash__kpiico {
  position: absolute; top: 16px; right: 16px;
  font-size: 20px; color: #6366F1; opacity: 0.5;
}
.ddash__kpivalue {
  font-size: 30px; font-weight: 800; line-height: 1.1; margin-top: 2px;
  font-variant-numeric: tabular-nums; letter-spacing: -1px;
}
.ddash__kpilabel { font-size: 13px; font-weight: 600; color: var(--color-gray-700, #666); margin-top: 4px; }
.ddash__kpimeta {
  font-family: var(--font-mono, ui-monospace, monospace);
  font-size: 11px; color: var(--color-gray-400, #aaa); margin-top: 2px;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}

/* ── Section cards ─────────────────────────────────────────────────────── */
/*
 * Two columns so the four short panels pair up, with the expiring list — the
 * only section anyone acts on today — spanning both.
 */
.ddash__sections {
  display: grid; grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-md, 16px); align-items: start;
}
.ddash__card {
  display: flex; flex-direction: column; gap: 12px; min-width: 0;
  padding: 18px 20px; border-radius: var(--radius-md, 16px);
  background: rgba(255, 255, 255, 0.6);
  border: 1px solid rgba(0, 0, 0, 0.06);
}
.ddash__card--wide { grid-column: 1 / -1; }

.ddash__cardhead { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
.ddash__cardid { display: flex; align-items: flex-start; gap: 10px; min-width: 0; }
.ddash__cardico {
  font-size: 18px; color: #6366F1; flex-shrink: 0;
  background: rgba(99, 102, 241, 0.1);
  border-radius: var(--radius-sm, 10px); padding: 6px;
}
.ddash__cardtitle { font-size: 15px; font-weight: 700; margin: 0; letter-spacing: -0.2px; }
.ddash__cardsub { font-size: 12px; color: var(--color-gray-500, #8e8ea0); margin: 2px 0 0; }
.ddash__cardlink {
  font-size: 12px; font-weight: 600; color: #6366F1;
  text-decoration: none; white-space: nowrap; flex-shrink: 0;
}
.ddash__cardlink:hover { text-decoration: underline; }
.ddash__cardError {
  font-size: 13px; color: var(--color-red-400, #C83E3B);
  background: rgba(200, 62, 59, 0.08);
  border-radius: var(--radius-sm, 12px); padding: 10px 14px; margin: 0;
}
.ddash__skels { display: flex; flex-direction: column; gap: 8px; }

/* ── List rows ─────────────────────────────────────────────────────────── */
.ddash__list { list-style: none; margin: 0; padding: 0; }
.ddash__list > li + li { border-top: 1px solid rgba(0, 0, 0, 0.05); }
.ddash__row {
  display: flex; align-items: center; gap: 10px;
  padding: 9px 8px; margin: 0 -8px;
  border-radius: var(--radius-sm, 10px);
  text-decoration: none; color: inherit;
  transition: background 160ms;
}
a.ddash__row:hover { background: rgba(99, 102, 241, 0.06); }
.ddash__rowmain { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.ddash__rowtitle {
  font-size: 13.5px; font-weight: 600;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.ddash__rowmeta {
  font-size: 11.5px; color: var(--color-gray-500, #8e8ea0);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.ddash__key {
  font-family: var(--font-mono, ui-monospace, monospace); font-size: 11px;
  background: rgba(0, 0, 0, 0.04); border-radius: 5px; padding: 1px 5px;
}
.ddash__when {
  font-size: 11px; color: var(--color-gray-400, #aaa);
  white-space: nowrap; flex-shrink: 0;
}
.ddash__dot { width: 7px; height: 7px; flex-shrink: 0; border-radius: 50%; background: var(--color-gray-300, #ccc); }
.ddash__dot--warn { background: var(--color-orange-400, #FF6B00); }
.ddash__dot--bad { background: var(--color-red-400, #C83E3B); }
.ddash__dot--info { background: #6366F1; }

.ddash__more {
  align-self: flex-start; border: none; background: transparent; padding: 2px 0;
  font-family: var(--font-body, 'Inter', sans-serif);
  font-size: 12px; font-weight: 600; color: #6366F1; cursor: pointer;
}
.ddash__more:hover { text-decoration: underline; }

/* ── Coverage rows ─────────────────────────────────────────────────────── */
.ddash__cov { display: flex; align-items: center; gap: 10px; padding: 8px 0; }
.ddash__covname {
  flex: 0 1 120px; min-width: 0; font-size: 13px; font-weight: 600;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.ddash__covbar {
  flex: 1; min-width: 36px; height: 6px; overflow: hidden;
  border-radius: var(--radius-pill, 999px);
  background: var(--color-gray-200, #E6E6E6);
}
.ddash__covfill {
  display: block; height: 100%; border-radius: var(--radius-pill, 999px);
  background: linear-gradient(90deg, #6366F1, #8B5CF6);
  transition: width 500ms ease;
}
.ddash__covnums {
  font-variant-numeric: tabular-nums; font-size: 11px;
  color: var(--color-gray-500, #8e8ea0); white-space: nowrap;
}

@media (max-width: 1100px) {
  .ddash__sections { grid-template-columns: 1fr; }
}
@media (max-width: 560px) {
  .ddash__head { flex-direction: column; align-items: stretch; }
  .ddash__cov { flex-wrap: wrap; }
  .ddash__covbar { order: 3; flex-basis: 100%; }
}
</style>
