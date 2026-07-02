/**
 * useRipple — composable for Material-style click ripple effects
 *
 * Usage:
 *   const { addRipple } = useRipple({ color: 'currentColor', opacity: 0.2 })
 *   // In a pointerdown handler:
 *   addRipple(event, elementRef)
 */

const REDUCED_MOTION = typeof window !== 'undefined'
  ? window.matchMedia('(prefers-reduced-motion: reduce)')
  : { matches: false }

/**
 * @param {Object} options
 * @param {string} options.color - Ripple color (default: 'currentColor')
 * @param {number} options.opacity - Peak opacity (default: 0.2)
 * @param {boolean} options.centered - Always expand from center (default: false)
 * @param {boolean} options.disabled - Disable ripple (default: false)
 * @returns {{ addRipple: (event: PointerEvent, container: HTMLElement) => void }}
 */
export function useRipple(options = {}) {
  const config = {
    color: options.color ?? 'currentColor',
    opacity: options.opacity ?? 0.2,
    centered: options.centered ?? false,
    disabled: options.disabled ?? false,
  }

  function addRipple(event, container) {
    if (config.disabled || REDUCED_MOTION.matches) return
    if (!container) return

    const rect = container.getBoundingClientRect()
    const size = Math.max(rect.width, rect.height) * 2

    let x, y
    if (config.centered) {
      x = rect.width / 2 - size / 2
      y = rect.height / 2 - size / 2
    } else {
      x = (event.clientX ?? event.touches?.[0]?.clientX ?? rect.left + rect.width / 2) - rect.left - size / 2
      y = (event.clientY ?? event.touches?.[0]?.clientY ?? rect.top + rect.height / 2) - rect.top - size / 2
    }

    const wave = document.createElement('span')
    wave.className = 'li-ripple__wave'
    wave.style.width = wave.style.height = `${size}px`
    wave.style.left = `${x}px`
    wave.style.top = `${y}px`
    wave.style.setProperty('--ripple-opacity', String(config.opacity))
    wave.style.background = config.color

    container.appendChild(wave)

    // Remove after expand (500ms) + fade (300ms) = 800ms
    setTimeout(() => {
      if (wave.parentNode) wave.parentNode.removeChild(wave)
    }, 800)
  }

  return { addRipple }
}
