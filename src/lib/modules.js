// SP-lite — module registry. Single source of truth for which modules exist
// + their sub-features. Mirrors SO-Platform's server/lib/modules.js, trimmed
// to the modules this app actually ships. The DB seeds in supabase/schema.sql
// reference these exact ids.

export const MODULE_REGISTRY = [
  {
    id: 'dashboard', label: 'Dashboard', icon: 'dashboard', path: '/dashboard',
    desc: 'Overview and quick links to your tools.',
    features: [],
  },
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
    id: 'qrdd', label: 'QR DD', icon: 'database', path: '/qrdd',
    desc: 'Manage BU accounts, merchant whitelist, and promo rules.',
    features: [
      { id: 'bu-accounts.read',   label: 'BU Accounts — Read',   desc: 'View BU account list.' },
      { id: 'bu-accounts.create', label: 'BU Accounts — Create', desc: 'Add new BU accounts.' },
      { id: 'bu-accounts.update', label: 'BU Accounts — Update', desc: 'Edit existing BU accounts.' },
      { id: 'bu-accounts.delete', label: 'BU Accounts — Delete', desc: 'Delete BU accounts.' },
      { id: 'merchant-whitelist.read',   label: 'Merchant Whitelist — Read',   desc: 'View merchant whitelist.' },
      { id: 'merchant-whitelist.create', label: 'Merchant Whitelist — Create', desc: 'Add new merchants.' },
      { id: 'merchant-whitelist.update', label: 'Merchant Whitelist — Update', desc: 'Edit existing merchants.' },
      { id: 'merchant-whitelist.delete', label: 'Merchant Whitelist — Delete', desc: 'Delete merchants.' },
      { id: 'promo-rule.read',   label: 'Promo Rule — Read',   desc: 'View promo rules.' },
      { id: 'promo-rule.create', label: 'Promo Rule — Create', desc: 'Add new promo rules.' },
      { id: 'promo-rule.update', label: 'Promo Rule — Update', desc: 'Edit existing promo rules.' },
      { id: 'promo-rule.delete', label: 'Promo Rule — Delete', desc: 'Delete promo rules.' },
    ],
  },
  {
    id: 'dd', label: 'DD MPM', icon: 'inventory', path: '/dd',
    desc: 'Business units, merchants, promo rules, audit and exports.',
    features: [
      { id: 'bu-accounts.read',   label: 'BU Accounts — Read',   desc: 'View business unit accounts.' },
      { id: 'bu-accounts.create', label: 'BU Accounts — Create', desc: 'Add business unit accounts.' },
      { id: 'bu-accounts.update', label: 'BU Accounts — Update', desc: 'Edit business unit accounts.' },
      { id: 'bu-accounts.delete', label: 'BU Accounts — Delete', desc: 'Delete business unit accounts.' },
      { id: 'merchants.read',   label: 'Merchants — Read',   desc: 'View the merchant whitelist.' },
      { id: 'merchants.create', label: 'Merchants — Create', desc: 'Add merchants to the whitelist.' },
      { id: 'merchants.update', label: 'Merchants — Update', desc: 'Edit whitelisted merchants.' },
      { id: 'merchants.delete', label: 'Merchants — Delete', desc: 'Remove merchants from the whitelist.' },
      { id: 'promos.read',   label: 'Promos — Read',   desc: 'View promo rules.' },
      { id: 'promos.create', label: 'Promos — Create', desc: 'Add promo rules.' },
      { id: 'promos.update', label: 'Promos — Update', desc: 'Edit promo rules.' },
      { id: 'promos.delete', label: 'Promos — Delete', desc: 'Delete promo rules.' },
      { id: 'audit.read',  label: 'Audit Log', desc: 'Browse who changed what, when.' },
      { id: 'export.read', label: 'Export',    desc: 'Export SQL and XLSX.' },
      { id: 'tables.read',   label: 'Tables — Browse', desc: 'Browse raw tables.' },
      { id: 'tables.update', label: 'Tables — Edit',   desc: 'Edit rows inline in the raw table browser.' },
      { id: 'sql.read',  label: 'SQL — Query', desc: 'Run SELECT queries.' },
      { id: 'sql.write', label: 'SQL — Write',  desc: 'Run INSERT/UPDATE/DELETE that rewrite a table.' },
      { id: 'email.read',   label: 'Email Settings — Read',   desc: 'View scheduled email settings.' },
      { id: 'email.update', label: 'Email Settings — Update', desc: 'Edit and send scheduled emails.' },
      // Database axis. DD grants raw-table and SQL-editor access per database,
      // independently of the menu features above, so someone can be given
      // ihybrid_order alone without ihybrid_discount.
      { id: 'db.ihybrid_order.read',   label: 'DB ihybrid_order — Read',   desc: 'Browse raw tables in ihybrid_order.' },
      { id: 'db.ihybrid_order.create', label: 'DB ihybrid_order — Create', desc: 'Insert rows into ihybrid_order tables.' },
      { id: 'db.ihybrid_order.update', label: 'DB ihybrid_order — Update', desc: 'Edit rows in ihybrid_order tables.' },
      { id: 'db.ihybrid_order.delete', label: 'DB ihybrid_order — Delete', desc: 'Delete rows from ihybrid_order tables.' },
      { id: 'db.ihybrid_discount.read',   label: 'DB ihybrid_discount — Read',   desc: 'Browse raw tables in ihybrid_discount.' },
      { id: 'db.ihybrid_discount.create', label: 'DB ihybrid_discount — Create', desc: 'Insert rows into ihybrid_discount tables.' },
      { id: 'db.ihybrid_discount.update', label: 'DB ihybrid_discount — Update', desc: 'Edit rows in ihybrid_discount tables.' },
      { id: 'db.ihybrid_discount.delete', label: 'DB ihybrid_discount — Delete', desc: 'Delete rows from ihybrid_discount tables.' },
    ],
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
