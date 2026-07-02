import { ref } from 'vue'

/**
 * SP-lite has no backend, so the Flying Saucer PDF sidecar is never available.
 * This stub always reports javaAvailable = false so FtlPreviewPanel falls back
 * to its client-side approximate preview (the same fallback SO-Platform uses
 * when Java isn't installed).
 */
export function useFtlPdfRenderer() {
  const rendering = ref(false)
  const javaAvailable = ref(false)
  const lastError = ref('PDF rendering sidecar is not available in this deployment')
  const pdfUrl = ref('')

  async function checkHealth() {
    javaAvailable.value = false
    return false
  }

  async function render() {
    javaAvailable.value = false
    lastError.value = 'PDF rendering sidecar is not available in this deployment'
    return null
  }

  function dispose() {
    if (pdfUrl.value) { URL.revokeObjectURL(pdfUrl.value); pdfUrl.value = '' }
  }

  return { rendering, javaAvailable, lastError, pdfUrl, checkHealth, render, dispose }
}
