# Local Icon Assets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 3.95 MB Material Symbols ligature font and all source-inline SVGs with versioned local SVG assets that can never display raw icon names.

**Architecture:** Copy only the Material Symbols used by SP-lite into `src/assets/icons/`, then resolve them through Vite's eager asset glob in `src/lib/icons.js`. `LiIcon` renders each monochrome SVG as a `currentColor` CSS mask, preserving existing sizes, colors, hover states, and animation while eliminating ligature text. Brand artwork remains a normal local image because it is multicolor.

**Tech Stack:** Vue 3, Vite 6, Node.js 20 built-in test runner, `@material-symbols/svg-400`

## Global Constraints

- All application-owned icon and brand artwork must be tracked under `src/assets/`.
- No runtime request may target Google Fonts, an icon CDN, or another icon service.
- Raw icon identifiers must never be rendered as fallback text.
- Existing dynamic QR images, uploads, video frames, and preview object/data URLs remain unchanged.
- Preserve existing public component props and dynamic icon-name registries.
- Do not create git commits unless the user explicitly requests them.

---

## File Map

**Create**

- `scripts/icon-names.mjs` — authoritative list of Material Symbols copied into the app.
- `scripts/sync-icon-assets.mjs` — deterministic package-to-asset copier.
- `scripts/check-icon-migration.mjs` — final source and production-output audit.
- `tests/icon-assets.test.mjs` — asset inventory and source migration checks.
- `src/lib/icons.js` — Vite asset lookup and normalized icon resolution.
- `src/assets/icons/*.svg` — generated outlined SVG assets.
- `src/assets/icons/check-fill.svg` — filled state used by `LiStepper`.
- `src/assets/icons/NOTICE.md` — Material Symbols attribution and source package.
- `src/assets/brand/sp-lite-mark.svg` — multicolor local brand mark.

**Modify**

- `package.json`, `package-lock.json`
- `index.html`
- `src/main.js`
- `src/assets/global.css`
- `src/lib/components/LiIcon.vue`
- `src/lib/components/LiLogo.vue`
- Inline-SVG components: `LiBanner.vue`, `LiBottomSheet.vue`, `LiCheckbox.vue`, `LiCommandPalette.vue`, `LiDatePicker.vue`, `LiModal.vue`, `LiSelect.vue`, `LiTable.vue`, `LiTimePicker.vue`, `LiToast.vue`, `LiUpload.vue`
- Font-icon consumer files in `src/App.vue` and `src/modules/**`

**Delete**

- `public/fonts/material-symbols/material-symbols-outlined.woff2`

---

### Task 1: Generate the local icon asset inventory

**Files:**
- Create: `scripts/icon-names.mjs`
- Create: `scripts/sync-icon-assets.mjs`
- Create: `tests/icon-assets.test.mjs`
- Create: `src/assets/icons/NOTICE.md`
- Modify: `package.json`
- Modify: `package-lock.json`
- Generate: `src/assets/icons/*.svg`

**Interfaces:**
- Produces: `ICON_NAMES: readonly string[]`, `FILLED_ICON_NAMES: readonly string[]`
- Produces: one kebab-case SVG filename per icon name
- Consumes: `@material-symbols/svg-400/outlined/<name>.svg`

- [ ] **Step 1: Install the SVG source package**

Run:

```powershell
npm install --save-dev @material-symbols/svg-400@latest
```

Expected: `package.json` and `package-lock.json` contain `@material-symbols/svg-400`; production dependencies are unchanged.

- [ ] **Step 2: Add the explicit icon inventory**

Create `scripts/icon-names.mjs`:

