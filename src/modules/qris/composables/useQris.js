// SP-lite — QRIS state composable.
// 100% client-side: no backend. History persists to localStorage instead of PGlite.

import { ref } from 'vue'
import QRCode from 'qrcode'
import { parseQris, buildQris, buildProprietaryQris, flattenTags } from '@lib/qris-core.js'

const HISTORY_KEY = 'sp_lite_qris_history'
const HISTORY_LIMIT = 50

function readHistory() {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]')
  } catch {
    return []
  }
}

function writeHistory(entries) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(entries.slice(0, HISTORY_LIMIT)))
}

function saveToHistory({ type, qrValue, dataUrl, highlights }) {
  const entries = readHistory()
  entries.unshift({
    id: Date.now(),
    type,
    qr_value: qrValue,
    qr_data_url: dataUrl,
    merchant_name: highlights?.merchantName || null,
    mpan: highlights?.mpan || null,
    merchant_id: highlights?.merchantId || null,
    amount: highlights?.amount || null,
    created_at: new Date().toISOString(),
  })
  writeHistory(entries)
}

export function useQris() {
  // State
  const generating = ref(false)
  const parsing = ref(false)
  const historyLoading = ref(false)
  const result = ref(null)
  const error = ref(null)
  const history = ref([])

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

      saveToHistory({ type: qrType, qrValue: built.qrValue, dataUrl, highlights: built.highlights })

      result.value = data
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

      saveToHistory({ type: 'emvco', qrValue, dataUrl, highlights: parsed.highlights })

      result.value = data
      return data
    } catch (e) {
      error.value = e.message || 'Parse failed'
      return null
    } finally {
      parsing.value = false
    }
  }

  // Load history
  async function loadHistory() {
    historyLoading.value = true
    try {
      history.value = readHistory()
    } finally {
      historyLoading.value = false
    }
  }

  // Delete history entry
  async function deleteHistory(id) {
    const entries = readHistory().filter(h => h.id !== id)
    writeHistory(entries)
    history.value = history.value.filter(h => h.id !== id)
  }

  // Load history detail with full parsed tags
  async function loadHistoryDetail(id) {
    const entry = readHistory().find(h => h.id === id)
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
