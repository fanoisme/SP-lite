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
  isIconAssetUrl,
  scanContent,
  scanExternalIconUrls,
} from '../scripts/check-icon-migration.mjs'
import { ICON_NAMES, assetFilename } from '../scripts/icon-names.mjs'

const projectRoot = fileURLToPath(new URL('../', import.meta.url))
const iconUrl = name => new URL(`../src/assets/icons/${name}`, import.meta.url)
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const sourceRoot = new URL('../src/', import.meta.url)
const NAME_RE = /^[a-z0-9-]+$/

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
      return prop.exp?.content.match(/^['"]([a-z0-9_-]+)['"]$/)?.[1]
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
  for (const match of expression.matchAll(/(['"])([a-z0-9_-]+)\1/g)) {
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
  const used = new Set()

  if (source.includes('<template')) {
    const parsed = templateAst(source, 'icon-usage.vue')
    if (parsed) {
      walkElements(parsed.root, node => {
        if (node.tag !== 'LiIcon') return
        const literalName = literalPropValue(node, 'name')
        if (literalName) used.add(literalName)
        for (const name of stringLiterals(boundPropExpression(node, 'name'))) used.add(name)
        assert.equal(propSource(node, 'filled'), '', 'filled prop was removed with the Lucide migration')
      })
    }
  }

  const literalPatterns = [
    /\biconUrl\(\s*["']([a-z0-9-]+)["']/g,
    /\bicon\s*:\s*["']([a-z0-9-]+)["']/g,
    /\bicon\s*:\s*\{[^{}]*\bdefault\s*:\s*["']([a-z0-9-]+)["']/g,
  ]
  for (const pattern of literalPatterns) {
    for (const match of source.matchAll(pattern)) used.add(match[1])
  }

  return used
}

test('registry declares Lucide names, and every one is a local SVG asset', async () => {
  assert.ok(ICON_NAMES.length >= 90, 'registry should carry the full used set')
  for (const name of ICON_NAMES) {
    assert.match(name, NAME_RE, 'kebab-case Lucide name')
    const svg = await readFile(iconUrl(assetFilename(name)), 'utf8')
    assert.match(svg, /<svg\b/)
    // Lucide glyphs are stroke-based: fill must stay none.
    assert.match(svg, /fill="none"/, `${name} must keep fill="none"`)
    assert.match(svg, /stroke="currentColor"/, `${name} must carry stroke="currentColor"`)
  }
})

test('icons directory holds exactly the registry, nothing else', async () => {
  const onDisk = (await readdir(iconUrl('.')))
    .filter(f => f.endsWith('.svg'))
    .map(f => f.replace(/\.svg$/, ''))
    .sort()
  assert.deepEqual(onDisk, [...ICON_NAMES].sort())
})

test('all static icon usage is declared in the registry', async () => {
  const declared = new Set(ICON_NAMES)
  const missing = []
  for (const file of await filesUnder(sourceRoot, ['.vue', '.js'])) {
    const source = await readFile(file, 'utf8')
    for (const name of discoverStaticIconUsage(source)) {
      if (!declared.has(name)) missing.push(`${file.pathname}: ${name}`)
    }
  }
  assert.deepEqual(missing, [])
})

test('bound LiIcon name expressions contribute every string literal', () => {
  const source = `<template>
    <LiIcon :name="isDragging ? 'file-check' : 'file-up'" />
    <LiIcon v-bind:name="isOpen ? 'chevron-up' : 'chevron-down'" />
  </template>`
  const usage = discoverStaticIconUsage(source)
  assert.deepEqual(
    [...usage].sort(),
    ['chevron-down', 'chevron-up', 'file-check', 'file-up'],
  )
})

test('icon-only controls have an accessible name without flagging slots or visible labels', async () => {
  assert.deepEqual(iconOnlyControlFailures('<button><LiIcon name="x" /></button>', 'probe.vue'), [
    'probe.vue:1 icon-only control has no aria-label/title',
  ])
  assert.deepEqual(iconOnlyControlFailures('<button title="Close"><LiIcon name="x" /></button>', 'probe.vue'), [])
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

test('third-party notice identifies Lucide and Inter with the complete ISC text', async () => {
  const notice = await readFile(new URL('../public/THIRD_PARTY_LICENSES.txt', import.meta.url), 'utf8')
  const canonicalIsc = await readFile(
    new URL('../node_modules/lucide-static/LICENSE', import.meta.url),
    'utf8',
  )
  const normalizedNotice = notice.replace(/\r\n?/g, '\n')
  const normalizedIsc = canonicalIsc.replace(/\r\n?/g, '\n')
  assert.match(notice, /Lucide/i)
  assert.match(notice, /lucide-static/)
  assert.match(notice, /Inter/)
  assert.match(notice, /SIL Open Font License/i)
  assert.ok(normalizedNotice.includes(normalizedIsc), 'complete canonical ISC text must be present')
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

    assert.notEqual(result.status, 0, 'missing lucide-static must fail the sync')
    assert.equal(await readFile(sentinel, 'utf8'), '<svg data-sentinel="preserve"></svg>')
  } finally {
    await rm(fixture, { recursive: true, force: true })
  }
})

test('source forbidden patterns detect each violation (RED probes)', () => {
  const probes = {
    'Material Symbols class': 'class="material-symbols-outlined"',
    'Material Symbols font': "font-family: 'Material Symbols Outlined'",
    'Material Icons font': 'font-family: Material Icons',
    'inline SVG': '<svg xmlns="http://www.w3.org/2000/svg">',
    'SVG data URI': 'background: url("data:image/svg+xml,%3Csvg/%3E")',
    'Google Fonts API': 'https://fonts.googleapis.com/css2?family=Inter',
    'Google Fonts static': 'https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK.woff2',
    'Iconify API': 'https://api.iconify.design/mdi/home.svg',
    'Iconify jsDelivr': 'https://cdn.jsdelivr.net/npm/@iconify/json@2/icons.json',
    'Iconify unpkg': 'https://unpkg.com/@iconify/vue@4/dist/iconify.mjs',
    'Font Awesome CDN': 'https://use.fontawesome.com/releases/v6.0.0/css/all.css',
    'Font Awesome cdnjs': 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css',
    'Material icon npm CDN (jsDelivr)': 'https://cdn.jsdelivr.net/npm/@material-symbols/svg-400/outlined/home.svg',
    'Material icon npm CDN (unpkg)': 'https://unpkg.com/@material-design-icons/svg@0.14.15/outlined/home.svg',
  }
  for (const [label, pattern] of SOURCE_FORBIDDEN) {
    const probe = probes[label]
    assert.ok(probe, `missing probe for ${label}`)
    const hits = scanContent(probe, SOURCE_FORBIDDEN)
    assert.ok(hits.includes(label), `expected ${label} in ${JSON.stringify(hits)}`)
  }
})

test('dist forbidden patterns detect violations but ignore local Vite SVG data URIs', () => {
  const localViteMask = 'mask-image:url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\'/%3E")'
  assert.deepEqual(scanContent(localViteMask, DIST_FORBIDDEN), [])
  assert.deepEqual(scanExternalIconUrls(localViteMask), [])

  const probes = {
    'Material Symbols class': 'class="material-symbols-outlined"',
    'Material Symbols font': "font-family: 'Material Symbols Outlined'",
    'Google Fonts API': 'https://fonts.googleapis.com/css2?family=Inter',
    'Material icon npm CDN (unpkg)': 'https://unpkg.com/@material-design-icons/svg@0.14.15/outlined/home.svg',
  }
  for (const [label] of DIST_FORBIDDEN) {
    const probe = probes[label]
    if (!probe) continue
    const hits = scanContent(probe, DIST_FORBIDDEN)
    assert.ok(hits.includes(label), `expected dist ${label} in ${JSON.stringify(hits)}`)
  }
})

test('common icon service patterns remain in source and dist audits', () => {
  for (const [label] of COMMON_ICON_SERVICE_PATTERNS) {
    assert.ok(SOURCE_FORBIDDEN.some(([sourceLabel]) => sourceLabel === label))
    assert.ok(DIST_FORBIDDEN.some(([distLabel]) => distLabel === label))
  }
})

test('generic external icon URL policy rejects reviewer examples (RED probes)', () => {
  const probes = [
    'https://cdn.example.com/icons/app.css',
    'https://assets.example.net/branding/mark.svg',
    'https://cdn.example.com/pkg/type.woff2',
    'https://api.example.com/static?icons=set-a',
    'https://icons.example.com/home',
    'https://cdn.example.com/icon-service?name=home',
  ]
  for (const probe of probes) {
    assert.ok(!isAllowlistedExternalUrl(probe), `${probe} must not be allowlisted`)
    assert.ok(isIconAssetUrl(probe), `${probe} should be icon-asset-like`)
    assert.deepEqual(
      scanExternalIconUrls(`const href = "${probe}"`),
      [`external icon asset URL: ${probe}`],
    )
  }
})

test('generic external URL policy allowlists documented non-icon endpoints (GREEN probes)', () => {
  const probes = [
    'http://www.w3.org/2000/svg',
    'https://adoptium.net/temurin/releases/?version=8',
    'https://placeholder.supabase.co',
    'https://project-ref.supabase.co/rest/v1/profiles',
    'https://lucide.dev/icons/qr-code',
  ]
  for (const probe of probes) {
    assert.ok(isAllowlistedExternalUrl(probe), `${probe} should be allowlisted`)
    assert.deepEqual(scanExternalIconUrls(probe), [])
  }
  assert.ok(EXTERNAL_URL_ALLOWLIST.length >= 3)
})

test('check:icons enforces fresh build plus source/dist/license audit', async () => {
  const result = npmRun('check:icons')
  assert.equal(result.status, 0, result.stderr || result.stdout)
  assert.match(result.stdout, /Lucide icon check passed/)
  const deployedNotice = await readFile(new URL('../dist/THIRD_PARTY_LICENSES.txt', import.meta.url), 'utf8')
  assert.match(deployedNotice, /ISC License/)
  assert.match(deployedNotice, /lucide-static/)
})