```js
export const ICON_NAMES = Object.freeze([
  'account_balance', 'account_circle', 'account_tree', 'add',
  'admin_panel_settings', 'alternate_email', 'apps', 'arrow_back',
  'arrow_downward', 'arrow_forward', 'arrow_upward', 'aspect_ratio',
  'auto_awesome', 'auto_fix_high', 'autorenew', 'badge', 'barcode', 'bolt',
  'calendar_month', 'check', 'check_box', 'check_box_outline_blank',
  'check_circle', 'chevron_left', 'chevron_right', 'close', 'cloud_upload',
  'code', 'content_copy', 'content_paste', 'dashboard', 'data_object',
  'delete', 'delete_sweep', 'description', 'deselect', 'dns', 'download',
  'download_done', 'edit', 'edit_note', 'edit_off', 'error', 'event',
  'event_available', 'event_upcoming', 'expand_less', 'expand_more',
  'file_download', 'file_save', 'filter_alt', 'filter_alt_off', 'flare',
  'font_download', 'format_align_center', 'format_align_justify',
  'format_align_left', 'format_align_right', 'format_bold', 'format_italic',
  'format_size', 'format_underlined', 'group', 'group_off', 'hard_drive_2',
  'help', 'history', 'history_toggle_off', 'hourglass_bottom',
  'hourglass_empty', 'hourglass_top', 'info', 'inventory', 'ios_share',
  'key', 'lock', 'logout', 'mail', 'menu', 'movie', 'palette', 'person',
  'person_add', 'picture_as_pdf', 'play_arrow', 'preview', 'qr_code_2',
  'qr_code_scanner', 'refresh', 'remove', 'report', 'restart_alt', 'save',
  'schedule', 'search', 'select_all', 'sell', 'shield_person', 'storefront',
  'sync_problem', 'table_rows', 'terminal', 'transform', 'tune',
  'unfold_more', 'upload', 'upload_file', 'verified', 'video_file',
  'videocam', 'view_column', 'view_list', 'visibility', 'visibility_off',
  'warning',
])

export const FILLED_ICON_NAMES = Object.freeze(['check'])

export function assetFilename(name, filled = false) {
  return `${name.replaceAll('_', '-')}${filled ? '-fill' : ''}.svg`
}
```

- [ ] **Step 3: Write the failing inventory test**

Create `tests/icon-assets.test.mjs`:

```js
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import { ICON_NAMES, FILLED_ICON_NAMES, assetFilename } from '../scripts/icon-names.mjs'

const iconUrl = name => new URL(`../src/assets/icons/${name}`, import.meta.url)

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
```

- [ ] **Step 4: Confirm the test fails before generation**

Run:

```powershell
node --test tests/icon-assets.test.mjs
```

Expected: FAIL with `ENOENT` for the first missing file in `src/assets/icons/`.

- [ ] **Step 5: Add the deterministic asset copier**

Create `scripts/sync-icon-assets.mjs`:

```js
import { cp, mkdir, readdir, rm } from 'node:fs/promises'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ICON_NAMES, FILLED_ICON_NAMES, assetFilename } from './icon-names.mjs'

const root = new URL('../', import.meta.url)
const source = name =>
  new URL(`node_modules/@material-symbols/svg-400/outlined/${name}.svg`, root)
const destination = filename => new URL(`src/assets/icons/${filename}`, root)

await mkdir(dirname(fileURLToPath(destination('icon.svg'))), { recursive: true })
for (const entry of await readdir(destination('.'))) {
  if (entry.endsWith('.svg')) await rm(destination(entry))
}

for (const name of ICON_NAMES) {
  await cp(source(name), destination(assetFilename(name)))
}
for (const name of FILLED_ICON_NAMES) {
  await cp(source(`${name}-fill`), destination(assetFilename(name, true)))
}
```

Add these scripts to `package.json`:

```json
{
  "scripts": {
    "icons:sync": "node scripts/sync-icon-assets.mjs",
    "test:icons": "node --test tests/icon-assets.test.mjs"
  }
}
```

- [ ] **Step 6: Generate and verify the assets**

Run:

```powershell
npm run icons:sync
npm run test:icons
```

Expected: generation succeeds and both tests pass.

- [ ] **Step 7: Add attribution**

Create `src/assets/icons/NOTICE.md`:

```markdown
# Material Symbols assets

The SVG files in this directory are selected Material Symbols, weight 400,
outlined style, copied from `@material-symbols/svg-400`.

Material Symbols are provided under the Apache License 2.0.
Source: https://github.com/marella/material-symbols
```

---

### Task 2: Build the shared asset-backed icon renderer

**Files:**
- Create: `src/lib/icons.js`
- Modify: `src/lib/components/LiIcon.vue`
- Modify: `src/main.js`

**Interfaces:**
- Produces: `iconUrl(name: string, filled?: boolean): string`
- Produces: globally available `<LiIcon name size filled color decorative label />`
- Consumes: generated `src/assets/icons/*.svg`

- [ ] **Step 1: Add the Vite icon resolver**

Create `src/lib/icons.js`:

