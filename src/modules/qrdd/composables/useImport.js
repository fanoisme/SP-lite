import { ref, computed } from 'vue'
import { supabase } from '@/lib/supabase.js'
import { useAuth } from '@/composables/useAuth.js'
import { useBuAccounts } from './useBuAccounts.js'
import { useMerchantWhitelist } from './useMerchantWhitelist.js'
import { usePromoRule } from './usePromoRule.js'
import { useToast } from '@/lib/composables/useToast.js'

export function useImport() {
  const { profile } = useAuth()
  const buAccounts = useBuAccounts()
  const mw = useMerchantWhitelist()
  const pr = usePromoRule()
  const toast = useToast()

  const progress = ref(0)
  const progressTotal = ref(0)

  const fullNameMissing = computed(() => !profile.value?.full_name)

  // Sheet name → expected config
  const SHEET_CONFIG = {
    discount_bu_accounts: {
      headers: ['name', 'sof', 'account1', 'acctname1', 'percentage1', 'account2', 'acctname2', 'percentage2'],
      required: ['name', 'sof', 'account1', 'acctname1', 'percentage1', 'account2', 'acctname2', 'percentage2'],
    },
    merchant_whitelist: {
      headers: ['merchant_id', 'merchant_name', 'bu_name', 'status'],
      required: ['merchant_id', 'merchant_name', 'bu_name'],
    },
    promo_rule: {
      headers: ['promo_id', 'promo_name', 'merchant_id', 'bu_name', 'start_date', 'end_date',
        'prm_discount_type', 'prm_discount_value', 'prm_max_discount',
        'pl_discount_type', 'pl_discount_value', 'pl_max_discount',
        'min_txn_amount', 'max_txn_amount', 'budget_amount', 'priority', 'status'],
      required: ['promo_id', 'promo_name', 'bu_name', 'start_date', 'end_date',
        'prm_discount_type', 'prm_discount_value', 'prm_max_discount',
        'pl_discount_type', 'pl_discount_value', 'pl_max_discount', 'min_txn_amount'],
    },
  }

  async function parseFile(file) {
    const XLSX = await import('xlsx')
    const buf = await file.arrayBuffer()
    const wb = XLSX.read(new Uint8Array(buf), { type: 'array' })

    // Load DB context for FK validation
    const [{ data: existingBu }, { data: existingMw }, { data: existingPr }] = await Promise.all([
      supabase.from('qrdd_bu_accounts').select('name, sof, account1'),
      supabase.from('qrdd_merchant_whitelist').select('merchant_id'),
      supabase.from('qrdd_promo_rules').select('promo_id'),
    ])

    const buKeys = new Set((existingBu || []).map(r => `${r.name}::${r.sof}::${r.account1}`))
    // ponytail: bu_name must reference name only (no SOF filtering) since FK is on name column
    const merchantIds = new Set((existingMw || []).map(r => r.merchant_id))
    const promoIds = new Set((existingPr || []).map(r => r.promo_id))

    const sheets = []

    for (const [sheetName, config] of Object.entries(SHEET_CONFIG)) {
      const ws = wb.Sheets[sheetName]
      if (!ws) continue

      const raw = XLSX.utils.sheet_to_json(ws, { header: 1 })
      if (raw.length < 2) continue

      const headers = raw[0].map(h => String(h).trim())
      const rows = []
      const errors = []

      for (let i = 1; i < raw.length; i++) {
        const obj = {}
        for (let j = 0; j < headers.length; j++) {
          const key = headers[j]
          if (config.headers.includes(key)) {
            let val = raw[i][j]
            if (val != null) val = String(val).trim()
            if (val === 'NULL' || val === '') val = null
            obj[key] = val
          }
        }

        // Validate required
        const missing = config.required.filter(k => obj[k] == null || obj[k] === '')
        if (missing.length) {
          errors.push({ row: i, error: `Missing: ${missing.join(', ')}` })
        }

        // Validate per-table rules
        if (sheetName === 'discount_bu_accounts') {
          if (obj.sof && !['PRIME', 'PAYLATER'].includes(obj.sof)) {
            errors.push({ row: i, error: `Invalid SOF "${obj.sof}"` })
          }
          const p1 = parseFloat(obj.percentage1)
          const p2 = parseFloat(obj.percentage2)
          if (!isNaN(p1) && !isNaN(p2) && Math.abs(p1 + p2 - 1) > 0.001) {
            errors.push({ row: i, error: `Percentages sum to ${p1 + p2}, not 1.0` })
          }
          // Check duplicates within file
          const dupKey = `${obj.name}::${obj.sof}::${obj.account1}`
          if (rows.some(r => `${r.name}::${r.sof}::${r.account1}` === dupKey)) {
            errors.push({ row: i, error: `Duplicate match key: ${dupKey}` })
          }
        }

        if (sheetName === 'merchant_whitelist') {
          if (obj.merchant_id && rows.some(r => r.merchant_id === obj.merchant_id)) {
            errors.push({ row: i, error: `Duplicate merchant_id: ${obj.merchant_id}` })
          }
        }

        if (sheetName === 'promo_rule') {
          if (obj.promo_id && rows.some(r => r.promo_id === obj.promo_id)) {
            errors.push({ row: i, error: `Duplicate promo_id: ${obj.promo_id}` })
          }
          if (obj.end_date && obj.start_date && obj.end_date < obj.start_date) {
            errors.push({ row: i, error: `end_date before start_date` })
          }
        }

        rows.push(obj)
      }

      // Pre-compute new/update split
      let newCount = 0, updateCount = 0
      for (const row of rows) {
        if (sheetName === 'discount_bu_accounts') {
          buKeys.has(`${row.name}::${row.sof}::${row.account1}`) ? updateCount++ : newCount++
        } else if (sheetName === 'merchant_whitelist') {
          merchantIds.has(row.merchant_id) ? updateCount++ : newCount++
        } else if (sheetName === 'promo_rule') {
          promoIds.has(row.promo_id) ? updateCount++ : newCount++
        }
      }

      sheets.push({
        name: sheetName,
        config,
        rows,
        errors,
        summary: {
          total: rows.length,
          errors: errors.length,
          newCount: updateCount != null ? newCount : null,
          updateCount: updateCount != null ? updateCount : null,
        },
      })
    }

    return { sheets }
  }

  async function runImport(sheets) {
    if (fullNameMissing.value) {
      toast.error('Please set your full name in Profile before importing')
      return { results: [] }
    }

    const results = []
    progressTotal.value = sheets.reduce((s, sh) => s + sh.rows.length, 0)
    progress.value = 0

    // FK order: BU → merchants → promos
    const order = ['discount_bu_accounts', 'merchant_whitelist', 'promo_rule']
    const fullName = profile.value?.full_name || 'SYSTEM'

    for (const sheetName of order) {
      const sheet = sheets.find(s => s.name === sheetName)
      if (!sheet || !sheet.rows.length) continue

      // Filter out errored rows, import the rest
      const validRows = sheet.rows.filter((_, i) =>
        !sheet.errors.some(e => e.row === i + 1)
      )
      if (!validRows.length) continue

      const rowsWithMeta = validRows.map(r => ({
        ...r,
        created_by: fullName,
        updated_by: fullName,
      }))

      let result
      if (sheetName === 'discount_bu_accounts') {
        result = await buAccounts.bulkUpsert(rowsWithMeta)
      } else if (sheetName === 'merchant_whitelist') {
        result = await mw.bulkUpsert(rowsWithMeta)
      } else if (sheetName === 'promo_rule') {
        result = await pr.bulkUpsert(rowsWithMeta)
      }

      results.push({ name: sheetName, ...result })
      progress.value += validRows.length

      toast.success(`${sheetName}: ${result.inserted} inserted, ${result.updated} updated${result.errors.length ? `, ${result.errors.length} failed` : ''}`)
    }

    progress.value = progressTotal.value
    return { results }
  }

  return {
    progress, progressTotal,
    fullNameMissing,
    parseFile, runImport,
  }
}
