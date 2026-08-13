import { ref, computed, watch } from 'vue'
import { supabase } from '@/lib/supabase.js'
import { downloadCsv } from '../lib/csv.js'
import { tableLabel } from '../lib/schema.js'

const SEARCH_DEBOUNCE_MS = 250

// Columns the free-text box searches. Enum and numeric columns are excluded —
// they have their own dropdowns.
const SEARCH_COLUMNS = ['record_key', 'column_name', 'old_value', 'new_value', 'detail']

// Audit log reader. Server-side paged and server-side filtered — the log only
// grows, so it is never pulled into the browser wholesale.
export function useAuditLog() {
  const rows = ref([])
  const loading = ref(true)
  const error = ref(null)
  const total = ref(0)

  const currentPage = ref(1)
  const pageSize = 25

  const filterTable = ref('')
  const filterAction = ref('')
  const filterActor = ref('')
  const search = ref('')
  const actors = ref([])

  const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize)))

  // Discards out-of-order responses: fast typing must never leave an older
  // result on screen after a newer request has already returned.
  let seq = 0
  let searchTimer = null

  watch(currentPage, () => { load() })

  // A filter change invalidates the current page number.
  watch([filterTable, filterAction, filterActor], () => {
    if (currentPage.value !== 1) currentPage.value = 1
    else load()
  })

  watch(search, () => {
    clearTimeout(searchTimer)
    searchTimer = setTimeout(() => {
      if (currentPage.value !== 1) currentPage.value = 1
      else load()
    }, SEARCH_DEBOUNCE_MS)
  })

  async function load() {
    const mySeq = ++seq
    loading.value = true
    error.value = null
    const from = (currentPage.value - 1) * pageSize
    const to = from + pageSize - 1
    try {
      let q = supabase
        .from('dd_audit_log')
        .select('*', { count: 'exact' })
        // audit_id, not ts: rows written by one statement share a timestamp to
        // the microsecond and only the identity column orders them stably.
        .order('audit_id', { ascending: false })

      if (filterTable.value) q = q.eq('table_id', filterTable.value)
      if (filterAction.value) q = q.eq('action', filterAction.value)
      if (filterActor.value) q = q.eq('actor', filterActor.value)

      const term = search.value.trim()
      if (term) {
        // Commas and parentheses are PostgREST `or` syntax; strip them so a
        // literal one in the search box cannot break the filter expression.
        const safe = term.replace(/[,()]/g, ' ')
        q = q.or(SEARCH_COLUMNS.map(c => `${c}.ilike.%${safe}%`).join(','))
      }

      const { data, error: e, count } = await q.range(from, to)
      if (mySeq !== seq) return   // a newer request already answered
      if (e) throw e
      rows.value = data || []
      total.value = count ?? 0
    } catch (e) {
      if (mySeq !== seq) return
      error.value = e.message
      rows.value = []
      total.value = 0
    } finally {
      if (mySeq === seq) loading.value = false
    }
  }

  async function loadActors() {
    const { data, error: e } = await supabase.rpc('dd_audit_actors')
    if (e) { actors.value = []; return }
    actors.value = (data || []).map(r => r.actor).filter(Boolean)
  }

  function resetFilters() {
    filterTable.value = ''
    filterAction.value = ''
    filterActor.value = ''
    search.value = ''
  }

  // Exports the current page, matching the DD app this replaces. The whole log
  // is deliberately not dumped — narrow it with the filters first.
  function exportCsv() {
    downloadCsv(rows.value, [
      { key: 'ts', label: 'When', format: v => (v ? new Date(v).toISOString() : '') },
      { key: 'actor', label: 'Who' },
      { key: 'action', label: 'Action' },
      { key: 'target_db', label: 'Database' },
      { key: 'table_id', label: 'Table', format: v => tableLabel(v) },
      { key: 'record_key', label: 'Record' },
      { key: 'column_name', label: 'Column' },
      { key: 'old_value', label: 'Old Value' },
      { key: 'new_value', label: 'New Value' },
      { key: 'detail', label: 'Detail' },
    ], `dd-audit-log-page-${currentPage.value}`)
  }

  return {
    rows, loading, error, total,
    currentPage, pageSize, totalPages,
    filterTable, filterAction, filterActor, search, actors,
    load, loadActors, resetFilters, exportCsv,
  }
}