```js
const assets = import.meta.glob('../assets/icons/*.svg', {
  eager: true,
  query: '?url',
  import: 'default',
})

const urls = Object.freeze(Object.fromEntries(
  Object.entries(assets).map(([path, url]) => {
    const filename = path.split('/').pop().replace(/\.svg$/, '')
    return [filename.replaceAll('-', '_'), url]
  }),
))

export function iconUrl(name, filled = false) {
  const normalized = String(name || '').trim().replaceAll('-', '_')
  if (!normalized) return ''
  return urls[`${normalized}${filled ? '_fill' : ''}`] || urls[normalized] || ''
}
```

- [ ] **Step 2: Replace the font implementation in `LiIcon.vue`**

Use a text-free element and CSS mask:

```vue
<template>
  <span
    class="li-icon"
    :class="`li-icon--${size}`"
    :style="iconStyle"
    :role="decorative ? undefined : 'img'"
    :aria-hidden="decorative ? 'true' : undefined"
    :aria-label="decorative ? undefined : label"
  />
</template>

<script setup>
import { computed, watchEffect } from 'vue'
import { iconUrl } from '../icons.js'

const props = defineProps({
  name: { type: String, required: true },
  size: {
    type: String,
    default: 'md',
    validator: value => ['xxs', 'sm', 'md', 'lg', 'xl'].includes(value),
  },
  filled: { type: Boolean, default: false },
  color: { type: String, default: 'inherit' },
  decorative: { type: Boolean, default: true },
  label: { type: String, default: '' },
})

const url = computed(() => iconUrl(props.name, props.filled))
const iconStyle = computed(() => ({
  color: props.color,
  '--li-icon-url': url.value ? `url("${url.value}")` : 'none',
}))

watchEffect(() => {
  if (import.meta.env.DEV && props.name && !url.value) {
    console.warn(`[LiIcon] Missing local icon asset: ${props.name}`)
  }
})
</script>

<style scoped>
.li-icon {
  display: inline-block;
  width: 1em;
  height: 1em;
  flex: 0 0 auto;
  background-color: currentColor;
  -webkit-mask: var(--li-icon-url) center / contain no-repeat;
  mask: var(--li-icon-url) center / contain no-repeat;
}
.li-icon--xxs { font-size: 12px; }
.li-icon--sm  { font-size: 16px; }
.li-icon--md  { font-size: 20px; }
.li-icon--lg  { font-size: 24px; }
.li-icon--xl  { font-size: 32px; }
</style>
```

- [ ] **Step 3: Register `LiIcon` globally**

Update `src/main.js`:

```js
import { createApp } from 'vue'
import App from './App.vue'
import router from './router/index.js'
import LiIcon from './lib/components/LiIcon.vue'
import './assets/tokens.css'
import './assets/global.css'

const app = createApp(App)
app.component('LiIcon', LiIcon)
app.use(router)
app.mount('#app')
```

- [ ] **Step 4: Verify the foundation**

Run:

```powershell
npm run build
npm run test:icons
```

Expected: build succeeds; icon asset tests pass; generated icon files appear as fingerprinted Vite assets.

---

### Task 3: Externalize design-system SVGs and the brand mark

**Files:**
- Create: `src/assets/brand/sp-lite-mark.svg`
- Modify: `src/lib/components/LiLogo.vue`
- Modify: `src/lib/components/LiBanner.vue`
- Modify: `src/lib/components/LiBottomSheet.vue`
- Modify: `src/lib/components/LiCheckbox.vue`
- Modify: `src/lib/components/LiCommandPalette.vue`
- Modify: `src/lib/components/LiDatePicker.vue`
- Modify: `src/lib/components/LiModal.vue`
- Modify: `src/lib/components/LiSelect.vue`
- Modify: `src/lib/components/LiTable.vue`
- Modify: `src/lib/components/LiTimePicker.vue`
- Modify: `src/lib/components/LiToast.vue`
- Modify: `src/lib/components/LiUpload.vue`
- Modify: `src/lib/components/LiMagneticButton.vue`

**Interfaces:**
- Consumes: global `LiIcon`
- Produces: the same component props, slots, events, and visual states without inline SVG

- [ ] **Step 1: Add the brand mark asset**

Create `src/assets/brand/sp-lite-mark.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="64" y2="64">
      <stop stop-color="#F9C700"/>
      <stop offset=".4" stop-color="#FFAF03"/>
      <stop offset="1" stop-color="#FF6B00"/>
    </linearGradient>
  </defs>
  <rect x="2" y="2" width="60" height="60" rx="14" fill="url(#g)"/>
  <rect x="3" y="3" width="58" height="28" rx="12" fill="#fff" opacity=".15"/>
  <path d="M40 18s-3-4-10-4-11 4-11 9 4 7 11 10 11 5 11 10-4 9-11 9-10-4-10-4"
        stroke="#fff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
```

