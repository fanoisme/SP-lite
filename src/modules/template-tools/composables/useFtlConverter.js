import { ref } from 'vue'
import { useHtmlFixer } from './useHtmlFixer'

/**
 * Converts HTML to valid FreeMarker FTL template (XHTML-compliant, FlyingSaucer-ready).
 */
export function useFtlConverter() {
  const converting = ref(false)
  const { fixForXhtml } = useHtmlFixer()

  function convert(htmlCode) {
    converting.value = true

    try {
      // First, auto-fix the HTML for XHTML compliance
      const { html: fixedHtml } = fixForXhtml(htmlCode)

      let ftl = fixedHtml

      // 1. Add <#ftl> preamble if not present
      if (!/<#ftl/i.test(ftl)) {
        ftl = `<#ftl output_format="XML">\n${ftl}`
      }

      // 2. Ensure XHTML doctype
      if (!/<!DOCTYPE/i.test(ftl)) {
        ftl = `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Strict//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd">\n${ftl}`
      }

      // 3. Ensure xmlns on <html>
      ftl = ftl.replace(/<html(?!\s+xmlns)/gi, '<html xmlns="http://www.w3.org/1999/xhtml"')

      // 4. Ensure all <style> blocks have print-safe CSS
      ftl = ensurePrintStyles(ftl)

      return ftl
    } finally {
      converting.value = false
    }
  }

  function ensurePrintStyles(ftl) {
    // Add @page rule if not present
    if (!ftl.includes('@page')) {
      const printCss = `
    @page { size: A4; margin: 15mm; }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      table { page-break-inside: avoid; }
      h1, h2, h3 { page-break-after: avoid; }
    }`

      // Insert before closing </style> tag
      if (ftl.includes('</style>')) {
        ftl = ftl.replace('</style>', `${printCss}\n  </style>`)
      }
    }
    return ftl
  }

  return { convert, converting }
}
