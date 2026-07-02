import { ref } from 'vue'

/**
 * Repairs attribute-quoting corruption that older versions of this fixer wrote
 * into <meta>/<link> tags. A quoted value containing "key=value" (e.g. the
 * viewport meta content or a Google Fonts URL) had its inner key=value re-quoted,
 * producing invalid XML like content="width="device-width,"..." that Flying
 * Saucer rejects. Scoped to <meta>/<link> tags only.
 */
function repairCorruptedAttrs(tag) {
  let prev
  do {
    prev = tag
    // Un-quote "word="token"" embedded inside a value — name preceded by
    // punctuation (not whitespace, not a word char), so it's not a real
    // attribute and can't start mid-word.
    tag = tag.replace(/(?<![\s\w])(\w+)="([^"\s>]+)"/g, '$1=$2')
  } while (tag !== prev)
  // Collapse stray trailing quote-runs (e.g. swap""" -> swap"), but keep
  // legitimate empty values like alt="" / content="" (run preceded by "=").
  tag = tag.replace(/(?<!=)""+/g, '"')
  return tag
}

/**
 * Auto-fixes invalid HTML to produce well-formed output.
 * Uses DOMParser for robust parsing, then applies additional fixes.
 */
export function useHtmlFixer() {
  const lastFixes = ref([])

  function fix(html) {
    const fixes = []
    if (!html || !html.trim()) return { html: '', fixes }

    let working = html

    // If it's a fragment (no <html> wrapper), wrap it for DOMParser
    const isFragment = !/<html/i.test(working)
    if (isFragment) {
      working = `<html><head></head><body>${working}</body></html>`
    }

    // Parse as HTML
    const doc = new DOMParser().parseFromString(working, 'text/html')

    // 1. Add viewport meta if missing
    if (!doc.querySelector('meta[name="viewport"]')) {
      const meta = doc.createElement('meta')
      meta.setAttribute('name', 'viewport')
      meta.setAttribute('content', 'width=device-width, initial-scale=1.0')
      doc.head.appendChild(meta)
      fixes.push('Added viewport meta tag')
    }

    // 2. Add charset if missing
    if (!doc.querySelector('meta[charset]') && !doc.querySelector('meta[http-equiv="Content-Type"]')) {
      const meta = doc.createElement('meta')
      meta.setAttribute('charset', 'UTF-8')
      doc.head.insertBefore(meta, doc.head.firstChild)
      fixes.push('Added charset meta tag')
    }

    // 3. Add basic responsive CSS if no <style> exists
    if (!doc.querySelector('style')) {
      const style = doc.createElement('style')
      style.textContent = `
        * { box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; line-height: 1.6; color: #333; }
        img { max-width: 100%; height: auto; }
        table { width: 100%; border-collapse: collapse; }
        td, th { padding: 8px; border: 1px solid #ddd; }
      `
      doc.head.appendChild(style)
      fixes.push('Added responsive CSS')
    }

    // Serialize back
    let result
    if (isFragment) {
      // Extract just the body content for fragments
      result = doc.body.innerHTML
    } else {
      result = serializeDoc(doc)
    }

    lastFixes.value = fixes
    return { html: result, fixes }
  }

  function serializeDoc(doc) {
    const doctype = '<!DOCTYPE html>'
    const html = doc.documentElement.outerHTML
    return `${doctype}\n${html}`
  }

  /**
   * Fix HTML specifically for XHTML + FlyingSaucer compliance.
   * Used before FTL conversion.
   */
  function fixForXhtml(html) {
    const fixes = []
    if (!html || !html.trim()) return { html: '', fixes }

    let working = html

    // Repair pre-existing attribute-quoting corruption in head meta/link tags
    // (older fixer versions mangled values containing "key=value"). Runs first.
    const beforeRepair = working
    working = working.replace(/<meta\b[^>]*>/gi, repairCorruptedAttrs)
    working = working.replace(/<link\b[^>]*>/gi, repairCorruptedAttrs)
    if (working !== beforeRepair) fixes.push('Repaired corrupted attribute quoting in <meta>/<link>')

    // Strip <script> blocks — the iframe embed script is meaningless in FTL/PDF
    // and Flying Saucer ignores it; removing keeps generated FTL clean.
    if (/<script\b/i.test(working)) {
      working = working.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
      fixes.push('Removed <script> tags (not used in FTL/PDF)')
    }

    // Self-close void elements
    const voidTags = ['br', 'hr', 'img', 'input', 'meta', 'link', 'area', 'base', 'col', 'embed', 'source', 'track', 'wbr']
    for (const tag of voidTags) {
      const regex = new RegExp(`<${tag}(\\s[^>]*?)?(?<!\\/)\\s*>`, 'gi')
      const before = working
      working = working.replace(regex, `<${tag}$1 />`)
      if (working !== before) fixes.push(`Self-closed <${tag}> elements`)
    }

    // Lowercase tag names (basic approach — attributes stay as-is)
    working = working.replace(/<\/?([A-Z][A-Z0-9]*)\b/g, (match, tag) => {
      return match.replace(tag, tag.toLowerCase())
    })

    // Remove CSS Grid properties (not supported by FlyingSaucer)
    const gridProps = ['display:\\s*grid', 'grid-template', 'grid-column', 'grid-row', 'grid-gap', 'gap:\\s*\\d']
    for (const prop of gridProps) {
      const regex = new RegExp(`${prop}[^;]*;`, 'gi')
      if (regex.test(working)) {
        working = working.replace(regex, '')
        fixes.push('Removed CSS Grid properties (not supported by FlyingSaucer)')
      }
    }

    // Convert rem/em to px (approximate: 1rem = 16px, 1em = 16px)
    working = working.replace(/(\d+(?:\.\d+)?)rem/g, (_, num) => `${Math.round(parseFloat(num) * 16)}px`)
    working = working.replace(/(\d+(?:\.\d+)?)em/g, (_, num) => `${Math.round(parseFloat(num) * 16)}px`)

    // Quote unquoted attributes. The (?<=\s) anchor requires the attribute name
    // to sit at a real attribute position (preceded by whitespace), so this never
    // reaches inside an already-quoted value — e.g. it leaves content="width=device-width"
    // alone instead of corrupting it into invalid XML that Flying Saucer rejects.
    working = working.replace(/(?<=\s)(\w+)=([^\s>"']+)/g, '$1="$2"')

    lastFixes.value = fixes
    return { html: working, fixes }
  }

  return { fix, fixForXhtml, lastFixes }
}