- [ ] **Step 2: Replace the inline logo SVG**

Import the asset URL in `LiLogo.vue`:

```js
import logoMark from '../../assets/brand/sp-lite-mark.svg'
```

Replace `.li-logo__svg` markup with:

```vue
<img class="li-logo__svg" :src="logoMark" alt="" aria-hidden="true" />
```

Keep the existing aura, glow, orbit, particles, size props, and reduced-motion rules. Remove selectors and keyframes that target paths no longer present: `.li-logo__letter`, `.li-logo__letter-shadow`, `.li-logo__bg`, `.li-logo__highlight`, `.li-logo__shimmer`, and `.li-logo__sparkle`.

- [ ] **Step 3: Replace every design-system inline SVG**

Apply this exact mapping:

| Component | Existing SVG state | Replacement |
|---|---|---|
| `LiBanner`, `LiToast` | success/error/warning/info | `check_circle` / `error` / `warning` / `info` |
| `LiBanner`, `LiToast`, `LiModal`, `LiBottomSheet` | close | `close` |
| `LiCheckbox` | indeterminate/checked | `remove` / `check` |
| `LiCommandPalette` | search | `search` |
| `LiDatePicker` | calendar/previous/next | `calendar_month` / `chevron_left` / `chevron_right` |
| `LiSelect` | dropdown | `expand_more` |
| `LiTable` | unsorted/ascending/descending | `unfold_more` / `arrow_upward` / `arrow_downward` |
| `LiTimePicker` | clock | `schedule` |
| `LiUpload` | upload/file/remove | `cloud_upload` / `description` / `close` |
| `LiMagneticButton` | dynamic text icon | `<LiIcon :name="icon" />` |

For example:

```vue
<LiIcon v-if="variant === 'success'" name="check_circle" size="md" />
<LiIcon v-else-if="variant === 'error'" name="error" size="md" />
<LiIcon v-else-if="variant === 'warning'" name="warning" size="md" />
<LiIcon v-else name="info" size="md" />
```

Preserve each existing wrapper class on `LiIcon` so layout CSS remains stable.

- [ ] **Step 4: Verify design-system consumers**

Run:

```powershell
rg "<svg|material-symbols-outlined" src/lib/components
npm run build
```

Expected: the search returns no matches; build succeeds.

---

### Task 4: Migrate the shell, account surfaces, dashboard, landing, and admin

**Files:**
- Modify: `src/App.vue`
- Modify: `src/modules/auth/views/LoginView.vue`
- Modify: `src/modules/profile/views/ProfileView.vue`
- Modify: `src/modules/dashboard/views/DashboardView.vue`
- Modify: `src/modules/landing/views/LandingView.vue`
- Modify: `src/modules/admin/views/AdminView.vue`
- Modify: `src/modules/admin/components/AdminUsersTab.vue`
- Modify: `src/modules/admin/components/AdminUserModal.vue`
- Modify: `src/modules/admin/components/AdminModuleDrawer.vue`
- Modify: `src/modules/admin/components/AdminRoleDrawer.vue`
- Modify: `src/modules/admin/components/AdminUserDrawer.vue`
- Modify: `src/modules/admin/components/AdminModulesTab.vue`
- Modify: `src/modules/admin/components/AdminRolesTab.vue`
- Modify: `src/modules/admin/components/AdminRoleModal.vue`

**Interfaces:**
- Consumes: global `LiIcon`
- Preserves: route and module registry icon-name strings

- [ ] **Step 1: Replace static ligature spans**

Use:

```vue
<LiIcon name="close" />
```

instead of:

```vue
<span class="material-symbols-outlined">close</span>
```

Move any non-font class from the old span to `LiIcon`.

- [ ] **Step 2: Replace dynamic ligature spans**

Use:

```vue
<LiIcon :name="mod.icon" class="sp-sidebar__item-icon" />
<LiIcon :name="showPassword ? 'visibility_off' : 'visibility'" />
<LiIcon :name="row.is_active ? 'check_circle' : 'hourglass_empty'" />
```

Keep route metadata, `MODULE_REGISTRY`, tab definitions, and feature arrays unchanged.

- [ ] **Step 3: Migrate CSS selectors**

