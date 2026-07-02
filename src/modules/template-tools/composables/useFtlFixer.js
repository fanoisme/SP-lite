import { ref } from 'vue'

/**
 * Repairs attribute-quoting corruption that older versions of this fixer wrote
 * into <meta>/<link> tags. A quoted value containing "key=value" (e.g. the
 * viewport meta content or a Google Fonts URL) had its inner key=value re-quoted,
 * producing invalid XML like content="width="device-width,"..." that Flying
 * Saucer rejects with "Element type meta must be followed by ...".
 *
 * Scoped to <meta>/<link> tags only, so CSS `content: ""` and body text are
 * never touched.
 */
function repairCorruptedAttrs(tag) {
  let prev
  do {
    prev = tag
    // Un-quote "word="token"" embedded inside a value — i.e. where the name is
    // preceded by punctuation (not whitespace and not a word char), so it cannot
    // be a real attribute and cannot start mid-word.
    tag = tag.replace(/(?<![\s\w])(\w+)="([^"\s>]+)"/g, '$1=$2')
  } while (tag !== prev)
  // Collapse stray trailing quote-runs left behind (e.g. swap""" -> swap"), but
  // keep legitimate empty values like alt="" / content="" (run preceded by "=").
  tag = tag.replace(/(?<!=)""+/g, '"')
  return tag
}

/**
 * Auto-fixes FTL templates for XHTML + FlyingSaucer compliance.
 */
export function useFtlFixer() {
  const lastFixes = ref([])

  function fix(ftl) {
    const fixes = []
    if (!ftl || !ftl.trim()) return { ftl: '', fixes }

    let working = ftl

    // 0. Repair pre-existing attribute-quoting corruption in head meta/link
    //    tags (older fixer versions mangled values containing "key=value").
    //    Runs first so every later step sees well-formed tags.
    const beforeRepair = working
    working = working.replace(/<meta\b[^>]*>/gi, repairCorruptedAttrs)
    working = working.replace(/<link\b[^>]*>/gi, repairCorruptedAttrs)
    if (working !== beforeRepair) fixes.push('Repaired corrupted attribute quoting in <meta>/<link>')

    // 1. Ensure <#ftl output_format="XML"> preamble
    if (!/<#ftl/i.test(working)) {
      working = `<#ftl output_format="XML">\n${working}`
      fixes.push('Added <#ftl output_format="XML"> preamble')
    }

    // 2. Ensure XHTML doctype
    if (!/<!DOCTYPE/i.test(working)) {
      working = `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Strict//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd">\n${working}`
      fixes.push('Added XHTML doctype')
    }

    // 3. Ensure xmlns on <html>
    if (/<html/i.test(working) && !/xmlns/i.test(working.match(/<html[^>]*>/i)?.[0] || '')) {
      working = working.replace(/<html([^>]*)>/i, '<html xmlns="http://www.w3.org/1999/xhtml"$1>')
      fixes.push('Added XHTML namespace to <html>')
    }

    // 4. Self-close void HTML elements (but NOT FreeMarker directives)
    const voidTags = ['br', 'hr', 'img', 'input', 'meta', 'link', 'area', 'base', 'col', 'embed', 'source', 'track', 'wbr']
    for (const tag of voidTags) {
      const regex = new RegExp(`<${tag}(\\s[^>]*?)?(?<!\\/)\\s*>`, 'gi')
      const before = working
      working = working.replace(regex, `<${tag}$1 />`)
      if (working !== before) fixes.push(`Self-closed <${tag}> elements`)
    }

    // 5. Remove CSS Grid properties (FlyingSaucer doesn't support)
    const gridPatterns = [
      /display\s*:\s*grid\s*;?/gi,
      /grid-template[^;]*;/gi,
      /grid-column[^;]*;/gi,
      /grid-row[^;]*;/gi,
      /grid-gap[^;]*;/gi,
      /gap\s*:\s*\d[^;]*;/gi,
    ]
    for (const regex of gridPatterns) {
      const before = working
      working = working.replace(regex, '')
      if (working !== before) fixes.push('Removed CSS Grid properties (FlyingSaucer incompatible)')
    }

    // 6. Convert rem/em to px (approximate)
    const before = working
    working = working.replace(/(\d+(?:\.\d+)?)rem/g, (_, num) => `${Math.round(parseFloat(num) * 16)}px`)
    working = working.replace(/(\d+(?:\.\d+)?)em/g, (_, num) => `${Math.round(parseFloat(num) * 16)}px`)
    if (working !== before) fixes.push('Converted rem/em units to px')

    // 7. Ensure @page rule exists for print
    if (!working.includes('@page') && working.includes('</style>')) {
      const pageRule = `\n    @page { size: A4; margin: 15mm; }\n    @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }\n  `
      working = working.replace('</style>', `${pageRule}</style>`)
      fixes.push('Added @page print rule')
    }

    // 8. Quote unquoted attributes (basic). (?<=\s) anchors the name to a real
    // attribute position so we never re-quote "key=value" inside an already-quoted
    // value (e.g. <meta name="viewport" content="width=device-width, ..."/>), which
    // would produce invalid XML and break Flying Saucer.
    const beforeQuote = working
    working = working.replace(/(?<=\s)(\w+)=([^\s>"'{\]]+)/g, '$1="$2"')
    // Restore FreeMarker ${} inside attributes — they got quoted wrong
    // Actually the regex above shouldn't match ${...} since it stops at { — but just in case
    if (working !== beforeQuote) fixes.push('Quoted unquoted HTML attributes')

    lastFixes.value = fixes
    return { ftl: working, fixes }
  }

  return { fix, lastFixes }
}
