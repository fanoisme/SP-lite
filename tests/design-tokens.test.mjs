// Gate for the Allo restyle (spec: 2026-10-31-allo-restyle-design.md).
// Subtests "tokens file" and "Inter font" pass from Task 1. Subtests
// "var() resolution" and "no raw hex" stay RED until Tasks 3–14 land —
// the merge gate (Task 15) requires this whole file green.
import assert from 'node:assert/strict'
import { readFile, readdir, stat } from 'node:fs/promises'
import { join, relative } from 'node:path'
import { test } from 'node:test'

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')
const SRC = join(ROOT, 'src')

async function read(p) {
  return readFile(p, 'utf8')
}

async function walkVue(dir, out = []) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) await walkVue(full, out)
    else if (entry.name.endsWith('.vue')) out.push(full)
  }
  return out
}

function customPropsDefined(css) {
  const names = new Set()
  for (const m of css.matchAll(/(--[\w-]+)\s*:/g)) names.add(m[1])
  return names
}

test('tokens file ships the Allo roles verbatim', async () => {
  const css = await read(join(ROOT, 'src/assets/tokens.css'))
  assert.ok(css.includes('--color-accent: #ffbc25;'), 'accent role with guide value')
  assert.ok(css.includes('--color-accent-strong: #ffa500;'), 'accent-strong light value')
  assert.ok(css.includes(':root[data-theme="dark"]'), 'dark theme block')
  assert.ok(css.includes("--color-accent-strong: #ffc95e;"), 'dark accent-strong brightens')
  assert.ok(/@font-face\s*{[^}]*font-family:\s*Inter/s.test(css), 'Inter @font-face')
  assert.ok(css.includes('fonts/Inter-latin.woff2'), 'self-hosted font path')
})

test('Inter font file present and valid woff2', async () => {
  const p = join(ROOT, 'src/assets/fonts/Inter-latin.woff2')
  const buf = await readFile(p)
  assert.equal(buf.subarray(0, 4).toString('ascii'), 'wOF2')
  const info = await stat(p)
  assert.ok(info.size > 10_000, `font suspiciously small: ${info.size}`)
})

test('every var() in src resolves to a defined custom property', async () => {
  const tokens = await read(join(ROOT, 'src/assets/tokens.css'))
  const base = await read(join(ROOT, 'src/assets/allo-base.css'))
  const globalCss = await read(join(ROOT, 'src/assets/global.css'))
  const shared = new Set([
    ...customPropsDefined(tokens),
    ...customPropsDefined(base),
    ...customPropsDefined(globalCss),
  ])

  const files = await walkVue(SRC)
  const unknown = []
  for (const file of files) {
    const text = await read(file)
    const local = customPropsDefined(text.match(/<style[^>]*>([\s\S]*?)<\/style>/g)?.join('\n') ?? '')
    const lines = text.split('\n')
    for (let i = 0; i < lines.length; i++) {
      for (const m of lines[i].matchAll(/var\(\s*(--[\w-]+)/g)) {
        if (!shared.has(m[1]) && !local.has(m[1])) {
          unknown.push(`${relative(ROOT, file)}:${i + 1} ${m[1]}`)
        }
      }
    }
  }
  assert.deepEqual(unknown, [], `undefined custom properties (${unknown.length}):\n${unknown.join('\n')}`)
})

test('no raw hex literals in Li component styles (except mascot art)', async () => {
  const dir = join(ROOT, 'src/lib/components')
  const offenders = []
  for (const name of await readdir(dir)) {
    if (!name.endsWith('.vue') || name === 'LiMascot.vue') continue
    const text = await read(join(dir, name))
    for (const block of text.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)) {
      const lines = block[1].split('\n')
      for (let i = 0; i < lines.length; i++) {
        if (/#[0-9a-fA-F]{3,8}\b/.test(lines[i])) {
          offenders.push(`${name}: ${lines[i].trim().slice(0, 80)}`)
        }
      }
    }
  }
  assert.deepEqual(offenders, [], `hex literals in component skins (${offenders.length}):\n${offenders.join('\n')}`)
})