Within only the files in this task, replace descendant selectors ending in
`.material-symbols-outlined` with `.li-icon`. Preserve declarations such as
`font-size`, `color`, transforms, and animation.

- [ ] **Step 4: Verify this migration slice**

Run:

```powershell
rg "material-symbols-outlined" src/App.vue src/modules/auth src/modules/profile src/modules/dashboard src/modules/landing src/modules/admin
npm run build
```

Expected: the search returns no matches; build succeeds.

---

### Task 5: Migrate QRIS, Template Tools, and Video Frames

**Files:**
- Modify: all `.vue` files under `src/modules/qris/`
- Modify: all `.vue` files under `src/modules/template-tools/`
- Modify: `src/modules/video-frames/views/VideoFramesView.vue`

**Interfaces:**
- Consumes: global `LiIcon`
- Preserves: generated QR image sources, user file sources, preview URLs, and video-frame URLs

- [ ] **Step 1: Replace static and conditional icon spans**

Use static or bound names:

```vue
<LiIcon name="qr_code_2" />
<LiIcon :name="copied ? 'check' : 'content_copy'" />
<LiIcon :name="frame.selected ? 'check_box' : 'check_box_outline_blank'" />
```

Do not change any `<img>`, `<iframe>`, canvas-generated data URL, blob URL, or uploaded file URL.

- [ ] **Step 2: Replace dynamic tab and toolbar icons**

Use:

```vue
<LiIcon :name="tab.icon" class="qris__tab-icon" />
<LiIcon :name="align.icon" />
```

Keep all tab and alignment definition objects unchanged.

- [ ] **Step 3: Replace both SVG select-arrow data URIs**

In `StyleEditorModal.vue` and `FtlPreviewPanel.vue`, remove the SVG
`background-image`. Use the local icon asset through CSS:

```js
import { iconUrl } from '@/lib/icons.js'

const expandMoreIcon = iconUrl('expand_more')
```

Bind it to the relevant select wrapper:

```vue
<div :style="{ '--select-arrow': `url(${expandMoreIcon})` }">
```

and use:

```css
background-image: var(--select-arrow);
```

- [ ] **Step 4: Migrate local icon CSS selectors**

Replace `.material-symbols-outlined` with `.li-icon` only in this task's files.
Retain icon sizing and toolbar transition declarations.

- [ ] **Step 5: Verify this migration slice**

Run:

```powershell
rg "material-symbols-outlined|data:image/svg\\+xml" src/modules/qris src/modules/template-tools src/modules/video-frames
npm run build
```

Expected: the search returns no matches; build succeeds.

---

### Task 6: Migrate the complete DD module

**Files:**
- Modify: all `.vue` files under `src/modules/dd/`

**Interfaces:**
- Consumes: global `LiIcon`
- Preserves: all DD access checks, routes, CRUD actions, filters, and dynamic dashboard/sidebar icon names

- [ ] **Step 1: Replace static DD icons**

Convert every font span to `LiIcon`, including action, stale-state, empty-state,
form-status, SQL, export, audit, and sidebar icons:

```vue
<LiIcon name="file_save" />
<LiIcon name="sync_problem" />
<LiIcon name="delete" />
```

- [ ] **Step 2: Replace conditional and registry-backed DD icons**

Use:

```vue
<LiIcon :name="jsonMode ? 'view_list' : 'data_object'" />
<LiIcon :name="splitOk ? 'check_circle' : 'error'" />
<LiIcon :name="item.icon" />
<LiIcon :name="c.icon" class="ddash__kpiico" />
```

Do not change `CARD_ICON`, sidebar arrays, menu names, database names, access
checks, or route names.

- [ ] **Step 3: Preserve spin and color behavior**

Replace DD CSS descendants such as:

```css
.ddnav__icobtn--spin .material-symbols-outlined
```

with:

```css
.ddnav__icobtn--spin .li-icon
```

Apply the same selector-only migration to DD font-size and color rules.

- [ ] **Step 4: Verify the DD migration**

Run:

```powershell
rg "material-symbols-outlined|<svg|data:image/svg\\+xml" src/modules/dd
npm run build
```

Expected: the search returns no matches; build succeeds.

---

### Task 7: Remove the font and enforce the migration

**Files:**
- Modify: `index.html`
- Modify: `src/assets/global.css`
- Create: `scripts/check-icon-migration.mjs`
- Modify: `tests/icon-assets.test.mjs`
- Modify: `package.json`
- Delete: `public/fonts/material-symbols/material-symbols-outlined.woff2`

