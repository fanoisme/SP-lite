import { ref } from 'vue'
import { supabase } from '@/lib/supabase.js'
import { DD_TABLES } from '../lib/schema.js'

// Row counts for the sidebar's Databases group, keyed by DD_TABLES id.
// head: true sends no rows back — only the count header — so listing the
// sidebar never pulls table data into the browser.
export function useDdTableCounts() {
  const counts = ref({})
  const loading = ref(false)

  async function load(tableIds) {
    loading.value = true
    const out = { ...counts.value }
    await Promise.all(tableIds.map(async (id) => {
      const t = DD_TABLES[id]
      if (!t) return
      const { count, error } = await supabase
        .from(t.local)
        .select('*', { count: 'exact', head: true })
      // A count failure must not blank the sidebar; the entry just shows no
      // badge until the next reload.
      out[id] = error ? null : (count ?? 0)
    }))
    counts.value = out
    loading.value = false
  }

  return { counts, loading, load }
}
