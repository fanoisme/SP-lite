// Lucide icon registry — names are Lucide's own (kebab-case), matching
// node_modules/lucide-static/icons/<name>.svg verbatim. This list is
// exactly what SP-lite uses. Add a name here, then `npm run icons:sync`.
export const ICON_NAMES = Object.freeze([
  'a-large-small', 'align-center', 'align-justify', 'align-left', 'align-right',
  'arrow-down', 'arrow-left', 'arrow-right', 'arrow-up', 'at-sign',
  'badge', 'barcode', 'bold', 'boxes', 'braces',
  'calendar', 'check', 'chevron-down', 'chevron-left', 'chevron-right',
  'circle-check', 'circle-user', 'circle-x', 'clapperboard', 'clipboard',
  'clock', 'cloud-upload', 'code', 'columns-3', 'construction',
  'copy', 'download', 'eraser', 'eye', 'file-check',
  'file-text', 'file-type', 'file-up', 'file-video', 'filter',
  'filter-x', 'flag', 'folder-tree', 'frame', 'hard-drive',
  'history', 'hourglass', 'inbox', 'info', 'italic',
  'key', 'landmark', 'layout-dashboard', 'layout-grid', 'lock',
  'log-out', 'mail', 'menu', 'minus', 'moon',
  'notebook-pen', 'palette', 'pencil', 'play', 'plus',
  'qr-code', 'refresh-cw', 'refresh-cw-off', 'rotate-ccw', 'rotate-cw',
  'rows-3', 'save', 'scaling', 'scan-line', 'search',
  'server', 'share', 'shield', 'shield-user', 'sliders-horizontal',
  'sparkle', 'sparkles', 'square-x', 'store', 'sun',
  'tag', 'terminal', 'trash-2', 'triangle-alert', 'type',
  'underline', 'unfold-vertical', 'upload', 'user', 'user-plus',
  'users', 'video', 'wand-sparkles', 'x', 'zap',
])

export function assetFilename(name) {
  return `${name}.svg`
}
