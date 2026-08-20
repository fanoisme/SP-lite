import { ref } from 'vue'
import { supabase } from '@/lib/supabase.js'
import { DD_TABLES } from '../lib/schema.js'

// The four figures SP-lite's *global* dashboard shows for the DD module.
//
// Deliberately not `useDdDashboard` — that one runs ten queries to build the
// module's own landing screen, and the global dashboard shows a single summary
// card. It also replaces `useQrddDashboard`, which fetched every row of all
// three tables to derive counts the database can produce on its own.
//
// Every query here is `head: true`, so Postgres returns a count header and no
// rows at all.

const EXPIRY_WINDOW_DAYS = 30

/** Local calendar day, not toISOString() — WIB is UTC+7, so a UTC date would
 *  hand Jakarta yesterday's boundary every evening. */
function isoDay(offsetDays = 0) {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function useDdSummary() {
  const loading = ref(true)
  const error = ref(null)
  const stats = ref({ buCount: 0, merchantActive: 0, promoActive: 0, expiringCount: 0 })

  async function countOf(table, apply) {
    let q = supabase.from(table).select('*', { count: 'exact', head: true })
    if (apply) q = apply(q)
    const { count, error: e } = await q
    if (e) throw e
    return count ?? 0
  }

  async function load() {
    loading.value = true
    error.value = null
    try {
      const today = isoDay()
      const [buCount, merchantActive, promoActive, expiringCount] = await Promise.all([
        countOf(DD_TABLES.bu_accounts.local),
        countOf(DD_TABLES.merchants.local, q => q.eq('status', 'ACTIVE')),
        countOf(DD_TABLES.promos.local, q => q.eq('status', 'ACTIVE')),
        countOf(DD_TABLES.promos.local, q =>
          q.gte('end_date', today).lte('end_date', isoDay(EXPIRY_WINDOW_DAYS))),
      ])
      stats.value = { buCount, merchantActive, promoActive, expiringCount }
    } catch (e) {
      error.value = e.message
    } finally {
      loading.value = false
    }
  }

  return { stats, loading, error, load, EXPIRY_WINDOW_DAYS }
}
