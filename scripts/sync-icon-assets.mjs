import { access, cp, mkdir, readdir, rm } from 'node:fs/promises'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ICON_NAMES, FILLED_ICON_NAMES, assetFilename } from './icon-names.mjs'

/** Icons absent from @material-symbols/svg-400; copied from @material-design-icons/svg instead. */
export const FALLBACK_ICON_NAMES = Object.freeze([
  'auto_awesome',
  'auto_fix_high',
  'expand_less',
  'expand_more',
  'file_download',
])

const root = new URL('../', import.meta.url)
const symbolsSource = name =>
  new URL(`node_modules/@material-symbols/svg-400/outlined/${name}.svg`, root)
const fallbackSource = name =>
  new URL(`node_modules/@material-design-icons/svg/outlined/${name}.svg`, root)
const destination = filename => new URL(`src/assets/icons/${filename}`, root)

const fallbackSet = new Set(FALLBACK_ICON_NAMES)

function sourceFor(name) {
  return fallbackSet.has(name) ? fallbackSource(name) : symbolsSource(name)
}

const copies = [
  ...ICON_NAMES.map(name => ({
    source: sourceFor(name),
    target: destination(assetFilename(name)),
  })),
  ...FILLED_ICON_NAMES.map(name => ({
    source: symbolsSource(`${name}-fill`),
    target: destination(assetFilename(name, true)),
  })),
]

// A missing package asset must never erase the last known-good generated set.
// Validate every primary, fallback, and filled source before touching output.
await Promise.all(copies.map(({ source }) => access(source)))

await mkdir(dirname(fileURLToPath(destination('icon.svg'))), { recursive: true })
for (const entry of await readdir(destination('.'))) {
  if (entry.endsWith('.svg')) await rm(destination(entry))
}

for (const { source, target } of copies) {
  await cp(source, target)
}
