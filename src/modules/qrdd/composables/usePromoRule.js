import { ref, computed, watch } from 'vue'
import { supabase } from '@/lib/supabase.js'
import { useAuth } from '@/composables/useAuth.js'
import { useToast } from '@/lib/composables/useToast.js'
import { exportToXlsx } from '@/lib/export-xlsx.js'

// Sentinel constants
const UNLIMITED_AMOUNT = 50000000000.00
const NO_MINIMUM = 1.00

export { UNLIMITED_AMOUNT, NO_MINIMUM }

export function usePromoRule() {
  const { session } = useAuth()
  const toast = useToast()

  const items = ref([])
  const loading = ref(true)
  const error = ref(null)

  const searchQuery = ref('')
  const searchColumn = ref('promo_id')
  const currentPage = ref(1)
  const pageSize = 10

  watch([searchQuery, searchColumn], () => { currentPage.value = 1 })

  const filtered = computed(() => {
    let result = items.value
    if (searchQuery.value) {
      const q = searchQuery.value.toLowerCase()
      result = result.filter(r =>
        (r[searchColumn.value] || '').toLowerCase().includes(q),
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
        .from('qrdd_promo_rules')
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
    if (!form.promo_id?.trim()) {
      toast.error('Promo ID is required')
      return false
    }
    const { data, error: e } = await supabase
      .from('qrdd_promo_rules')
      .insert({
        promo_id: form.promo_id,
        promo_name: form.promo_name,
        merchant_id: form.merchant_id || null,
        bu_name: form.bu_name,
        start_date: form.start_date,
        end_date: form.end_date,
        prm_discount_type: form.prm_discount_type,
        prm_discount_value: form.prm_discount_value,
        prm_max_discount: form.prm_unlimited ? UNLIMITED_AMOUNT : form.prm_max_discount,
        pl_discount_type: form.pl_discount_type,
        pl_discount_value: form.pl_discount_value,
        pl_max_discount: form.pl_unlimited ? UNLIMITED_AMOUNT : form.pl_max_discount,
        min_txn_amount: form.min_no_minimum ? NO_MINIMUM : (form.min_txn_amount || 1),
        max_txn_amount: form.max_unlimited ? null : (form.max_txn_amount || null),
        budget_amount: form.budget_unlimited ? null : (form.budget_amount || null),
        priority: form.priority || 0,
        status: form.status || 'ACTIVE',
        created_by: username.value,
        updated_by: username.value,
      })
      .select('*').single()
    if (e) {
      if (e.code === '23505') {
        toast.error(`Promo "${form.promo_id}" already exists`)
      } else if (e.code === '23503') {
        toast.error('Invalid merchant or BU reference')
      } else {
        toast.error(e.message)
      }
      return false
    }
    items.value = [data, ...items.value]
    toast.success(`Promo "${form.promo_id}" created`)
    return true
  }

  async function updateItem(promoId, form) {
    error.value = null
    const { data, error: e } = await supabase
      .from('qrdd_promo_rules')
      .update({
        promo_name: form.promo_name,
        merchant_id: form.merchant_id || null,
        bu_name: form.bu_name,
        start_date: form.start_date,
        end_date: form.end_date,
        prm_discount_type: form.prm_discount_type,
        prm_discount_value: form.prm_discount_value,
        prm_max_discount: form.prm_unlimited ? UNLIMITED_AMOUNT : form.prm_max_discount,
        pl_discount_type: form.pl_discount_type,
        pl_discount_value: form.pl_discount_value,
        pl_max_discount: form.pl_unlimited ? UNLIMITED_AMOUNT : form.pl_max_discount,
        min_txn_amount: form.min_no_minimum ? NO_MINIMUM : (form.min_txn_amount || 1),
        max_txn_amount: form.max_unlimited ? null : (form.max_txn_amount || null),
        budget_amount: form.budget_unlimited ? null : (form.budget_amount || null),
        priority: form.priority || 0,
        status: form.status || 'ACTIVE',
        updated_by: username.value,
        updated_at: new Date().toISOString(),
      })
      .eq('promo_id', promoId)
      .select('*').single()
    if (e) {
      if (e.code === '23503') {
        toast.error('Invalid merchant or BU reference')
      } else {
        toast.error(e.message)
      }
      return false
    }
    const idx = items.value.findIndex(r => r.promo_id === promoId)
    if (idx !== -1) items.value[idx] = data
    toast.success(`Promo "${promoId}" updated`)
    return true
  }

  async function deleteItem(promoId) {
    error.value = null
    const { error: e } = await supabase
      .from('qrdd_promo_rules')
      .delete()
      .eq('promo_id', promoId)
    if (e) {
      toast.error(e.message)
      return false
    }
    items.value = items.value.filter(r => r.promo_id !== promoId)
    toast.success(`Promo "${promoId}" deleted`)
    return true
  }

  const exportColumns = [
    { key: 'promo_id', label: 'Promo ID' },
    { key: 'promo_name', label: 'Promo Name' },
    { key: 'merchant_id', label: 'Merchant ID', textFormula: true, format: v => v || 'All Merchants' },
    { key: 'bu_name', label: 'BU Name' },
    { key: 'start_date', label: 'Start Date' },
    { key: 'end_date', label: 'End Date' },
    { key: 'prm_discount_type', label: 'PRM Discount Type' },
    { key: 'prm_discount_value', label: 'PRM Discount Value', format: (v, row) => row.prm_discount_type === 'PERCENTAGE' ? v + '%' : v },
    { key: 'prm_max_discount', label: 'PRM Max Discount', format: v => Number(v) >= 49999999999 ? 'Unlimited' : v },
    { key: 'pl_discount_type', label: 'PL Discount Type' },
    { key: 'pl_discount_value', label: 'PL Discount Value', format: (v, row) => row.pl_discount_type === 'PERCENTAGE' ? v + '%' : v },
    { key: 'pl_max_discount', label: 'PL Max Discount', format: v => Number(v) >= 49999999999 ? 'Unlimited' : v },
    { key: 'min_txn_amount', label: 'Min Txn Amount', format: v => Number(v) <= 1 ? 'No Minimum' : v },
    { key: 'max_txn_amount', label: 'Max Txn Amount', format: v => v == null ? 'Unlimited' : v },
    { key: 'budget_amount', label: 'Budget Amount', format: v => v == null ? 'Unlimited' : v },
    { key: 'priority', label: 'Priority' },
    { key: 'status', label: 'Status' },
    { key: 'created_by', label: 'Created By' },
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
      exportToXlsx(rows, exportColumns, 'qrdd_promo_rules')
      toast.success(`Exported ${rows.length} promo rules`)
    } catch (e) {
      toast.error('Export failed: ' + e.message)
    }
  }

  return {
    items, loading, error,
    searchQuery, searchColumn, currentPage, pageSize,
    paginatedItems, totalPages,
    loadItems, createItem, updateItem, deleteItem, exportFiltered,
  }
}
