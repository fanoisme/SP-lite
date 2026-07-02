import { ref } from 'vue'

/**
 * Processes FTL (FreeMarker) templates client-side for preview.
 * Handles: ${var}, ${var!""}, <#if>, <#list>, <#else>, <#elseif>
 * Note: This is a simplified processor for preview purposes.
 */
export function useFtlProcessor() {
  const processing = ref(false)
  const errors = ref([])

  function process(ftl, variables = {}) {
    processing.value = true
    errors.value = []

    try {
      let html = ftl

      // Remove <#ftl ...> directive
      html = html.replace(/<#ftl[^>]*>/gi, '')

      // Remove HTML comments but keep FreeMarker directives
      // (already handled since we only target specific FreeMarker tags)

      // Process <#if condition>...<#elseif condition>...<#else/>...</#if>
      html = processConditionals(html, variables)

      // Process <#list collection as item>...</#list>
      html = processLists(html, variables)

      // Replace ${varName} and ${varName!""} with values
      html = replaceVariables(html, variables)

      // Remove any remaining FreeMarker directives we can't process
      html = html.replace(/<#[^>]*>/g, '')
      html = html.replace(/<\/#[^>]*>/g, '')

      return html
    } catch (e) {
      errors.value.push(e.message)
      return ftl
    } finally {
      processing.value = false
    }
  }

  function processConditionals(html, variables) {
    // Handle nested <#if> blocks
    let result = html
    let maxIterations = 50 // Safety limit

    // Process from innermost to outermost
    while (/<#if\b/i.test(result) && maxIterations-- > 0) {
      result = result.replace(
        /<#if\s+([^>]+)>([\s\S]*?)(?:<#elseif\s+([^>]+)>([\s\S]*?))?(?:<#else\s*\/?>([\s\S]*?))?<\/#if>/gi,
        (match, condition, body, elseifCond, elseifBody, elseBody) => {
          if (evaluateCondition(condition, variables)) {
            return body || ''
          }
          if (elseifCond && evaluateCondition(elseifCond, variables)) {
            return elseifBody || ''
          }
          return elseBody || ''
        }
      )
    }

    return result
  }

  function processLists(html, variables) {
    // Handle <#list collection as item>...</#list>
    return html.replace(
      /<#list\s+(\w+)\s+as\s+(\w+)>([\s\S]*?)<\/#list>/gi,
      (match, collectionName, itemName, body) => {
        const collection = variables[collectionName]

        if (!Array.isArray(collection)) {
          // If not an array, try to parse it as a comma-separated string
          if (typeof collection === 'string' && collection.includes(',')) {
            return collection.split(',').map((item, index) => {
              let rendered = body
              rendered = rendered.replace(new RegExp(`\\$\\{${itemName}\\}`, 'g'), item.trim())
              rendered = rendered.replace(/\$\{item_index\}/g, String(index))
              rendered = rendered.replace(/\$\{item_has_next\}/g, index < collection.split(',').length - 1 ? 'true' : 'false')
              return rendered
            }).join('')
          }
          return '' // Empty collection
        }

        return collection.map((item, index) => {
          let rendered = body
          if (typeof item === 'object') {
            // Replace ${item.property} patterns
            rendered = rendered.replace(/\$\{(\w+)\.(\w+)\}/g, (m, objName, prop) => {
              if (objName === itemName) {
                return escapeHtml(String(item[prop] || ''))
              }
              return m
            })
            // Replace ${item} itself
            rendered = rendered.replace(new RegExp(`\\$\\{${itemName}\\}`, 'g'), escapeHtml(String(item)))
          } else {
            rendered = rendered.replace(new RegExp(`\\$\\{${itemName}\\}`, 'g'), escapeHtml(String(item)))
          }
          rendered = rendered.replace(/\$\{(\w+)_index\}/g, (_, name) => {
            return name === itemName ? String(index) : `$${name}_index`
          })
          rendered = rendered.replace(/\$\{(\w+)_has_next\}/g, (_, name) => {
            return name === itemName ? (index < collection.length - 1 ? 'true' : 'false') : `$${name}_has_next`
          })
          return rendered
        }).join('')
      }
    )
  }

  function evaluateCondition(condition, variables) {
    const trimmed = condition.trim()

    // Simple variable check: <#if varName>
    if (/^[a-zA-Z_]\w*$/.test(trimmed)) {
      const val = variables[trimmed]
      return val !== undefined && val !== null && val !== '' && val !== false && val !== 0
    }

    // Negation: <#if !varName>
    if (/^![a-zA-Z_]\w*$/.test(trimmed)) {
      const varName = trimmed.slice(1)
      const val = variables[varName]
      return !val || val === '' || val === false || val === 0
    }

    // Equality: <#if varName == "value">
    const eqMatch = trimmed.match(/^(\w+)\s*==\s*["']([^"']*)["']$/)
    if (eqMatch) {
      return String(variables[eqMatch[1]] || '') === eqMatch[2]
    }

    // Inequality: <#if varName != "value">
    const neqMatch = trimmed.match(/^(\w+)\s*!=\s*["']([^"']*)["']$/)
    if (neqMatch) {
      return String(variables[neqMatch[1]] || '') !== neqMatch[2]
    }

    // Has content: <#if varName?has_content>
    const hasContentMatch = trimmed.match(/^(\w+)\?has_content$/)
    if (hasContentMatch) {
      const val = variables[hasContentMatch[1]]
      return val !== undefined && val !== null && val !== ''
    }

    // Size check: <#if collection?size > 0>
    const sizeMatch = trimmed.match(/^(\w+)\?size\s*>\s*(\d+)$/)
    if (sizeMatch) {
      const val = variables[sizeMatch[1]]
      if (Array.isArray(val)) return val.length > parseInt(sizeMatch[2])
      if (typeof val === 'string') return val.length > parseInt(sizeMatch[2])
      return false
    }

    // Default: treat as truthy check
    const val = variables[trimmed]
    return val !== undefined && val !== null && val !== '' && val !== false && val !== 0
  }

  function replaceVariables(html, variables) {
    return html.replace(/\$\{([a-zA-Z_][a-zA-Z0-9_.]*(?:![^}]*)?)\}/g, (fullMatch, expr) => {
      const name = expr.split(/[!?\.]/)[0].trim()
      const value = variables[name]

      if (value !== undefined && value !== null && value !== '') {
        return escapeHtml(String(value))
      }

      // Handle default: ${varName!"default"}
      const defaultMatch = expr.match(/^[^!]+!"([^"]*)"$/)
      if (defaultMatch) return escapeHtml(defaultMatch[1])

      const defaultMatch2 = expr.match(/^[^!]+!'([^']*)'$/)
      if (defaultMatch2) return escapeHtml(defaultMatch2[1])

      return ''
    })
  }

  function escapeHtml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;')
  }

  return { process, processing, errors }
}
