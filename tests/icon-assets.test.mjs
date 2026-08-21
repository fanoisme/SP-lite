import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import { NodeTypes, parse as parseDom } from '@vue/compiler-dom'
import { parse as parseSfc } from '@vue/compiler-sfc'
import {
  COMMON_ICON_SERVICE_PATTERNS,
  DIST_FORBIDDEN,
  EXTERNAL_URL_ALLOWLIST,
  SOURCE_FORBIDDEN,
  isAllowlistedExternalUrl,
  isForbiddenMaterialFontIdentifier,
  isForbiddenPublicFontPath,
  isIconAssetUrl,
  scanContent,
  scanExternalIconUrls,
} from '../scripts/check-icon-migration.mjs'
import { ICON_NAMES, FILLED_ICON_NAMES, assetFilename } from '../scripts/icon-names.mjs'

const projectRoot = fileURLToPath(new URL('../', import.meta.url))
const iconUrl = name => new URL(`../src/assets/icons/${name}`, import.meta.url)
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const sourceRoot = new URL('../src/', import.meta.url)

function npmRun(script) {
  return spawnSync(`${npm} run ${script}`, {
    cwd: projectRoot,
    encoding: 'utf8',
    stdio: 'pipe',
    shell: true,
  })
}

async function filesUnder(url, extensions) {
  const output = []
  for (const entry of await readdir(url, { withFileTypes: true })) {
    const child = new URL(`${entry.name}${entry.isDirectory() ? '/' : ''}`, url)
    if (entry.isDirectory()) output.push(...await filesUnder(child, extensions))
    else if (extensions.some(extension => entry.name.endsWith(extension))) output.push(child)
  }
  return output
}

function templateAst(source, file) {
  const { descriptor, errors } = parseSfc(source, { filename: file })
  assert.deepEqual(errors, [], `${file} must parse as a Vue SFC`)
  if (!descriptor.template) return null
  return {
    root: parseDom(descriptor.template.content),
    lineOffset: descriptor.template.loc.start.line - 1,
  }
}

function walkElements(node, visit) {
  if (node.type === NodeTypes.ELEMENT) visit(node)
  for (const child of node.children || []) walkElements(child, visit)
}

function hasProp(node, name) {
  return node.props.some(prop =>
    (prop.type === NodeTypes.ATTRIBUTE && prop.name === name)
    || (
      prop.type === NodeTypes.DIRECTIVE
      && prop.name === 'bind'
      && prop.arg?.isStatic
      && prop.arg.content === name
    ))
}

function propSource(node, name) {
  return node.props
    .filter(prop =>
      (prop.type === NodeTypes.ATTRIBUTE && prop.name === name)
      || (
        prop.type === NodeTypes.DIRECTIVE
        && prop.name === 'bind'
        && prop.arg?.isStatic
        && prop.arg.content === name
      ))
    .map(prop => prop.type === NodeTypes.ATTRIBUTE ? prop.value?.content || '' : prop.exp?.content || '')
    .join(' ')
}

