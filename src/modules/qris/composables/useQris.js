// SP-lite — QRIS state composable.
// History persists per-user in Supabase (public.qris_history), with a 14-day
// retention + 50-entry cap enforced server-side by insert_qris_history().

import { ref } from 'vue'
import QRCode from 'qrcode'
import { parseQris, buildQris, buildProprietaryQris, flattenTags } from '@lib/qris-core.js'
import { supabase } from '@lib/supabase.js'

// One-time cleanup: flush the old localStorage history so stale device-local
// entries don't linger. Fresh start in DB — no migration.
try { localStorage.removeItem('sp_lite_qris_history') } catch { /* ignore */ }

const HISTORY_LIMIT = 50

export function useQris() {
  // State
  const generating = ref(false)
  const parsing = ref(false)
  const historyLoading = ref(false)
  const result = ref(null)
  const error = ref(null)
  const history = ref([])

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
      if (data) history.value = [data, ...history.value].slice(0, HISTORY_LIMIT)
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

  // Load history (own rows, newest first, capped at 50)
  async function loadHistory() {
    historyLoading.value = true
    try {
      const { data, error } = await supabase
        .from('qris_history')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50)
      if (error) throw error
      history.value = data || []
    } catch (e) {
      console.warn('[qris] failed to load history', e)
      history.value = []
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
    generate,
    parse,
    loadHistory,
    deleteHistory,
    loadFromHistory,
    loadHistoryDetail,
    clearResult,
  }
}
