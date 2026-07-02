/**
 * Detects FreeMarker ${variable} patterns in HTML/FTL templates.
 * Supports: ${varName}, ${varName!""}, ${varName!?string}, ${obj.property}
 */
export function useVariableDetector() {
  function detect(template) {
    if (!template) return []

    // Match ${...} patterns, handling FreeMarker default values
    const regex = /\$\{([a-zA-Z_][a-zA-Z0-9_.]*(?:![^}]*)?)\}/g
    const vars = new Map()
    let match

    while ((match = regex.exec(template)) !== null) {
      const fullExpr = match[1]
      // Extract just the variable name (before ! or .)
      const name = fullExpr.split(/[!?\.]/)[0].trim()

      if (name && !vars.has(name)) {
        vars.set(name, { name, value: '' })
      }
    }

    return Array.from(vars.values())
  }

  return { detect }
}
