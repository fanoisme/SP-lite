// Icon governance for the Allo restyle: Lucide-only, local assets only.
// Keeps the original armour (no icon fonts, no icon CDNs, no stray inline
// SVG outside the mascot) and audits the third-party notices for the two
// things actually shipped: lucide-static (ISC) and Inter (SIL OFL).
import { spawnSync } from 'node:child_process'
import { access, readdir, readFile } from 'node:fs/promises'
import { extname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const rootDir = fileURLToPath(new URL('../', import.meta.url))
const scannedExtensions = new Set(['.vue', '.js', '.css', '.html'])
const distExtensions = new Set(['.js', '.css', '.html'])
const HTTP_URL_RE = /https?:\/\/[^\s"'`<>)}\]]+/gi

export const EXTERNAL_URL_ALLOWLIST = Object.freeze([
  ['W3C namespaces and DTDs', /^https?:\/\/www\.w3\.org\//i],
  ['Adoptium Temurin releases page', /^https:\/\/adoptium\.net\/temurin\/releases/i],
  ['Supabase placeholder/API', /^https:\/\/(?:[\w-]+\.)*supabase\.co(?:\/|$|\?)/i],
  ['Lucide icon source comment', /^https:\/\/lucide\.dev\//i],
  ['Inter upstream (rsms)', /^https:\/\/rsms\.me\/inter\//i],
])

export const COMMON_ICON_SERVICE_PATTERNS = Object.freeze([
  ['Google Fonts API', /fonts\.googleapis\.com/i],
  ['Google Fonts static', /fonts\.gstatic\.com/i],
  ['Iconify API', /(?:api\.)?iconify\.design/i],
  ['Iconify jsDelivr', /cdn\.jsdelivr\.net\/npm\/@iconify/i],
  ['Iconify unpkg', /unpkg\.com\/@iconify/i],
  ['Font Awesome CDN', /(?:use\.)?fontawesome\.com/i],
  ['Font Awesome cdnjs', /cdnjs\.cloudflare\.com\/ajax\/libs\/font-awesome/i],
  ['Material icon npm CDN (jsDelivr)', /cdn\.jsdelivr\.net\/npm\/(?:@material-symbols|@material-design-icons|material-symbols|material-icons)/i],
  ['Material icon npm CDN (unpkg)', /unpkg\.com\/(?:@material-symbols|@material-design-icons|material-symbols|material-icons)/i],
])

// The mascot is a hand-drawn component with its own inline SVG; inline SVG
// anywhere else is still how icon-font regressions sneak back in.
const INLINE_SVG_EXEMPT = /LiMascot\.vue$/

export const SOURCE_FORBIDDEN = Object.freeze([
  ['Material Symbols class', /material-symbols-outlined/],
  ['Material Symbols font', /Material Symbols(?: Outlined| Outlined Variable)?/i],
  ['Material Icons font', /Material Icons/i],
  ['inline SVG', /<svg\b/i],
  ['SVG data URI', /data:image\/svg\+xml/i],
  ...COMMON_ICON_SERVICE_PATTERNS,
])

export const DIST_FORBIDDEN = Object.freeze([
  ['Material Symbols class', /material-symbols-outlined/],
  ['Material Symbols font', /Material Symbols(?: Outlined| Outlined Variable)?/i],
  ['Material Icons font', /Material Icons/i],
  ...COMMON_ICON_SERVICE_PATTERNS,
])

export function cleanExtractedUrl(raw) {
  return raw.replace(/[\\),.;]+$/, '')
}

export function isAllowlistedExternalUrl(url) {
  const cleaned = cleanExtractedUrl(url)
  return EXTERNAL_URL_ALLOWLIST.some(([, pattern]) => pattern.test(cleaned))
}

const ICON_TOKEN_RE = /^(?:icons?|glyphs?|symbols?)$/
const ICON_FONT_EXTENSION_RE = /\.(?:svg|woff2?|ttf|otf|eot)(?:[?#]|$)/i

function splitIconTokens(value) {
  return String(value || '').toLowerCase().split(/[\s_.-]+/).filter(Boolean)
}

function partHasIconKeyword(value) {
  return splitIconTokens(value).some(token => ICON_TOKEN_RE.test(token))
}

export function isIconAssetUrl(url) {
  let parsed
  try {
    parsed = new URL(cleanExtractedUrl(url))
  } catch {
    return false
  }

  const fullTarget = `${parsed.hostname}${parsed.pathname}${parsed.search}${parsed.hash}`

  if (ICON_FONT_EXTENSION_RE.test(fullTarget)) return true

  for (const label of parsed.hostname.split('.')) {
    if (partHasIconKeyword(label)) return true
  }
  for (const segment of parsed.pathname.split('/')) {
    if (segment && partHasIconKeyword(segment)) return true
  }
  const query = parsed.search.slice(1)
  if (query) {
    for (const chunk of query.split(/[&=#]/)) {
      if (chunk && partHasIconKeyword(chunk)) return true
    }
  }
  const hash = parsed.hash.slice(1)
  if (hash && partHasIconKeyword(hash)) return true

  return false
}

export function extractHttpUrls(content) {
  const urls = []
  const seen = new Set()
  for (const match of content.matchAll(HTTP_URL_RE)) {
    const url = cleanExtractedUrl(match[0])
    if (!seen.has(url)) {
      seen.add(url)
      urls.push(url)
    }
  }
  return urls
}

export function scanExternalIconUrls(content) {
  const failures = []
  for (const url of extractHttpUrls(content)) {
    if (isAllowlistedExternalUrl(url)) continue
    if (isIconAssetUrl(url)) failures.push(`external icon asset URL: ${url}`)
  }
  return failures
}

export function scanContent(content, patterns) {
  const failures = []
  for (const [label, pattern] of patterns) {
    if (pattern.test(content)) failures.push(label)
  }
  return failures
}

async function filesUnder(url, extensions) {
  const output = []
  let entries
  try {
    entries = await readdir(url, { withFileTypes: true })
  } catch {
    return output
  }
  for (const entry of entries) {
    const child = new URL(`${entry.name}${entry.isDirectory() ? '/' : ''}`, url)
    if (entry.isDirectory()) output.push(...await filesUnder(child, extensions))
    else if (extensions.has(extname(entry.name))) output.push(child)
  }
  return output
}

export function runProductionBuild() {
  const viteBin = resolve(rootDir, 'node_modules/vite/bin/vite.js')
  return spawnSync(process.execPath, [viteBin, 'build'], {
    cwd: rootDir,
    encoding: 'utf8',
    stdio: 'pipe',
  })
}

function auditText(content, scope, patterns, file = '') {
  const failures = []
  if (INLINE_SVG_EXEMPT.test(file)) {
    patterns = patterns.filter(([label]) => label !== 'inline SVG' && label !== 'SVG data URI')
  }
  for (const label of scanContent(content, patterns)) {
    failures.push(`${scope} ${label}`)
  }
  for (const label of scanExternalIconUrls(content)) {
    failures.push(`${scope} ${label}`)
  }
  return failures
}

export async function auditSource() {
  const failures = []
  const files = [
    new URL('../index.html', import.meta.url),
    ...await filesUnder(new URL('../src/', import.meta.url), scannedExtensions),
  ]
  for (const file of files) {
    const source = await readFile(file, 'utf8')
    for (const msg of auditText(source, 'source', SOURCE_FORBIDDEN, file.pathname)) {
      failures.push(`${msg}: ${file.pathname}`)
    }
  }
  return failures
}

export async function auditDist() {
  const failures = []
  const distRoot = new URL('../dist/', import.meta.url)
  try {
    await access(distRoot)
  } catch {
    return ['dist output missing — production build did not produce dist/']
  }

  const files = await filesUnder(distRoot, distExtensions)
  if (!files.length) {
    failures.push('dist output contains no HTML/JS/CSS artifacts to audit')
    return failures
  }

  for (const file of files) {
    const source = await readFile(file, 'utf8')
    for (const msg of auditText(source, 'dist', DIST_FORBIDDEN)) {
      failures.push(`${msg}: ${file.pathname}`)
    }
  }
  return failures
}

async function auditLicenseFile(url, scope, canonicalIsc) {
  let notice
  try {
    notice = await readFile(url, 'utf8')
  } catch {
    return [`${scope} THIRD_PARTY_LICENSES.txt is missing`]
  }

  const failures = []
  const normalizedNotice = notice.replace(/\r\n?/g, '\n')
  const normalizedIsc = canonicalIsc.replace(/\r\n?/g, '\n').trim()
  if (!notice.includes('lucide-static') || !/Lucide/i.test(notice)) {
    failures.push(`${scope} third-party notice does not identify Lucide`)
  }
  if (!notice.includes('Inter') || !/SIL Open Font License/i.test(notice)) {
    failures.push(`${scope} third-party notice does not identify Inter (OFL)`)
  }
  if (!normalizedNotice.includes(normalizedIsc)) {
    failures.push(`${scope} third-party notice does not contain the complete ISC licence text`)
  }
  return failures
}

export async function auditThirdPartyLicenses() {
  const canonicalIsc = await readFile(
    new URL('../node_modules/lucide-static/LICENSE', import.meta.url),
    'utf8',
  )
  return [
    ...await auditLicenseFile(
      new URL('../public/THIRD_PARTY_LICENSES.txt', import.meta.url),
      'public',
      canonicalIsc,
    ),
    ...await auditLicenseFile(
      new URL('../dist/THIRD_PARTY_LICENSES.txt', import.meta.url),
      'dist',
      canonicalIsc,
    ),
  ]
}

export async function runAudit({ skipBuild = false } = {}) {
  const failures = []
  if (!skipBuild) {
    console.log('Building fresh production bundle for icon audit…')
    const build = runProductionBuild()
    if (build.status !== 0) {
      return [`production build failed:\n${build.stderr || build.stdout}`]
    }
  }

  failures.push(...await auditSource())
  failures.push(...await auditDist())
  failures.push(...await auditThirdPartyLicenses())
  return failures
}

const isMain = process.argv[1]
  && pathToFileURL(process.argv[1]).href === import.meta.url

if (isMain) {
  const failures = await runAudit()
  if (failures.length) {
    console.error(failures.join('\n'))
    process.exitCode = 1
  } else {
    console.log('Lucide icon check passed (source, fresh dist, third-party licenses)')
  }
}