**Interfaces:**
- Produces: `npm run check:icons`
- Enforces: no font icon, inline SVG, SVG data URI, or removed icon font in source/build

- [ ] **Step 1: Add the failing migration audit**

Create `scripts/check-icon-migration.mjs`:

```js
import { access, readdir, readFile } from 'node:fs/promises'
import { extname } from 'node:path'

const root = new URL('../', import.meta.url)
const scannedExtensions = new Set(['.vue', '.js', '.css', '.html'])
const forbidden = [
  ['Material Symbols class', /material-symbols-outlined/],
  ['Material Symbols font', /Material Symbols(?: Outlined| Outlined Variable)?/],
  ['inline SVG', /<svg\b/i],
  ['SVG data URI', /data:image\/svg\+xml/i],
]

async function filesUnder(url) {
  const output = []
  for (const entry of await readdir(url, { withFileTypes: true })) {
    const child = new URL(`${entry.name}${entry.isDirectory() ? '/' : ''}`, url)
    if (entry.isDirectory()) output.push(...await filesUnder(child))
    else if (scannedExtensions.has(extname(entry.name))) output.push(child)
  }
  return output
}

const files = [
  new URL('../index.html', import.meta.url),
  ...await filesUnder(new URL('../src/', import.meta.url)),
]
const failures = []

for (const file of files) {
  const source = await readFile(file, 'utf8')
  for (const [label, pattern] of forbidden) {
    if (pattern.test(source)) failures.push(`${label}: ${file.pathname}`)
  }
}

try {
  await access(new URL('../public/fonts/material-symbols/material-symbols-outlined.woff2', import.meta.url))
  failures.push('removed Material Symbols WOFF2 still exists')
} catch {
  // Expected: the old font is absent.
}

if (failures.length) {
  console.error(failures.join('\n'))
  process.exitCode = 1
} else {
  console.log('Local icon migration check passed')
}
```

Add to `package.json`:

```json
{
  "scripts": {
    "check:icons": "node scripts/check-icon-migration.mjs"
  }
}
```

Run:

```powershell
npm run check:icons
```

Expected: FAIL while the old font declarations and file still exist.

- [ ] **Step 2: Remove Material Symbols from the document**

Delete the Material Symbols `@font-face` block and the
`.material-symbols-outlined` rule from `index.html`. Keep all local Inter
declarations unchanged.

- [ ] **Step 3: Remove obsolete global icon CSS**

Delete the active `.material-symbols-outlined` rule from
`src/assets/global.css`. Also delete the disabled noise-overlay comment whose
example `background-image` contains an SVG data URI; the overlay is already
disabled and retaining that dead example would violate the source audit.

- [ ] **Step 4: Delete the obsolete 3.95 MB font**

Delete:

```text
public/fonts/material-symbols/material-symbols-outlined.woff2
```

- [ ] **Step 5: Extend the Node test with the migration audit**

Append to `tests/icon-assets.test.mjs`:

```js
import { spawnSync } from 'node:child_process'

test('source contains no font icons or inline SVG', () => {
  const result = spawnSync(process.execPath, ['scripts/check-icon-migration.mjs'], {
    cwd: new URL('../', import.meta.url),
    encoding: 'utf8',
  })
  assert.equal(result.status, 0, result.stderr || result.stdout)
})
```

- [ ] **Step 6: Run complete automated verification**

Run:

```powershell
npm run icons:sync
npm run test:icons
npm run check:icons
npm run build
```

Expected: every command exits 0; Vite reports a successful production build.

- [ ] **Step 7: Inspect production output for forbidden icon dependencies**

Run:

```powershell
rg "Material Symbols|material-symbols-outlined|fonts.googleapis.com|fonts.gstatic.com|admin_panel_settings" dist
```

Expected: no matches.

- [ ] **Step 8: Perform browser verification**

Serve the production build:

```powershell
npm run preview -- --host 127.0.0.1
```

Check landing, login, dashboard, QRIS, Template Tools, Video Frames, DD,
Profile, and Admin routes at desktop and mobile widths. In browser network
throttling, verify icons keep fixed boxes and raw identifiers never appear.
Confirm DD refresh spinners, hover colors, selected checkboxes, password
visibility, dashboard cards, and logo motion remain correct.

Expected: all icons render from local fingerprinted SVG assets; no icon/font
request targets an external host; feature-generated images still work.
