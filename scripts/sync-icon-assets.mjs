import { access, cp, mkdir, readdir, rm } from 'node:fs/promises'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ICON_NAMES, assetFilename } from './icon-names.mjs'

const root = new URL('../', import.meta.url)
const lucideSource = name =>
  new URL(`node_modules/lucide-static/icons/${name}.svg`, root)
const destination = filename => new URL(`src/assets/icons/${filename}`, root)

const copies = ICON_NAMES.map(name => ({
  source: lucideSource(name),
  target: destination(assetFilename(name)),
}))

// A missing package asset must never erase the last known-good generated set.
await Promise.all(copies.map(({ source }) => access(source)))

await mkdir(dirname(fileURLToPath(destination('icon.svg'))), { recursive: true })
for (const entry of await readdir(destination('.'))) {
  if (entry.endsWith('.svg')) await rm(destination(entry))
}

for (const { source, target } of copies) {
  await cp(source, target)
}
