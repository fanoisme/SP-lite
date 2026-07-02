// SP-lite — module registry. Single source of truth for which modules exist
// + their sub-features. Mirrors SO-Platform's server/lib/modules.js, trimmed
// to the modules this app actually ships. The DB seeds in supabase/schema.sql
// reference these exact ids.

export const MODULE_REGISTRY = [
  {
    id: 'qris', label: 'QRIS Tools', icon: 'qr_code_2', path: '/qris',
    desc: 'Generate, read, and review QRIS codes.',
    features: [
      { id: 'generator', label: 'Generator', desc: 'Build EMVCo QR + CRC.' },
      { id: 'reader',    label: 'Reader',    desc: 'Parse QR image into TLV tags.' },
      { id: 'history',   label: 'History',   desc: 'Persisted list of generated QRIS.' },
    ],
  },
  {
    id: 'template-tools', label: 'Template Tools', icon: 'auto_awesome', path: '/template-tools',
    desc: 'Convert DOCX to HTML/FTL and preview output.',
    features: [
      { id: 'docx-to-html', label: 'DOCX → HTML', desc: 'Convert DOCX template to HTML.' },
      { id: 'html-to-ftl',  label: 'HTML → FTL',  desc: 'Convert HTML to FreeMarker template.' },
      { id: 'html-preview', label: 'HTML Preview', desc: 'Preview HTML with variables.' },
      { id: 'ftl-preview',  label: 'FTL Preview',  desc: 'Render FTL to PDF.' },
    ],
  },
  {
    id: 'video-frames', label: 'Video Frames', icon: 'movie', path: '/video-frames',
    desc: 'Extract distinct frames from a video clip.',
    features: [],
  },
  {
    id: 'admin', label: 'Admin Panel', icon: 'admin_panel_settings', path: '/admin',
    desc: 'Manage users, roles, and module access.',
    features: [],
  },
]

export function getAllModules() {
  return MODULE_REGISTRY
}

export function getModuleIds() {
  return MODULE_REGISTRY.map(m => m.id)
}
