import { ref, computed, watch } from 'vue'
import { supabase } from '@/lib/supabase.js'
import { useAuth } from '@/composables/useAuth.js'
import { useToast } from '@/lib/composables/useToast.js'
import { exportToXlsx } from '@/lib/export-xlsx.js'

export function useBuAccounts() {
  const { session } = useAuth()
  const toast = useToast()

  const items = ref([])
  const loading = ref(true)
  const error = ref(null)

  const searchQuery = ref('')
  const currentPage = ref(1)
  const pageSize = 10

  watch(searchQuery, () => { currentPage.value = 1 })

  const filtered = computed(() => {
    let result = items.value
    if (searchQuery.value) {
      const q = searchQuery.value.toLowerCase()
      result = result.filter(r =>
        (r.name || '').toLowerCase().includes(q) ||
        (r.sof || '').toLowerCase().includes(q) ||
        (r.acctname1 || '').toLowerCase().includes(q) ||
        (r.acctname2 || '').toLowerCase().includes(q),
      )
    }
    return result
  })

  const totalPages = computed(() =>
    Math.max(1, Math.ceil(filtered.value.length / pageSize)),
  )

  const paginatedItems = computed(() => {
    const start = (currentPage.value - 1) * pageSize
    return filtered.value.slice(start, start + pageSize)
  })

  async function loadItems() {
    loading.value = true
    error.value = null
    try {
      const { data, error: e } = await supabase
        .from('qrdd_bu_accounts')
        .select('*')
        .order('name', { ascending: true })
      if (e) throw e
      items.value = data || []
    } catch (e) {
      error.value = e.message
      items.value = []
    } finally {
      loading.value = false
    }
  }

  async function createItem(form) {
    error.value = null
    const p1 = form.percentage1 / 100
    const p2 = form.percentage2 / 100

    if (Math.abs(p1 + p2 - 1) > 0.0001) {
      toast.error('Percentages must sum to 100%')
      return false
    }

    const { data, error: e } = await supabase
      .from('qrdd_bu_accounts')
      .insert({
        name: form.name,
        sof: form.sof,
        account1: form.account1,
        acctname1: form.acctname1,
        percentage1: p1,
        account2: form.account2,
        acctname2: form.acctname2,
        percentage2: p2,
      })
      .select('*').single()
    if (e) {
      if (e.code === '23505') {
        toast.error(`BU Account "${form.name}" already exists`)
      } else {
        toast.error(e.message)
      }
      return false
    }
    items.value = [data, ...items.value]
    toast.success(`BU Account "${form.name}" created`)
    return true
  }

  async function updateItem(id, form) {
    error.value = null
    const p1 = form.percentage1 / 100
    const p2 = form.percentage2 / 100

    if (Math.abs(p1 + p2 - 1) > 0.0001) {
      toast.error('Percentages must sum to 100%')
      return false
    }

    const { data, error: e } = await supabase
      .from('qrdd_bu_accounts')
      .update({
        name: form.name,
        sof: form.sof,
        account1: form.account1,
        acctname1: form.acctname1,
        percentage1: p1,
        account2: form.account2,
        acctname2: form.acctname2,
        percentage2: p2,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select('*').single()
    if (e) {
      if (e.code === '23505') {
        toast.error(`BU Account "${form.name}" already exists`)
      } else {
        toast.error(e.message)
      }
      return false
    }
    const idx = items.value.findIndex(r => r.id === id)
    if (idx !== -1) items.value[idx] = data
    toast.success(`BU Account "${form.name}" updated`)
    return true
  }

  async function deleteItem(id, name) {
    error.value = null
    const { error: e } = await supabase
      .from('qrdd_bu_accounts')
      .delete()
      .eq('id', id)
    if (e) {
      if (e.code === '23503') {
        toast.error(`Cannot delete "${name}" — it is referenced by merchants or promo rules`)
      } else {
        toast.error(e.message)
      }
      return false
    }
    items.value = items.value.filter(r => r.id !== id)
    toast.success(`BU Account "${name}" deleted`)
    return true
  }

  const exportColumns = [
    { key: 'name', label: 'Name' },
    { key: 'sof', label: 'SOF' },
    { key: 'account1', label: 'Expense Account', textFormula: true },
    { key: 'acctname1', label: 'Expense Name' },
    { key: 'percentage1', label: 'Expense %', format: v => Math.round(Number(v) * 100) + '%' },
    { key: 'account2', label: 'Receivable Account', textFormula: true },
    { key: 'acctname2', label: 'Receivable Name' },
    { key: 'percentage2', label: 'Receivable %', format: v => Math.round(Number(v) * 100) + '%' },
    { key: 'updated_at', label: 'Updated', format: v => v ? new Date(v).toISOString().slice(0, 10) : '' },
  ]

  function exportFiltered() {
    const rows = filtered.value.length ? filtered.value : items.value
    if (!rows.length) {
      toast.error('No data to export')
      return
    }
    try {
      exportToXlsx(rows, exportColumns, 'qrdd_bu_accounts')
      toast.success(`Exported ${rows.length} BU accounts`)
    } catch (e) {
      toast.error('Export failed: ' + e.message)
    }
  }

  const nameOptions = computed(() =>
    items.value.map(r => ({ label: r.name, value: r.name })),
  )

  return {
    items, loading, error,
    searchQuery, currentPage, pageSize,
    filtered, paginatedItems, totalPages, nameOptions,
    loadItems, createItem, updateItem, deleteItem,
    exportFiltered,
  }
}
