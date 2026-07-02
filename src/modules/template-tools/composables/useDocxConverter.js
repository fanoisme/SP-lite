import { ref } from 'vue'
import { buildDocumentHtml } from './docxWysiwyg.js'

export function useDocxConverter() {
  const converting = ref(false)
  const error = ref(null)

  /**
   * Convert a .docx File into WYSIWYG HTML (font size/color/weight/alignment
   * preserved) via docx-preview, wrapped with a flow-layout override and the
   * iframe parent-communication script.
   *
   * @param {File} file
   * @returns {Promise<{ html: string, messages: Array }>}
   */
  async function convert(file) {
    converting.value = true
    error.value = null

    try {
      // Dynamic import to code-split docx-preview
      const { renderAsync } = await import('docx-preview')
      const arrayBuffer = await file.arrayBuffer()

      // Render into a detached container. Passing the same element as the style
      // container keeps docx-preview's generated <style> alongside the pages so
      // we can split them out below.
      const container = document.createElement('div')
      await renderAsync(arrayBuffer, container, container)

      const html = buildDocumentHtml(splitRendered(container.innerHTML))

      return { html, messages: [] }
    } catch (e) {
      error.value = e.message
      throw e
    } finally {
      converting.value = false
    }
  }

  return { convert, converting, error }
}

/**
 * Split docx-preview's serialized output into generated <style> blocks and the
 * rendered body markup. Uses DOMParser (available in the browser where convert()
 * runs) so the split is robust regardless of attribute quoting/ordering.
 *
 * @param {string} renderedHtml - container.innerHTML from docx-preview
 * @returns {{ bodyContent: string, styleContent: string }}
 */
function splitRendered(renderedHtml) {
  const doc = new DOMParser().parseFromString(
    `<html><head></head><body>${renderedHtml}</body></html>`,
    'text/html'
  )
  const styleNodes = Array.from(doc.querySelectorAll('style'))
  const styleContent = styleNodes.map((s) => s.outerHTML).join('\n')
  styleNodes.forEach((s) => s.remove())
  return { bodyContent: doc.body.innerHTML, styleContent }
}