function literalPropValue(node, name) {
  for (const prop of node.props) {
    if (prop.type === NodeTypes.ATTRIBUTE && prop.name === name) {
      return prop.value?.content || ''
    }
    if (
      prop.type === NodeTypes.DIRECTIVE
      && prop.name === 'bind'
      && prop.arg?.isStatic
      && prop.arg.content === name
    ) {
      return prop.exp?.content.match(/^['"]([a-z0-9_]+)['"]$/)?.[1]
    }
  }
  return undefined
}

function boundPropExpression(node, name) {
  const prop = node.props.find(candidate =>
    candidate.type === NodeTypes.DIRECTIVE
    && candidate.name === 'bind'
    && candidate.arg?.isStatic
    && candidate.arg.content === name)
  return prop?.exp?.content || ''
}

function stringLiterals(expression) {
  const values = []
  for (const match of expression.matchAll(/(['"])([a-z0-9_]+)\1/g)) {
    values.push(match[2])
  }
  return values
}

function hasDescendantTag(node, tag) {
  let found = false
  walkElements(node, child => {
    if (child !== node && child.tag === tag) found = true
  })
  return found
}

function hasVisibleControlContent(node) {
  function visible(child) {
    if (child.type === NodeTypes.TEXT) return Boolean(child.content.trim())
    if (child.type === NodeTypes.INTERPOLATION || child.type === NodeTypes.COMPOUND_EXPRESSION) return true
    if (child.type !== NodeTypes.ELEMENT) return false
    if (child.tag === 'LiIcon') return false
    if (child.tag === 'slot') return true
    return child.children.some(visible)
  }
  return node.children.some(visible)
}

function iconOnlyControlFailures(source, file, { allowTitle = true } = {}) {
  // Probes may be template fragments; full files use their SFC template block.
  const parsed = source.includes('<template')
    ? templateAst(source, file)
    : { root: parseDom(source), lineOffset: 0 }
  const failures = []
  if (!parsed) return failures

  walkElements(parsed.root, node => {
    if (node.tag !== 'button' && node.tag !== 'LiButton') return
    if (!hasDescendantTag(node, 'LiIcon') || hasVisibleControlContent(node)) return

    const hasAccessibleAttribute = hasProp(node, 'aria-label') || (allowTitle && hasProp(node, 'title'))
    if (!hasAccessibleAttribute) {
      const required = allowTitle ? 'aria-label/title' : 'aria-label'
      failures.push(`${file}:${node.loc.start.line + parsed.lineOffset} icon-only control has no ${required}`)
    }
  })
  return failures
}

function statefulIconControlFailures(source, file) {
  const parsed = templateAst(source, file)
  const failures = []
  if (!parsed) return failures
  walkElements(parsed.root, node => {
    if (node.tag !== 'button' || !hasDescendantTag(node, 'LiIcon')) return
    const classes = propSource(node, 'class')
    const hasActiveClass = /(?:active|selected)/i.test(classes)
    const isNamedToggle = /(?:^|\s)[^\s"']*toggle[^\s"']*(?:\s|$)/i.test(classes)
    if (!hasActiveClass && !isNamedToggle) return

    const pressed = propSource(node, 'aria-pressed')
    const selected = propSource(node, 'aria-selected')
    const current = propSource(node, 'aria-current')
    if (!pressed && !selected && !current) {
      failures.push(`${file}:${node.loc.start.line + parsed.lineOffset} stateful icon control has no state semantics`)
      return
    }
    if (selected && propSource(node, 'role') !== 'tab') {
      failures.push(`${file}:${node.loc.start.line + parsed.lineOffset} aria-selected control is not role=tab`)
      return
    }
    const booleanState = pressed || selected
    if (hasActiveClass && booleanState && !classes.includes(booleanState)) {
      failures.push(`${file}:${node.loc.start.line + parsed.lineOffset} state semantics do not match active class`)
    }
  })
  return failures
}

function discoverStaticIconUsage(source) {
  const outlined = new Set()
  const filled = new Set()

  if (source.includes('<template')) {
    const parsed = templateAst(source, 'icon-usage.vue')
    if (parsed) {
      walkElements(parsed.root, node => {
        if (node.tag !== 'LiIcon') return
        const literalName = literalPropValue(node, 'name')
        const nodeNames = new Set([
          ...(literalName ? [literalName] : []),
          ...stringLiterals(boundPropExpression(node, 'name')),
        ])
        for (const name of nodeNames) outlined.add(name)
        if (!nodeNames.size) return
        const filledSource = propSource(node, 'filled')
        if (hasProp(node, 'filled') && (filledSource === '' || filledSource === 'true')) {
          for (const name of nodeNames) filled.add(name)
        }
      })
    }
  }

  const literalPatterns = [
    /\biconUrl\(\s*["']([a-z0-9_]+)["']/g,
    /\bicon\s*:\s*["']([a-z0-9_]+)["']/g,
    /\bicon\s*:\s*\{[^{}]*\bdefault\s*:\s*["']([a-z0-9_]+)["']/g,
  ]
  for (const pattern of literalPatterns) {
    for (const match of source.matchAll(pattern)) outlined.add(match[1])
  }

  return { outlined, filled }
}

const SOURCE_STATIC_PROBES = Object.freeze({
  'Material Symbols class': 'class="material-symbols-outlined"',
  'Material Symbols font': "font-family: 'Material Symbols Outlined'",
  'Material Icons font': 'font-family: Material Icons',
  'inline SVG': '<svg xmlns="http://www.w3.org/2000/svg">',
  'SVG data URI': 'background: url("data:image/svg+xml,%3Csvg/%3E")',
})

const COMMON_SERVICE_PROBES = Object.freeze({
  'Google Fonts API': 'https://fonts.googleapis.com/css2?family=Inter',
  'Google Fonts static': 'https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK.woff2',
  'Iconify API': 'https://api.iconify.design/mdi/home.svg',
  'Iconify jsDelivr': 'https://cdn.jsdelivr.net/npm/@iconify/json@2/icons.json',
  'Iconify unpkg': 'https://unpkg.com/@iconify/vue@4/dist/iconify.mjs',
  'Font Awesome CDN': 'https://use.fontawesome.com/releases/v6.0.0/css/all.css',
  'Font Awesome cdnjs': 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css',
  'Material icon npm CDN (jsDelivr)': 'https://cdn.jsdelivr.net/npm/@material-symbols/svg-400/outlined/home.svg',
  'Material icon npm CDN (unpkg)': 'https://unpkg.com/@material-design-icons/svg@0.14.15/outlined/home.svg',
})

const GENERIC_EXTERNAL_ICON_PROBES = Object.freeze([
  ['reviewer icon CSS path', 'https://cdn.example.com/icons/app.css'],
  ['reviewer third-party svg', 'https://assets.example.net/branding/mark.svg'],
  ['remote woff2 font', 'https://cdn.example.com/pkg/type.woff2'],
  ['query icon keyword', 'https://api.example.com/static?icons=set-a'],
  ['icon-like hostname', 'https://icons.example.com/home'],
  ['hyphenated icon-service path', 'https://cdn.example.com/icon-service?name=home'],
])

const GENERIC_EXTERNAL_ALLOW_PROBES = Object.freeze([
  ['W3C svg namespace', 'http://www.w3.org/2000/svg'],
  ['W3C xhtml DTD', 'http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd'],
  ['Adoptium releases', 'https://adoptium.net/temurin/releases/?version=8'],
  ['Supabase placeholder', 'https://placeholder.supabase.co'],
  ['Supabase REST endpoint', 'https://project-ref.supabase.co/rest/v1/profiles'],
])

const PUBLIC_FONT_REJECT_PROBES = Object.freeze([
  'Material Symbols.woff2',
  'material   icons.ttf',
  'material-symbols.woff2',
  'material_symbols.woff2',
  'materialsymbols.woff2',
  'inter/Material Symbols.woff2',
  'inter/material-icons.woff2',
])

const PUBLIC_FONT_ALLOW_PROBES = Object.freeze([
  'inter/inter-latin-400-normal.woff2',
  'jetbrains-mono/jetbrains-mono-latin-400-normal.woff2',
  'space-grotesk/space-grotesk-latin-700-normal.woff2',
])

test('every declared outlined icon is a local SVG asset', async () => {
  for (const name of ICON_NAMES) {
    const svg = await readFile(iconUrl(assetFilename(name)), 'utf8')
    assert.match(svg, /^<svg\b/)
  }
})

test('every declared filled icon is a local SVG asset', async () => {
  for (const name of FILLED_ICON_NAMES) {
    const svg = await readFile(iconUrl(assetFilename(name, true)), 'utf8')
    assert.match(svg, /^<svg\b/)
  }
})

test('LiIcon omits the default inherited color and applies only explicit colors', async () => {
  const source = await readFile(new URL('../src/lib/components/LiIcon.vue', import.meta.url), 'utf8')
  assert.match(source, /color:\s*\{\s*type:\s*String,\s*default:\s*['"]inherit['"]\s*\}/)
  assert.match(source, /if\s*\(\s*props\.color\s*!==\s*['"]inherit['"]\s*\)/)
  assert.match(source, /style\.color\s*=\s*props\.color/)
  assert.doesNotMatch(source, /computed\(\(\)\s*=>\s*\(\{[\s\S]*?\bcolor:\s*props\.color/)
})

test('all practical static and default icon usage is declared in inventory', async () => {
  const declaredOutlined = new Set(ICON_NAMES)
  const declaredFilled = new Set(FILLED_ICON_NAMES)
  const missing = []

  for (const file of await filesUnder(sourceRoot, ['.vue', '.js'])) {
    const source = await readFile(file, 'utf8')
    const usage = discoverStaticIconUsage(source)
    for (const name of usage.outlined) {
      if (!declaredOutlined.has(name)) missing.push(`${file.pathname}: outlined ${name}`)
    }
    for (const name of usage.filled) {
      if (!declaredFilled.has(name)) missing.push(`${file.pathname}: filled ${name}`)
    }
  }

  assert.deepEqual(missing, [])
})

test('bound LiIcon name expressions contribute every string literal', () => {
  const source = `<template>
    <LiIcon :name="isDragging ? 'file_download' : 'upload_file'" />
    <LiIcon v-bind:name="isOpen ? 'expand_less' : 'expand_more'" />
  </template>`
  const usage = discoverStaticIconUsage(source)
  assert.deepEqual(
    [...usage.outlined].sort(),
    ['expand_less', 'expand_more', 'file_download', 'upload_file'],
  )
})

test('icon-only controls have an accessible name without flagging slots or visible labels', async () => {
  assert.deepEqual(iconOnlyControlFailures('<button><LiIcon name="close" /></button>', 'probe.vue'), [
    'probe.vue:1 icon-only control has no aria-label/title',
  ])
  assert.deepEqual(iconOnlyControlFailures('<button title="Close"><LiIcon name="close" /></button>', 'probe.vue'), [])
  assert.deepEqual(iconOnlyControlFailures('<button><LiIcon name="save" /> Save</button>', 'probe.vue'), [])
  assert.deepEqual(iconOnlyControlFailures('<LiButton><slot /></LiButton>', 'probe.vue'), [])

  const failures = []
  for (const file of await filesUnder(sourceRoot, ['.vue'])) {
    const source = await readFile(file, 'utf8')
    failures.push(...iconOnlyControlFailures(source, file.pathname))
  }
  assert.deepEqual(failures, [])
})

test('every icon-only control uses a descriptive aria-label', async () => {
  const failures = []
  for (const file of await filesUnder(sourceRoot, ['.vue'])) {
    const source = await readFile(file, 'utf8')
    failures.push(...iconOnlyControlFailures(source, file.pathname, { allowTitle: false }))
  }
  assert.deepEqual(failures, [])
})

test('active and toggle icon controls expose state semantics matching their active state', async () => {
  const failures = []
  for (const file of await filesUnder(sourceRoot, ['.vue'])) {
    const source = await readFile(file, 'utf8')
    failures.push(...statefulIconControlFailures(source, file.pathname))
  }
  assert.deepEqual(failures, [])
})

test('third-party notice identifies icon sources and includes complete Apache 2.0 text', async () => {
  const notice = await readFile(new URL('../public/THIRD_PARTY_LICENSES.txt', import.meta.url), 'utf8')
  const canonicalApache = await readFile(
    new URL('../node_modules/@material-symbols/svg-400/LICENSE', import.meta.url),
    'utf8',
  )
  const normalizedNotice = notice.replace(/\r\n?/g, '\n')
  const normalizedApache = canonicalApache.replace(/\r\n?/g, '\n').trim()
  assert.match(notice, /Material Symbols/i)
  assert.match(notice, /@material-symbols\/svg-400/)
  assert.match(notice, /Material Design Icons/i)
  assert.match(notice, /@material-design-icons\/svg/)
  assert.ok(normalizedNotice.includes(normalizedApache), 'complete canonical Apache 2.0 text must be present')
  assert.match(notice, /END OF TERMS AND CONDITIONS/)
})

test('icon sync fails before deleting existing assets when any source is missing', async () => {
  const fixture = await mkdtemp(join(tmpdir(), 'sp-lite-icon-sync-'))
  try {
    const scriptsDir = join(fixture, 'scripts')
    const iconsDir = join(fixture, 'src', 'assets', 'icons')
    await mkdir(scriptsDir, { recursive: true })
    await mkdir(iconsDir, { recursive: true })
    await writeFile(
      join(scriptsDir, 'sync-icon-assets.mjs'),
      await readFile(new URL('../scripts/sync-icon-assets.mjs', import.meta.url), 'utf8'),
    )
    await writeFile(
      join(scriptsDir, 'icon-names.mjs'),
      await readFile(new URL('../scripts/icon-names.mjs', import.meta.url), 'utf8'),
    )
    const sentinel = join(iconsDir, 'sentinel.svg')
    await writeFile(sentinel, '<svg data-sentinel="preserve"></svg>')

    const result = spawnSync(process.execPath, [join(scriptsDir, 'sync-icon-assets.mjs')], {
      cwd: fixture,
      encoding: 'utf8',
      stdio: 'pipe',
    })

    assert.notEqual(result.status, 0, 'missing source must fail the sync')
    assert.equal(await readFile(sentinel, 'utf8'), '<svg data-sentinel="preserve"></svg>')
  } finally {
    await rm(fixture, { recursive: true, force: true })
  }
})

test('source static forbidden patterns detect each violation (RED probes)', () => {
  for (const [label] of SOURCE_FORBIDDEN) {
    const probe = SOURCE_STATIC_PROBES[label] ?? COMMON_SERVICE_PROBES[label]
    assert.ok(probe, `missing probe for ${label}`)
    const hits = scanContent(probe, SOURCE_FORBIDDEN)
    assert.ok(hits.includes(label), `expected ${label} in ${JSON.stringify(hits)}`)
  }
})

test('dist forbidden patterns detect violations but ignore local Vite SVG data URIs', () => {
  const localViteMask = 'mask-image:url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\'/%3E")'
  assert.deepEqual(scanContent(localViteMask, DIST_FORBIDDEN), [])
  assert.deepEqual(scanExternalIconUrls(localViteMask), [])

  for (const [label] of DIST_FORBIDDEN) {
    const probe = COMMON_SERVICE_PROBES[label] ?? SOURCE_STATIC_PROBES[label]
    assert.ok(probe, `missing dist probe for ${label}`)
    const hits = scanContent(probe, DIST_FORBIDDEN)
    assert.ok(hits.includes(label), `expected dist ${label} in ${JSON.stringify(hits)}`)
  }
})

test('common icon service patterns remain in source and dist audits', () => {
  for (const [label, pattern] of COMMON_ICON_SERVICE_PATTERNS) {
    const probe = COMMON_SERVICE_PROBES[label]
    assert.match(probe, pattern, `probe must match ${label}`)
    assert.ok(SOURCE_FORBIDDEN.some(([sourceLabel]) => sourceLabel === label))
    assert.ok(DIST_FORBIDDEN.some(([distLabel]) => distLabel === label))
  }
})

test('generic external icon URL policy rejects reviewer examples (RED probes)', () => {
  for (const [label, probe] of GENERIC_EXTERNAL_ICON_PROBES) {
    assert.ok(!isAllowlistedExternalUrl(probe), `${label} must not be allowlisted`)
    assert.ok(isIconAssetUrl(probe), `${label} should be icon-asset-like`)
    assert.deepEqual(
      scanExternalIconUrls(`const href = "${probe}"`),
      [`external icon asset URL: ${probe}`],
      label,
    )
  }
})

test('generic external icon URL policy allowlists documented non-icon endpoints (GREEN probes)', () => {
  for (const [label, probe] of GENERIC_EXTERNAL_ALLOW_PROBES) {
    assert.ok(isAllowlistedExternalUrl(probe), `${label} should be allowlisted`)
    assert.deepEqual(scanExternalIconUrls(probe), [], label)
  }
  assert.ok(EXTERNAL_URL_ALLOWLIST.length >= 3)
})

test('public font matching rejects Material Symbols/Icons with arbitrary separators (RED probes)', () => {
  for (const probe of PUBLIC_FONT_REJECT_PROBES) {
    assert.ok(isForbiddenMaterialFontIdentifier(probe.split('/').pop()), probe)
    assert.ok(isForbiddenPublicFontPath(probe), probe)
  }
})

test('public font matching allows local Inter/JetBrains/Space Grotesk assets (GREEN probes)', () => {
  for (const probe of PUBLIC_FONT_ALLOW_PROBES) {
    assert.ok(!isForbiddenPublicFontPath(probe), probe)
  }
})

test('check:icons enforces fresh build plus source/dist/public-font/license audit', async () => {
  const result = npmRun('check:icons')
  assert.equal(result.status, 0, result.stderr || result.stdout)
  assert.match(result.stdout, /Local icon migration check passed/)
  const deployedNotice = await readFile(new URL('../dist/THIRD_PARTY_LICENSES.txt', import.meta.url), 'utf8')
  assert.match(deployedNotice, /Apache License[\s\S]*Version 2\.0, January 2004/)
  assert.match(deployedNotice, /END OF TERMS AND CONDITIONS/)
})
