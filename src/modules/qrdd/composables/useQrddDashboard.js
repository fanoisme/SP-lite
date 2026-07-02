import { ref } from 'vue'
import { supabase } from '@/lib/supabase.js'
import { useToast } from '@/lib/composables/useToast.js'
import { exportMultiSheetXlsx } from '@/lib/export-xlsx.js'

export function useQrddDashboard() {
  const toast = useToast()
  const loading = ref(true)

  const stats = ref({
    buCount: 0, buPrimeCount: 0, buPaylaterCount: 0,
    merchantCount: 0, merchantActive: 0, merchantInactive: 0,
    promoCount: 0, promoActive: 0, promoInactive: 0,
    activeBudget: 0, hasUnlimitedBudget: false,
  })

  const merchantsPerBu = ref([])
  const promosPerBu = ref([])
  const discountTypes = ref({ prmPct: 0, prmFixed: 0, plPct: 0, plFixed: 0 })
  const recentPromos = ref([])
  const recentMerchants = ref([])
  const expiringPromos = ref([])

  async function loadAll() {
    loading.value = true
    try {
      // Fetch all data in parallel
      const [
        { data: buAll, error: buErr },
        { data: mwAll, error: mwErr },
        { data: prAll, error: prErr },
        { data: recentPr, error: rpErr },
        { data: recentMw, error: rmErr },
      ] = await Promise.all([
        supabase.from('qrdd_bu_accounts').select('sof'),
        supabase.from('qrdd_merchant_whitelist').select('status'),
        supabase.from('qrdd_promo_rules').select('status,budget_amount,prm_discount_type,pl_discount_type,bu_name'),
        supabase.from('qrdd_promo_rules').select('promo_id,promo_name,start_date,end_date,status').order('created_at', { ascending: false }).limit(5),
        supabase.from('qrdd_merchant_whitelist').select('merchant_id,merchant_name,bu_name,created_at').order('created_at', { ascending: false }).limit(5),
      ])

      if (buErr) throw buErr; if (mwErr) throw mwErr; if (prErr) throw prErr
      if (rpErr) throw rpErr; if (rmErr) throw rmErr

      const bu = buAll || []
      const mw = mwAll || []
      const pr = prAll || []

      // Stats
      stats.value = {
        buCount: bu.length,
        buPrimeCount: bu.filter(r => r.sof === 'PRIME').length,
        buPaylaterCount: bu.filter(r => r.sof === 'PAYLATER').length,
        merchantCount: mw.length,
        merchantActive: mw.filter(r => r.status === 'ACTIVE').length,
        merchantInactive: mw.filter(r => r.status === 'INACTIVE').length,
        promoCount: pr.length,
        promoActive: pr.filter(r => r.status === 'ACTIVE').length,
        promoInactive: pr.filter(r => r.status === 'INACTIVE').length,
        activeBudget: pr.filter(r => r.status === 'ACTIVE' && r.budget_amount != null).reduce((s, r) => s + Number(r.budget_amount), 0),
        hasUnlimitedBudget: pr.some(r => r.status === 'ACTIVE' && r.budget_amount == null),
      }

      // Group by BU — client-side (ponytail: fine for <1000 rows; upgrade to DB view when data grows)
      merchantsPerBu.value = groupBy(mw, 'bu_name')
      promosPerBu.value = groupBy(pr, 'bu_name')

      // Discount type distribution
      discountTypes.value = {
        prmPct: pr.filter(r => r.prm_discount_type === 'PERCENTAGE').length,
        prmFixed: pr.filter(r => r.prm_discount_type === 'FIXED').length,
        plPct: pr.filter(r => r.pl_discount_type === 'PERCENTAGE').length,
        plFixed: pr.filter(r => r.pl_discount_type === 'FIXED').length,
      }

      recentPromos.value = recentPr || []
      recentMerchants.value = recentMw || []

      // Expiring within 30 days
      const now = new Date()
      const d30 = new Date(now.getTime() + 30 * 86400000)
      expiringPromos.value = pr.filter(r => {
        if (r.status !== 'ACTIVE' || !r.end_date) return false
        const ed = new Date(r.end_date)
        return ed >= now && ed <= d30
      })
    } catch (e) {
      toast.error('Failed to load dashboard: ' + e.message)
    } finally {
      loading.value = false
    }
  }

  function groupBy(arr, key) {
    const map = {}
    for (const r of arr) {
      const k = r[key] || '—'
      map[k] = (map[k] || 0) + 1
    }
    return Object.entries(map).map(([bu_name, count]) => ({ bu_name, count }))
  }

  function exportDashboard() {
    const summaryRows = [
      { metric: 'BU Accounts', value: stats.value.buCount, extra: `PRIME: ${stats.value.buPrimeCount} / PAYLATER: ${stats.value.buPaylaterCount}` },
      { metric: 'Merchants', value: stats.value.merchantCount, extra: `Active: ${stats.value.merchantActive} / Inactive: ${stats.value.merchantInactive}` },
      { metric: 'Promo Rules', value: stats.value.promoCount, extra: `Active: ${stats.value.promoActive} / Inactive: ${stats.value.promoInactive}` },
      { metric: 'Active Budget', value: stats.value.hasUnlimitedBudget ? 'Unlimited' : stats.value.activeBudget, extra: '' },
    ]
    const summaryCols = [
      { key: 'metric', label: 'Metric' },
      { key: 'value', label: 'Value' },
      { key: 'extra', label: 'Breakdown' },
    ]
    const buCols = [
      { key: 'bu_name', label: 'BU Name' },
      { key: 'count', label: 'Count' },
    ]
    try {
      exportMultiSheetXlsx([
        { name: 'Summary', rows: summaryRows, columns: summaryCols },
        { name: 'Merchants per BU', rows: merchantsPerBu.value, columns: buCols },
        { name: 'Promos per BU', rows: promosPerBu.value, columns: buCols },
      ], 'qrdd_dashboard')
      toast.success('Dashboard exported')
    } catch (e) {
      toast.error('Export failed: ' + e.message)
    }
  }

  return {
    stats, merchantsPerBu, promosPerBu, discountTypes,
    recentPromos, recentMerchants, expiringPromos,
    loading, loadAll, exportDashboard,
  }
}
