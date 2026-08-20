import { ref, computed } from 'vue'
import { supabase } from '@/lib/supabase.js'
import { DD_TABLES, tableLabel } from '../lib/schema.js'
import { daysUntil, formatDate, formatPercentage } from '../lib/format.js'
import { useDdAccess } from './useDdAccess.js'

/**
 * Everything /dd reads, in one place. The view renders; nothing here touches
 * the DOM and nothing there touches Supabase.
 *
 * Two rules shape the whole file:
 *
 *  1. Each section is independent. They are fired together and every one of
 *     them catches its own failure into `errors[key]`, so a broken "needs
 *     attention" query costs you that panel and not the dashboard. Sections do
 *     not share fetched rows for the same reason — a shared read would make one
 *     failure everyone's failure.
 *
 *  2. Each section is gated by canTable(..., 'read') *before* it is issued.
 *     Someone holding only db.ihybrid_order.read must not see a merchant or a
 *     promo, and must not cause a request that would have returned one. The
 *     gate is the point of DD's two-axis model, so it lives at the query, not
 *     at the template.
 */

const EXPIRY_WINDOW_DAYS = 30
const STARTING_WINDOW_DAYS = 14
const RECENT_LIMIT = 15

// Rows a dated list will hold. Both capped lists are ordered by the date that
// makes them urgent, so the cap drops the least urgent rows — and the exact
// total still comes back in the count header, so the badge never lies.
const LIST_CAP = 100

const MANAGE_ROUTE = {
  bu_accounts: 'dd-business-units',
  merchants: 'dd-merchants',
  promos: 'dd-promos',
}

// Same glyphs the sidebar uses for the same three things.
const CARD_ICON = {
  bu_accounts: 'account_balance',
  merchants: 'storefront',
  promos: 'sell',
}

// Order the attention list is built in: roughly what each fault costs if it
// ships. A wrong BU split misallocates money; the rest break a join or a rule.
const ATTENTION_ORDER = ['bu_split', 'promo_expired', 'promo_bu', 'promo_merchant', 'promo_dates']

/**
 * Today, plus or minus whole days, as a local calendar date.
 *
 * `date` columns are compared as strings, so this must be the reader's own
 * day — toISOString() would hand back the UTC day and shift every window by
 * one for anyone in WIB.
 */
function isoDay(offsetDays = 0) {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + offsetDays)
  const pad = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** Unwraps a PostgREST result, turning its error into a thrown one. */
async function q(builder) {
  const { data, error, count } = await builder
  if (error) throw error
  return { data: data || [], count: count ?? 0 }
}

