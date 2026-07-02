/**
 * Injects variable values into HTML/FTL templates for preview.
 * Handles ${varName}, ${varName!""}, ${varName!?string}, ${obj.property}
 */
export function useTemplatePreview() {
  function inject(template, variables = {}, { wrapVars = false } = {}) {
    if (!template) return ''

    let result = template

    // Replace ${varName} and ${varName!""} with values
    result = result.replace(/\$\{([a-zA-Z_][a-zA-Z0-9_.]*(?:![^}]*)?)\}/g, (fullMatch, expr) => {
      const name = expr.split(/[!?\.]/)[0].trim()
      const value = variables[name]

      let display
      if (value !== undefined && value !== null && value !== '') {
        display = escapeHtml(String(value))
      } else {
        // Check for default value pattern: ${varName!"default"}
        const defaultMatch = expr.match(/^[^!]+!"([^"]*)"$/)
        if (defaultMatch) {
          display = escapeHtml(defaultMatch[1])
        } else {
          // Check for default with single quotes: ${varName!'default'}
          const defaultMatch2 = expr.match(/^[^!]+!'([^']*)'$/)
          display = defaultMatch2 ? escapeHtml(defaultMatch2[1]) : ''
        }
      }

      if (wrapVars) {
        return `<span data-sop-var="${escapeHtml(name)}">${display}</span>`
      }
      return display
    })

    return result
  }

  function escapeHtml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;')
  }

  return { inject }
}
