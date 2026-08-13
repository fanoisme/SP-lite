import { ref, computed, watch } from 'vue'
import { supabase } from '@/lib/supabase.js'

// Audit log reader. Server-side paged — the log only grows, so it is never
// pulled into the browser wholesale the way the qrdd composables do.
export function useAuditLog() {
  const rows = ref([])
  const loading = ref(true)
  const error = ref(null)
  const total = ref(0)

  const currentPage = ref(1)
  const pageSize = 25

  const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize)))

  watch(currentPage, () => { load() })

  async function load() {
    loading.value = true
    error.value = null
    const from = (currentPage.value - 1) * pageSize
    const to = from + pageSize - 1
    try {
      const { data, error: e, count } = await supabase
        .from('dd_audit_log')
        .select('*', { count: 'exact' })
        // audit_id, not ts: rows written by one statement share a timestamp to
        // the microsecond and only the identity column orders them stably.
        .order('audit_id', { ascending: false })
        .range(from, to)
      if (e) throw e
      rows.value = data || []
      total.value = count ?? 0
    } catch (e) {
      error.value = e.message
      rows.value = []
      total.value = 0
    } finally {
      loading.value = false
    }
  }

  return { rows, loading, error, total, currentPage, pageSize, totalPages, load }
}