export function useDdDashboard() {
  const { canTable, canMenu, canDatabase } = useDdAccess()

  const loading = ref(true)
  const errors = ref({})

  const counts = ref([])
  const expiring = ref([])
  const expiringTotal = ref(0)
  const attention = ref([])
  const starting = ref([])
  const startingTotal = ref(0)
  const coverage = ref([])
  const recent = ref([])

  // ── Visibility ───────────────────────────────────────────────────────────
  //
  // Recomputed rather than captured once: access is resolved from a reactive
  // profile, and a person whose role changes mid-session must not keep a panel
  // they no longer hold.

  const canBu = computed(() => canTable('bu_accounts', 'read'))
  const canMerchants = computed(() => canTable('merchants', 'read'))
  const canPromos = computed(() => canTable('promos', 'read'))

  const visibleTables = computed(() =>
    Object.values(DD_TABLES).filter(t => canTable(t.id, 'read')),
  )

  const show = computed(() => ({
    counts: visibleTables.value.length > 0,
    expiring: canPromos.value,
    starting: canPromos.value,
    // Every check needs at least one of these two tables; which checks actually
    // run is decided again inside the section.
    attention: canBu.value || canPromos.value,
    // Coverage is a list of BU names before it is anything else, so it needs
    // the BU table itself — deriving the names from promos would leak them.
    coverage: canBu.value && (canMerchants.value || canPromos.value),
    recent: visibleTables.value.length > 0,
  }))

  /**
   * Where a row should link.
   *
   * Read can be held through the database axis without the matching menu, and
   * the router guard enforces the menu on a manage route — so following a
   * manage link would bounce. The raw Table Explorer is offered instead, and
   * a row links nowhere when neither axis is granted.
   *
   * `q` rides along as a query param for the manage screens' search box. No
   * screen consumes it yet (see the note in the report); it is inert until one
   * does, and costs nothing meanwhile.
   */
  function routeFor(tableId, search) {
    const t = DD_TABLES[tableId]
    if (!t) return null
    if (canMenu(t.menu)) {
      const to = { name: MANAGE_ROUTE[tableId] }
      if (search) to.query = { q: String(search) }
      return to
    }
    if (canDatabase(t.targetDb)) return { name: 'dd-table', params: { name: t.targetTable } }
    return null
  }

  // ── Sections ─────────────────────────────────────────────────────────────

  /** Row counts, one per readable table. `head: true` returns no rows at all. */
  async function loadCounts() {
    const out = await Promise.all(visibleTables.value.map(async (t) => {
      const base = {
        id: t.id,
        label: t.label,
        icon: CARD_ICON[t.id],
        targetDb: t.targetDb,
        targetTable: t.targetTable,
        to: routeFor(t.id),
      }
      const { count, error: e } = await supabase
        .from(t.local)
        .select('*', { count: 'exact', head: true })
      // One failed count shows an em dash rather than costing the whole row of
      // cards, which is the only part of the dashboard that is always present.
      return { ...base, count: e ? null : (count ?? 0) }
    }))
    counts.value = out
    if (out.some(c => c.count === null)) throw new Error('Some row counts are unavailable')
  }

  /** Promos ending inside the window and not already past, soonest first. */
  async function loadExpiring() {
    const { data, count } = await q(
      supabase
        .from(DD_TABLES.promos.local)
        .select('promo_id,promo_name,bu_name,merchant_id,end_date,status', { count: 'exact' })
        .gte('end_date', isoDay(0))
        .lte('end_date', isoDay(EXPIRY_WINDOW_DAYS))
        .order('end_date', { ascending: true })
        .limit(LIST_CAP),
    )
    expiringTotal.value = count
    expiring.value = data.map(r => ({
      key: r.promo_id,
      name: r.promo_name || r.promo_id,
      bu: r.bu_name,
      merchantId: r.merchant_id,
      date: r.end_date,
      days: daysUntil(r.end_date),
      status: r.status,
      to: routeFor('promos', r.promo_id),
    }))
  }

  /** Promos due to go live inside the window. */
  async function loadStarting() {
    const { data, count } = await q(
      supabase
        .from(DD_TABLES.promos.local)
        .select('promo_id,promo_name,bu_name,start_date,status', { count: 'exact' })
        .gte('start_date', isoDay(0))
        .lte('start_date', isoDay(STARTING_WINDOW_DAYS))
        .order('start_date', { ascending: true })
        .limit(LIST_CAP),
    )
    startingTotal.value = count
    starting.value = data.map(r => ({
      key: r.promo_id,
      name: r.promo_name || r.promo_id,
      bu: r.bu_name,
      date: r.start_date,
      days: daysUntil(r.start_date),
      status: r.status,
      to: routeFor('promos', r.promo_id),
    }))
  }

  /**
   * Rows that are wrong rather than merely aging.
   *
   * Every check here is a comparison Postgres could make and PostgREST cannot
   * express: column against column (start_date > end_date), column against a
   * derived sum (percentage1 + percentage2), or an anti-join against another
   * table. So the narrowest possible column set is fetched and the predicate
   * runs here. Nothing is capped — a cap would hide a broken row, which is the
   * one thing this panel exists to not do.
   */
  async function loadAttention() {
    const wantBu = canBu.value
    const wantPromos = canPromos.value
    const wantMerchants = canMerchants.value

    const [bu, promos, inactiveMerchants] = await Promise.all([
      wantBu
        ? q(supabase.from(DD_TABLES.bu_accounts.local).select('name,sof,percentage1,percentage2'))
        : null,
      wantPromos
        ? q(supabase.from(DD_TABLES.promos.local)
            .select('promo_id,promo_name,bu_name,merchant_id,start_date,end_date,status'))
        : null,
      // Only the INACTIVE ones: an ACTIVE merchant is not evidence of anything.
      wantMerchants
        ? q(supabase.from(DD_TABLES.merchants.local)
            .select('merchant_id,merchant_name').eq('status', 'INACTIVE'))
        : null,
    ])

    const found = []

    if (bu) {
      bu.data.forEach((r) => {
        // Compared in ten-thousandths, the precision the column is declared at:
        // 0.7 + 0.3 is not 1 in binary floating point and would report a fault
        // that does not exist.
        const total = Math.round((Number(r.percentage1 || 0) + Number(r.percentage2 || 0)) * 10000)
        if (total === 10000) return
        found.push({
          kind: 'bu_split',
          key: `bu_split-${r.name}-${r.sof}`,
          table: 'bu_accounts',
          title: `${r.name} · ${r.sof}`,
          reason: `Split totals ${formatPercentage(total / 10000)} — the two percentages must add up to 100%`,
          to: routeFor('bu_accounts', r.name),
        })
      })
    }

    if (promos) {
      // DD's own first alert, kept: a promo past its end date no longer applies
      // downstream but still reads as live to everyone looking at the table.
      promos.data.forEach((r) => {
        if (r.status !== 'ACTIVE') return
        const d = daysUntil(r.end_date)
        if (d == null || d >= 0) return
        found.push({
          kind: 'promo_expired',
          key: `promo_expired-${r.promo_id}`,
          table: 'promos',
          title: r.promo_name || r.promo_id,
          reason: `Still ACTIVE but ended ${Math.abs(d)} day${Math.abs(d) === 1 ? '' : 's'} ago`,
          to: routeFor('promos', r.promo_id),
        })
      })
    }

    if (promos && bu) {
      const buNames = new Set(bu.data.map(r => r.name))
      promos.data.forEach((r) => {
        if (!r.bu_name || buNames.has(r.bu_name)) return
        found.push({
          kind: 'promo_bu',
          key: `promo_bu-${r.promo_id}`,
          table: 'promos',
          title: r.promo_name || r.promo_id,
          reason: `Business unit "${r.bu_name}" has no BU account row`,
          to: routeFor('promos', r.promo_id),
        })
      })
    }

    if (promos && inactiveMerchants) {
      const dead = new Map(inactiveMerchants.data.map(m => [String(m.merchant_id), m.merchant_name]))
      promos.data.forEach((r) => {
        // A blank merchant_id means "every merchant" and is not a reference.
        if (r.merchant_id == null || r.merchant_id === '') return
        const name = dead.get(String(r.merchant_id))
        if (name === undefined) return
        found.push({
          kind: 'promo_merchant',
          key: `promo_merchant-${r.promo_id}`,
          table: 'promos',
          title: r.promo_name || r.promo_id,
          reason: `Merchant ${r.merchant_id}${name ? ` (${name})` : ''} is INACTIVE in the whitelist`,
          to: routeFor('promos', r.promo_id),
        })
      })
    }

    if (promos) {
      promos.data.forEach((r) => {
        if (!r.start_date || !r.end_date) return
        // `date` comes back as YYYY-MM-DD, so a string compare is a date
        // compare — and avoids two Date allocations per promo.
        if (String(r.start_date) <= String(r.end_date)) return
        found.push({
          kind: 'promo_dates',
          key: `promo_dates-${r.promo_id}`,
          table: 'promos',
          title: r.promo_name || r.promo_id,
          reason: `Starts ${formatDate(r.start_date)}, after it ends on ${formatDate(r.end_date)}`,
          to: routeFor('promos', r.promo_id),
        })
      })
    }

    found.sort((a, b) => ATTENTION_ORDER.indexOf(a.kind) - ATTENTION_ORDER.indexOf(b.kind))
    attention.value = found
  }

  /**
   * Per BU: what points at it. A BU with nothing pointing at it is usually a
   * name that was typed differently somewhere else, so the emptiest sort first.
   *
   * BU rows are keyed on name AND sof downstream, so one name can legitimately
   * hold two rows; the names are deduped here because merchants and promos
   * reference the name alone.
   */
  async function loadCoverage() {
    const [bu, merchants, promos] = await Promise.all([
      q(supabase.from(DD_TABLES.bu_accounts.local).select('name')),
      canMerchants.value ? q(supabase.from(DD_TABLES.merchants.local).select('bu_name')) : null,
      canPromos.value ? q(supabase.from(DD_TABLES.promos.local).select('bu_name')) : null,
    ])

    const tally = (rows) => {
      const map = new Map()
      rows.forEach(r => map.set(r.bu_name, (map.get(r.bu_name) || 0) + 1))
      return map
    }
    const mCount = merchants ? tally(merchants.data) : null
    const pCount = promos ? tally(promos.data) : null

    // null, not 0: an unreadable table is unknown, and rendering it as a zero
    // would flag a healthy BU as empty.
    const rows = [...new Set(bu.data.map(r => r.name))].map(name => ({
      bu: name,
      merchants: mCount ? (mCount.get(name) || 0) : null,
      promos: pCount ? (pCount.get(name) || 0) : null,
    }))

    const totalOf = r => (r.merchants ?? 0) + (r.promos ?? 0)
    const max = Math.max(1, ...rows.map(totalOf))
    coverage.value = rows
      .map(r => ({
        ...r,
        share: Math.round((totalOf(r) / max) * 100),
        // Only a number that is actually known can be called empty.
        empty: r.merchants === 0 || r.promos === 0,
      }))
      .sort((a, b) => totalOf(a) - totalOf(b) || String(a.bu).localeCompare(String(b.bu)))
  }

  /** The tail of the audit log, restricted to tables this person may read. */
  async function loadRecent() {
    const ids = visibleTables.value.map(t => t.id)
    const { data } = await q(
      supabase
        .from('dd_audit_log')
        .select('audit_id,ts,actor,action,table_id,record_key')
        .in('table_id', ids)
        // audit_id, not ts: rows written by one statement share a timestamp to
        // the microsecond and only the identity column orders them stably.
        .order('audit_id', { ascending: false })
        .limit(RECENT_LIMIT),
    )
    recent.value = data.map(r => ({
      ...r,
      tableLabel: tableLabel(r.table_id),
      to: routeFor(r.table_id, r.record_key),
    }))
  }

  // ── Orchestration ────────────────────────────────────────────────────────

  // One run at a time. Six sections answer independently, so a second Refresh
  // started mid-flight would interleave two sets of responses and leave the
  // panels describing two different moments.
  let inFlight = false

  async function run(key, enabled, fn) {
    if (!enabled) return
    try {
      await fn()
    } catch (e) {
      errors.value = { ...errors.value, [key]: e.message || String(e) }
    }
  }

  async function load() {
    if (inFlight) return
    inFlight = true
    loading.value = true
    errors.value = {}
    const visible = show.value
    try {
      await Promise.all([
        run('counts', visible.counts, loadCounts),
        run('expiring', visible.expiring, loadExpiring),
        run('attention', visible.attention, loadAttention),
        run('starting', visible.starting, loadStarting),
        run('coverage', visible.coverage, loadCoverage),
        run('recent', visible.recent, loadRecent),
      ])
    } finally {
      inFlight = false
      loading.value = false
    }
  }

  const failedSections = computed(() => Object.keys(errors.value).length)

  // The header line. Individual panels state their own problem in place; this
  // exists so a failure below the fold is still visible from the top.
  const error = computed(() => {
    const n = failedSections.value
    if (!n) return null
    return n === 1
      ? 'One section could not be loaded — see the panel below.'
      : `${n} sections could not be loaded — see the panels below.`
  })

  return {
    loading, error, errors, failedSections, load,
    counts, expiring, expiringTotal, attention, starting, startingTotal, coverage, recent,
    show, visibleTables, routeFor,
    EXPIRY_WINDOW_DAYS, STARTING_WINDOW_DAYS, RECENT_LIMIT,
  }
}
