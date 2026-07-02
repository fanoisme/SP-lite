import { ref, computed, watch } from 'vue'
import { supabase } from '@/lib/supabase.js'
import { useAuth } from '@/composables/useAuth.js'
import { useToast } from '@/lib/composables/useToast.js'
import { exportToXlsx } from '@/lib/export-xlsx.js'

export function useMerchantWhitelist() {
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
        (r.merchant_id || '').toLowerCase().includes(q) ||
        (r.merchant_name || '').toLowerCase().includes(q) ||
        (r.bu_name || '').toLowerCase().includes(q),
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

  const username = computed(() => session.value?.user?.email || 'SYSTEM')

  async function loadItems() {
    loading.value = true
    error.value = null
    try {
      const { data, error: e } = await supabase
        .from('qrdd_merchant_whitelist')
        .select('*')
        .order('created_at', { ascending: false })
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
    const { data, error: e } = await supabase
      .from('qrdd_merchant_whitelist')
      .insert({
        merchant_id: form.merchant_id,
        merchant_name: form.merchant_name,
        bu_name: form.bu_name,
        status: form.status || 'ACTIVE',
        created_by: username.value,
        updated_by: username.value,
      })
      .select('*').single()
    if (e) {
      if (e.code === '23505') {
        toast.error(`Merchant "${form.merchant_id}" already exists`)
      } else if (e.code === '23503') {
        toast.error('Invalid BU name — must exist in BU Accounts')
      } else {
        toast.error(e.message)
      }
      return false
    }
    items.value = [data, ...items.value]
    toast.success(`Merchant "${form.merchant_id}" added`)
    return true
  }

  async function updateItem(id, form) {
    error.value = null
    const { data, error: e } = await supabase
      .from('qrdd_merchant_whitelist')
      .update({
        merchant_id: form.merchant_id,
        merchant_name: form.merchant_name,
        bu_name: form.bu_name,
        status: form.status,
        updated_by: username.value,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select('*').single()
    if (e) {
      if (e.code === '23505') {
        toast.error(`Merchant "${form.merchant_id}" already exists`)
      } else {
        toast.error(e.message)
      }
      return false
    }
    const idx = items.value.findIndex(r => r.id === id)
    if (idx !== -1) items.value[idx] = data
    toast.success(`Merchant "${form.merchant_id}" updated`)
    return true
  }

  async function deleteItem(id, merchantId) {
    error.value = null
    const { error: e } = await supabase
      .from('qrdd_merchant_whitelist')
      .delete()
      .eq('id', id)
    if (e) {
      if (e.code === '23503') {
        toast.error(`Cannot delete "${merchantId}" — it is referenced by promo rules`)
      } else {
        toast.error(e.message)
      }
      return false
    }
    items.value = items.value.filter(r => r.id !== id)
    toast.success(`Merchant "${merchantId}" deleted`)
    return true
  }

  const exportColumns = [
    { key: 'merchant_id', label: 'Merchant ID', textFormula: true },
    { key: 'merchant_name', label: 'Merchant Name' },
    { key: 'bu_name', label: 'BU Name' },
    { key: 'status', label: 'Status' },
    { key: 'created_by', label: 'Created By' },
    { key: 'created_at', label: 'Created At', format: v => v ? new Date(v).toISOString().slice(0, 10) : '' },
    { key: 'updated_by', label: 'Updated By' },
    { key: 'updated_at', label: 'Updated At', format: v => v ? new Date(v).toISOString().slice(0, 10) : '' },
  ]

  function exportFiltered() {
    const rows = filtered.value.length ? filtered.value : items.value
    if (!rows.length) {
      toast.error('No data to export')
      return
    }
    try {
      exportToXlsx(rows, exportColumns, 'qrdd_merchant_whitelist')
      toast.success(`Exported ${rows.length} merchants`)
    } catch (e) {
      toast.error('Export failed: ' + e.message)
    }
  }

  return {
    items, loading, error,
    searchQuery, currentPage, pageSize,
    filtered, paginatedItems, totalPages,
    loadItems, createItem, updateItem, deleteItem,
    exportFiltered,
  }
}
