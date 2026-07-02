// SP-lite — QRIS state composable.
// History persists per-user in Supabase (public.qris_history), with a 14-day
// retention enforced server-side by insert_qris_history() (no row-count cap).

import { ref, computed } from 'vue'
import QRCode from 'qrcode'
import { parseQris, buildQris, buildProprietaryQris, flattenTags } from '@lib/qris-core.js'
import { saveAs } from 'file-saver'
import { supabase } from '@lib/supabase.js'

// One-time cleanup: flush the old localStorage history so stale device-local
// entries don't linger. Fresh start in DB — no migration.
try { localStorage.removeItem('sp_lite_qris_history') } catch { /* ignore */ }

export function useQris() {
  // State
  const generating = ref(false)
  const parsing = ref(false)
  const historyLoading = ref(false)
  const result = ref(null)
  const error = ref(null)
  const history = ref([])

  // Pagination
  const currentPage = ref(1)
  const pageSize = 10
  const totalCount = ref(0)
  const totalPages = computed(() => Math.max(1, Math.ceil(totalCount.value / pageSize)))

  // Persist a generated/parsed QR to DB. Fire-and-forget from generate()/parse()
  // — must not block the QR already shown, and must not throw to the caller.
  async function saveToHistory({ type, qrValue, dataUrl, highlights }) {
    try {
      const { data, error } = await supabase.rpc('insert_qris_history', {
        p_type: type,
        p_qr_value: qrValue,
        p_qr_data_url: dataUrl,
        p_merchant_name: highlights?.merchantName || null,
        p_mpan: highlights?.mpan || null,
        p_merchant_id: highlights?.merchantId || null,
        p_amount: highlights?.amount || null,
      })
      if (error) throw error
      if (data) history.value = [data, ...history.value]
    } catch (e) {
      console.warn('[qris] failed to persist history', e)
    }
  }

  // Generate QRIS from form fields
  async function generate(fields) {
    generating.value = true
    error.value = null
    result.value = null

    try {
      const qrType = fields.type || 'emvco'
      const built = qrType === 'proprietary'
        ? buildProprietaryQris(fields)
        : buildQris(fields)

      const dataUrl = await QRCode.toDataURL(built.qrValue, {
        width: 300,
        errorCorrectionLevel: 'M',
        margin: 2,
      })

      const data = {
        qrValue: built.qrValue,
        dataUrl,
        valid: built.valid,
        type: qrType,
        highlights: built.highlights,
        tags: qrType === 'proprietary' ? built.tags : flattenTags(built.tags),
      }

      // Show the result first, then persist to DB without blocking the UI.
      result.value = data
      saveToHistory({ type: qrType, qrValue: built.qrValue, dataUrl, highlights: built.highlights })

      return data
    } catch (e) {
      error.value = e.message || 'Generation failed'
      return null
    } finally {
      generating.value = false
    }
  }

  // Parse raw QRIS string
  async function parse(qrValue) {
    parsing.value = true
    error.value = null
    result.value = null

    try {
      if (!qrValue) {
        error.value = 'qrValue is required'
        return null
      }

      const parsed = parseQris(qrValue)
      if (!parsed.valid && parsed.error) {
        error.value = parsed.error
        return null
      }

      const dataUrl = await QRCode.toDataURL(qrValue, {
        width: 300,
        errorCorrectionLevel: 'M',
        margin: 2,
      })

      const data = {
        qrValue,
        dataUrl,
        valid: parsed.valid,
        crcValid: parsed.crcValid,
        crcProvided: parsed.crcProvided,
        crcComputed: parsed.crcComputed,
        highlights: parsed.highlights,
        tags: flattenTags(parsed.tags),
      }

      result.value = data
      saveToHistory({ type: 'emvco', qrValue, dataUrl, highlights: parsed.highlights })

      return data
    } catch (e) {
      error.value = e.message || 'Parse failed'
      return null
    } finally {
      parsing.value = false
    }
  }

  // Load history — paginated (10 per page). Always fetches from the server
  // so the list correctly reflects recent scans without full-page refresh.
  async function loadHistory(page = 1) {
    historyLoading.value = true
    const start = (page - 1) * pageSize
    const end = start + pageSize - 1
    try {
      const { data, error, count } = await supabase
        .from('qris_history')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(start, end)
      if (error) throw error
      history.value = data || []
      totalCount.value = count ?? data?.length ?? 0
      currentPage.value = page
    } catch (e) {
      console.warn('[qris] failed to load history', e)
      history.value = []
      totalCount.value = 0
      currentPage.value = 1
    } finally {
      historyLoading.value = false
    }
  }

  // Delete history entry
  async function deleteHistory(id) {
    try {
      const { error } = await supabase.from('qris_history').delete().eq('id', id)
      if (error) throw error
      history.value = history.value.filter(h => h.id !== id)
    } catch (e) {
      console.warn('[qris] failed to delete history entry', e)
    }
  }

  // Delete all history entries for the current user. RLS policy
  // "qris_history_own_delete" enforces ownership server-side.
  async function clearAllHistory() {
    const { data: { session } } = await supabase.auth.getSession()
    const uid = session?.user?.id
    if (!uid) throw new Error('Not authenticated')

    const { error } = await supabase
      .from('qris_history')
      .delete()
      .eq('user_id', uid)
    if (error) throw error

    history.value = []
    totalCount.value = 0
    currentPage.value = 1
  }

  // ── Export helpers ──

  const SIMPLE_COLS = [
    { key: 'merchant_id', label: 'Merchant ID' },
    { key: 'merchant_name', label: 'Merchant Name' },
  ]

  const FULL_COLS = [
    { key: 'created_at', label: 'Date' },
    { key: 'type', label: 'Type' },
    { key: 'merchant_name', label: 'Merchant Name' },
    { key: 'mpan', label: 'MPAN' },
    { key: 'merchant_id', label: 'Merchant ID' },
    { key: 'amount', label: 'Amount' },
  ]

  function csvEscape(val) {
    if (val == null) return ''
    const s = String(val)
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`
    }
    return s
  }

  function formatExportDate(dateStr) {
    if (!dateStr) return ''
    return new Date(dateStr).toISOString()
  }

  function buildCsv(rows, mode) {
    const cols = mode === 'simple' ? SIMPLE_COLS : FULL_COLS
    const header = cols.map(c => csvEscape(c.label)).join(',')
    const body = rows.map(row =>
      cols.map(c => csvEscape(
        c.key === 'created_at' ? formatExportDate(row[c.key]) : row[c.key]
      )).join(',')
    ).join('\n')
    return `${header}\n${body}`
  }

  function buildHtml(rows, mode) {
    const cols = mode === 'simple' ? SIMPLE_COLS : FULL_COLS
    const thead = `<thead><tr>${cols.map(c => `<th>${c.label}</th>`).join('')}</tr></thead>`
    const tbody = `<tbody>${rows.map(row =>
      `<tr>${cols.map(c => {
        const val = c.key === 'created_at' ? formatExportDate(row[c.key]) : (row[c.key] ?? '')
        return `<td>${val}</td>`
      }).join('')}</tr>`
    ).join('\n')}</tbody>`
    return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>QRIS History</title>
<style>
  body { font-family: system-ui, sans-serif; padding: 24px; }
  table { border-collapse: collapse; width: 100%; }
  th, td { border: 1px solid #ddd; padding: 8px 12px; text-align: left; font-size: 13px; }
  th { background: #f5f5f5; font-weight: 600; }
  tr:nth-child(even) { background: #fafafa; }
</style></head>
<body><h2>QRIS History</h2><table>${thead}${tbody}</table></body></html>`
  }

  // Export history to CSV or HTML file. Always re-queries the DB for all rows
  // (within the 14-day retention window) — not limited to the current page.
  async function exportHistory(format, mode) {
    const cols = mode === 'simple'
      ? 'merchant_id,merchant_name'
      : 'created_at,type,merchant_name,mpan,merchant_id,amount'

    // Fetch all rows in batches (Supabase max 1000 per range call)
    const allRows = []
    let rangeStart = 0
    const batchSize = 1000

    while (true) {
      const { data, error } = await supabase
        .from('qris_history')
        .select(cols)
        .order('created_at', { ascending: false })
        .range(rangeStart, rangeStart + batchSize - 1)
      if (error) throw error
      if (!data || data.length === 0) break
      allRows.push(...data)
      if (data.length < batchSize) break
      rangeStart += batchSize
    }

    const ext = format === 'csv' ? 'csv' : 'html'
    const mime = format === 'csv' ? 'text/csv' : 'text/html'
    const filename = `qris-history-${new Date().toISOString().slice(0, 10)}.${ext}`

    const content = format === 'csv'
      ? buildCsv(allRows, mode)
      : buildHtml(allRows, mode)

    const blob = new Blob([content], { type: `${mime};charset=utf-8` })
    saveAs(blob, filename)
  }

  // Load history detail with full parsed tags
  async function loadHistoryDetail(id) {
    const entry = history.value.find(h => h.id === id)
    if (!entry) throw new Error('Failed to load detail')
    const parsed = parseQris(entry.qr_value)
    return {
      ...entry,
      valid: parsed.valid,
      crcValid: parsed.crcValid,
      crcProvided: parsed.crcProvided,
      crcComputed: parsed.crcComputed,
      highlights: parsed.highlights,
      tags: parsed.tags ? flattenTags(parsed.tags) : null,
    }
  }

  // Load result from history
  function loadFromHistory(entry) {
    result.value = {
      qrValue: entry.qr_value,
      dataUrl: entry.qr_data_url,
      valid: true,
      highlights: {
        merchantName: entry.merchant_name,
        mpan: entry.mpan,
        merchantId: entry.merchant_id,
        amount: entry.amount,
        mpanForMpc: entry.mpan?.slice(0, 8),
      },
      tags: null, // Will need to re-parse if needed
    }
  }

  // Clear result
  function clearResult() {
    result.value = null
    error.value = null
  }

  return {
    generating,
    parsing,
    historyLoading,
    result,
    error,
    history,
    currentPage,
    pageSize,
    totalCount,
    totalPages,
    generate,
    parse,
    loadHistory,
    deleteHistory,
    clearAllHistory,
    exportHistory,
    loadFromHistory,
    loadHistoryDetail,
    clearResult,
  }
}
