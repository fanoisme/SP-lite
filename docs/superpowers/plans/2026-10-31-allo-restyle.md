# SP-lite × Allo Design System Restyle — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Retire SP-lite's Lithium UI layer and rebuild every screen on the Allo Design System tokens, components and layouts (compact density, Shell B, dark mode, SVG mascot), per the approved spec.

**Architecture:** Tokens and component skins are ported from the Allo guide (`E:\Work\Vibe\design-system-guide`) into SP-lite's existing `Li*` Vue components — APIs unchanged, internals replaced. App shell becomes the guide's Shell B. Verification is a design-token lint test, node asset tests, the Vite build, and a Playwright screenshot matrix compared against the guide's mockups.

**Tech Stack:** Vue 3 `<script setup>`, Vite, existing Supabase client. New devDependencies only: `lucide-static` (icon sync source), `playwright` (screenshot gate).

**Spec:** `docs/superpowers/specs/2026-10-31-allo-restyle-design.md` — the spec travels with this plan; executors read both.

## Global Constraints

- Tokens copied verbatim from `E:\Work\Vibe\design-system-guide\tokens.css`; role names only, never raw hex in components (exception: the mascot's fixed-palette art).
- Compact density: body 14/20 (`--text-sm/--leading-sm`), inputs 32px, buttons 28/32/40px, table rows 40px, top bar 56.
- Landing (`/`) stays light-only; every other route supports light + dark via `data-theme="dark"`.
- English copy only; no copy rewrites beyond component skins.
- Runtime `dependencies` in package.json unchanged. New entries only under `devDependencies`.
- Router untouched except one addition: `/:pathMatch(.*)*` catch-all 404.
- No Supabase/RBAC/schema/behavior changes. DD's `lib/schema.js`, `lib/columns.js`, `lib/validate.js`, `composables/useDdTable.js` logic untouched.
- All tests: `node --test tests/*.test.mjs` (baseline: green after `npm install`; icon test currently fails only because node_modules is absent).
- Inter self-hosted: `src/assets/fonts/Inter-latin.woff2`, no Google Fonts request.
- Icons: Lucide names (kebab-case), 16px, stroke 2, local SVG assets only.

## Review Focus

Covered by tests inside tasks; listed here so executors know what bites:

1. **Lithium token leftovers** — a view still reading `var(--color-gray-900, …)` silently falls back to a near-miss color. Pinned by Task 1's `tests/design-tokens.test.mjs`, which fails on any `var(--x)` not defined in the token/base CSS.
2. **Raw hex in component skins** — breaks dark mode. Pinned by the same test (hex literals forbidden in `src/lib/components/*.vue` styles except `LiMascot.vue`).
3. **Blocked localStorage** (private mode) — theme init must not throw; app renders light. Pinned by Task 1's useTheme test.
4. **Overlay behavior after skin swap** — Esc-close and focus return are behavior, easy to drop while restyling. Pinned by Task 4's keyboard check on LiModal/LiDrawer.
5. **Screenshot flake from unmocked network** — a stray Supabase call makes shots nondeterministic. Pinned by Task 16's `shots.mjs` asserting zero unmocked requests.

---

### Task 1: Allo tokens, Inter font, base CSS, theme composable

**Files:**
- Replace content: `src/assets/tokens.css`
- Create: `src/assets/fonts/Inter-latin.woff2` (copy from guide `fonts/`), `src/assets/fonts/OFL-LICENCE.md` (copy)
- Create: `src/assets/allo-base.css`
- Replace content: `src/assets/global.css`
- Create: `src/composables/useTheme.js`
- Modify: `src/main.js`
- Test: `tests/design-tokens.test.mjs`, `tests/theme.test.mjs`

**Interfaces:**
- Produces: `useTheme()` → `{ theme: Ref<'light'|'dark'>, setTheme(t), toggleTheme() }`; `initTheme()` called once from `main.js` before mount. Tokens: every role from the guide's `tokens.css`. `allo-base.css` owns: reset, scrollbar, focus-visible ring, selection, Vue transitions (`.fade`, `.slide-up`), and the z-scale (`--z-header:40; --z-sidebar:30; --z-overlay:50; --z-modal:60; --z-toast:70`) — the guide's token file has no z-scale.

- [ ] **Step 1: Write failing tests**

`tests/design-tokens.test.mjs` (node --test):
- Asserts `src/assets/tokens.css` contains `--color-accent: #ffbc25;`, the `:root[data-theme="dark"]` block, `@font-face` for `Inter` pointing at `fonts/Inter-latin.woff2`.
- Scans every `.vue` under `src/` and `src/assets/*.css`: every `var(--name` occurrence must be defined as `--name:` in `tokens.css`, `allo-base.css`, `global.css`, or the same file's `<style>` block. Fails listing file:line for each unknown.
- Scans `src/lib/components/*.vue` `<style>` blocks for hex literals `#[0-9a-fA-F]{3,8}` — fails unless file is `LiMascot.vue`.
- Asserts `src/assets/fonts/Inter-latin.woff2` exists and starts with `wOF2`.

`tests/theme.test.mjs`: imports `useTheme.js` with a localStorage stub that throws on access; asserts `initTheme()` doesn't throw and `theme.value === 'light'`; stub with `'dark'` stored → `theme.value === 'dark'`; stored `'bogus'` → falls back to OS stub, else `'light'`.

- [ ] **Step 2: Run tests — verify they fail**

Run: `npm install` (first time; baseline icon test turns green), then `node --test tests/design-tokens.test.mjs tests/theme.test.mjs`
Expected: FAIL (missing files, Lithium vars everywhere).

- [ ] **Step 3: Implement**

- Copy guide `tokens.css` → `src/assets/tokens.css` verbatim; fix the `@font-face` src to `fonts/Inter-latin.woff2`; copy font + licence.
- Write `allo-base.css` per Interfaces. `global.css` slims to: `@import './tokens.css'; @import './allo-base.css';` plus body defaults now reading Allo roles (`--color-bg`, `--text-sm`).
- `useTheme.js`: module-level singleton ref; `initTheme()` = try localStorage `sp-theme` → `matchMedia('(prefers-color-scheme: dark)')` → `'light'`; sets `document.documentElement.dataset.theme`; `setTheme` persists (try/catch) and swaps instantly, no transition.
- `main.js`: call `initTheme()` before `createApp(...).mount('#app')`.

Note: after this task the app renders with fallback colors (Lithium consumers have `var(..., fallback)`); that broken-intermediate state is expected and disappears as Tasks 3–14 land. `npm run build` must still pass.

- [ ] **Step 4: Run tests — verify pass; commit**

Run: `node --test tests/design-tokens.test.mjs tests/theme.test.mjs && npm run build`
Expected: tokens/theme tests PASS. Note: the design-tokens scan will fail on not-yet-restyled views until Task 14 — gate merge on it, not this task. Commit: `git add -A && git commit -m "feat(allo): port Allo tokens, Inter font, base CSS and useTheme"`.

### Task 2: Icon system migrates to Lucide

**Files:**
- Rewrite: `scripts/icon-names.mjs`, `scripts/sync-icon-assets.mjs`, `scripts/check-icon-migration.mjs`, `tests/icon-assets.test.mjs`
- Replace assets: `src/assets/icons/*.svg` (119 files)
- Modify: `src/lib/components/LiIcon.vue` + every `LiIcon name="…"` usage (86 distinct names, 66 files)
- Modify: `package.json` devDeps

**Interfaces:**
- Produces: `ICON_NAMES` (Lucide kebab-case, frozen array), `assetFilename(name)` → `${name}.svg`. `FILLED_ICON_NAMES` deleted. `LiIcon` props: `name` (kebab-case), `size` (px, default 16) — `filled` prop removed; LiCheckbox owns an inline filled check path.

- [ ] **Step 1: Add `lucide-static` and generate the mapping**

`npm install -D lucide-static`. Rewrite `sync-icon-assets.mjs`: reads `ICON_NAMES` from `icon-names.mjs`, copies `node_modules/lucide-static/icons/<name>.svg` → `src/assets/icons/<name>.svg`, stripping nothing (Lucide SVGs are already `stroke="currentColor" fill="none"`). Rewrite `icon-names.mjs` with the 86 used names mapped per the table below; obvious ones follow the rule "Material name → its Lucide synonym"; tricky ones are pinned:

| Material (old) | Lucide (new) |
|---|---|
| `account_balance` | `landmark` |
| `account_circle` | `circle-user` |
| `account_tree` | `folder-tree` |
| `admin_panel_settings` | `shield` |
| `alternate_email` | `at-sign` |
| `auto_awesome` | `sparkles` |
| `auto_fix_high` | `wand-sparkles` |
| `qr_code_2` | `qr-code` |
| `qr_code_scanner` | `scan-line` |
| `movie` | `clapperboard` |
| `inventory` | `boxes` |
| `storefront` | `store` |
| `dashboard` | `layout-dashboard` |
| `tune` | `sliders-horizontal` |
| `delete` / `delete_sweep` | `trash-2` / `eraser` |
| `sell` | `tag` |
| `shield_person` | `shield-user` |
| `restart_alt` | `rotate-ccw` |
| `table_rows` | `rows-3` |
| `view_column` / `view_list` | `columns-3` / `list` |
| `font_download` | `type` |
| `format_size` | `a-large-small` |
| `picture_as_pdf` | `file-type` |
| `play_arrow` | `play` |
| `preview` / `visibility` | `eye` |
| `flare` | `sparkle` |
| `hourglass_bottom` / `_empty` / `_top` | `hourglass` |
| `ios_share` | `share` |
| `transform` | `scaling` |
| `warning` | `triangle-alert` |
| `error` | `circle-x` |
| `help` | `circle-help` |
| `unfold_more` | `unfold-vertical` |

Rule for the rest: exact synonym if the Lucide file exists (`node_modules/lucide-static/icons/`); otherwise nearest by meaning — the test enforces existence, not taste. Update every usage: `LiIcon name="qr_code_2"` → `name="qr-code"`, etc., including router meta icons (`dashboard`→`layout-dashboard`, `qr_code_2`→`qr-code`, `auto_awesome`→`sparkles`, `movie`→`clapperboard`, `inventory`→`boxes`, `admin_panel_settings`→`shield`, `account_circle`→`circle-user`) and any `filled` prop usages (drop the prop; LiCheckbox gets inline path).

- [ ] **Step 2: Rewrite the tests and gate**

`tests/icon-assets.test.mjs`: keep the SFC-scanning approach (it imports `@vue/compiler-dom`) but assert against Lucide names — every `LiIcon name="…"` and `icon:` meta in `src/` is in `ICON_NAMES`, every `src/assets/icons/*.svg` is referenced, every `ICON_NAMES` entry has an asset file, and no SVG contains `Material` or a `<font>` glyph path count > 1. `check-icon-migration.mjs`: same assertions as a standalone `npm run check:icons`.

- [ ] **Step 3: Run and commit**

Run: `npm run icons:sync && npm run check:icons && node --test tests/icon-assets.test.mjs && npm run build`
Expected: all green. Commit: `git add -A && git commit -m "feat(allo): migrate icon registry to Lucide"`.

### Task 3: Core primitives restyle

**Files:**
- Modify: `src/lib/components/LiButton.vue`, `LiTextField.vue`, `LiSelect.vue`, `LiCheckbox.vue`, `LiRadioButton.vue`, `LiToggle.vue`, `LiSlider.vue`, `LiBadge.vue`, `LiChip.vue`, `LiSpinner.vue`, `LiProgress.vue`, `LiSkeleton.vue`, `LiSkeletonCard.vue`, `LiDivider.vue`, `LiTooltip.vue`, `LiAvatar.vue`, `LiCountUp.vue`

**Interfaces:**
- Consumes: Task 1 tokens, Task 2 LiIcon.
- Produces: unchanged public APIs (props/events/slots). `LiBadge` gains nothing — skins map its existing `variant` values onto the six Allo tones.

- [ ] **Step 1: Restyle per the guide's reference**

Source of truth: `E:\Work\Vibe\design-system-guide\mockups\app.css` — grep for `.btn`, `.field`, `.check`, `.switch`, `.tag`, `.lozenge`, `.progress`, `.skel`; and `components.md` sections "Buttons", "Text field", "Checkbox", "Switch", "Status lozenge", "Tag", "Progress", "Skeleton", "Avatar" for states, keyboard and sizes. Compact sizes: buttons 28/32/40 pill (`--radius-pill`), primary = `--color-accent` fill + `--color-on-accent` text (focus ring uses `on-accent` on yellow), secondary = `--color-surface` + `--color-border-strong` border, subtle, danger (`--color-danger`), link; loading spinner state kept. Inputs 32px, `--radius-sm`, `--color-border-input`, focus = 2px `--color-focus` + `--glow-focus`, label/help/error text `--text-xs`. Lozenge: tone text on tone `-soft`, `--radius-pill`, no border. All durations/easings from motion tokens. Delete every Lithium var/hex from these files (Task 1 test enforces).

- [ ] **Step 2: Verify and commit**

Run: `node --test tests/design-tokens.test.mjs && npm run build`
Expected: pass for these files (scan still flags unrestyled views — check the failure list contains no `src/lib/components/` paths). Spot-check one button/field in `npm run dev`. Commit: `git commit -am "feat(allo): restyle core primitives"`.

### Task 4: Overlays and feedback restyle

**Files:**
- Modify: `src/lib/components/LiModal.vue`, `LiBottomSheet.vue`, `LiDrawer.vue`, `LiBanner.vue`, `LiToast.vue`, `LiEmptyState.vue`, `LiCommandPalette.vue`, `LiDropdown.vue`, `LiDropdownItem.vue`, `LiAccordion.vue`, `LiAccordionItem.vue`, `LiStepper.vue`, `LiTabs.vue`, `LiPagination.vue`, `LiBreadcrumb.vue`, `LiListTile.vue`, `LiTable.vue`, `LiTimePicker.vue`, `LiDatePicker.vue`, `LiComboBox.vue`, `LiUpload.vue`, `LiCard.vue`

**Interfaces:**
- Consumes: tokens, LiIcon.
- Produces: unchanged APIs. `LiTable` renders the L5 skin: 40px rows, sticky header, `--color-surface` header fill, row hover `--color-hover`, borders `--color-border`. `LiToast` renders the bottom-right stack (inverse surface: `--color-inverse` bg, `--color-on-inverse` text). `LiTabs` = underline tabs with gliding ink indicator (`--dur-short`, `--ease-move`).

- [ ] **Step 1: Restyle**

Reference: `app.css` (`.dlg`, `.sheet`, `.drawer`, `.banner`, `.toast`, `.menu`, `.tabs`, `.table`, `.stepper`, `.crumbs`) + `components.md` sections "Dialog", "Drawer", "Banner", "Toast stack", "Table", "Underline tabs", "Menu", "Stepper". Overlay scrim = `--color-overlay` at the guide's opacity; pop shadow `--shadow-pop`; enter `--dur-medium --ease-enter`, exit `--dur-medium --ease-exit`. Drawers 600 max, dialogs ≤640. Keep focus-trap/Esc logic exactly as-is — skins only.

- [ ] **Step 2: Keyboard behavior check**

In `npm run dev`: open one LiModal (any dialog route) and one LiDrawer — Tab cycles inside, Esc closes and focus returns to trigger. If a skin edit broke it, fix before commit.

- [ ] **Step 3: Verify and commit**

Run: `node --test tests/design-tokens.test.mjs && npm run build`
Expected: no `src/lib/components/` failures. Commit: `git commit -am "feat(allo): restyle overlays, table, tabs and feedback"`.

### Task 5: SVG mascot + LiLogo + favicon

**Files:**
- Create: `src/lib/components/LiMascot.vue`, `src/assets/brand/sp-lite-mark.svg`
- Delete: `src/assets/brand/sp-lite-golden.gif`, `src/assets/brand/sp-lite-golden.png`, `scripts/build-golden-logo.py`, `tests/logo-assets.test.mjs`
- Modify: `src/lib/components/LiLogo.vue`, `index.html` (favicon), `package.json` (drop `test:logo` script)

**Interfaces:**
- Produces: `LiMascot` props: `size` (px number, default 48), `animated` (Boolean, default true), `label` (String — when set, `role="img" :aria-label="label"`; when absent, `aria-hidden="true"`). Internal SVG groups with ids `m-head`, `m-ear-l`, `m-ear-r`, `m-eye-l`, `m-eye-r`, `m-snout`, `m-chest` (each animated part wrapped in a `<g>` with its own transform-origin). Fixed art palette (literals, not var()): fur `#f5c26b`/`#e8a84c`, shade `#c98500`, ink `#333333`, white `#ffffff` — same fills in both themes.
- `LiLogo` keeps its props (`size`, `compact`, `animate`, `showSubtitle`); mark renders `LiMascot` inline; drop `gifFailed` logic.

- [ ] **Step 1: Write the failing asset test**

`tests/mascot.test.mjs`: `sp-lite-mark.svg` parses as XML; contains a `<svg` root with `viewBox`; contains the seven group ids; contains no `var(--`. `LiMascot.vue` contains `prefers-reduced-motion` handling and keyframes named `mascot-breath`, `mascot-blink`, `mascot-ear`, `mascot-tilt`; every animation's duration ≥ 600ms (no strobing). No GIF/PNG in `src/assets/brand/`.

- [ ] **Step 2: Run — verify fail**

Run: `node --test tests/mascot.test.mjs` → FAIL (no files).

- [ ] **Step 3: Build the dog**

Flat-vector golden retriever head + chest in the guide's flat style: layered groups per Interfaces; identity = the old PNG's dog at 48px (golden head, floppy ears, friendly eyes, dark nose). Animations: `mascot-breath` (chest scaleY 1→1.02, ~3s), `mascot-blink` (eyelid scaleY 1→0.1→1, 140ms, every 4–6s via JS-randomized interval — LiMascot sets a class), `mascot-ear` (ear rotate ±6°, `--ease-spring`, on parent hover), `mascot-tilt` (head rotate 0→3°→0, ~8s cadence). `animated=false` or reduced-motion → static pose. `sp-lite-mark.svg` = the same geometry, no animation markup, standalone. `index.html` favicon → `/src/assets/brand/sp-lite-mark.svg` (keep as file link; Vite handles it).

- [ ] **Step 4: Run tests, eyeball, commit**

Run: `node --test tests/mascot.test.mjs && npm run build`
Eyeball in `npm run dev`: dog at 48px in header reads as the same dog as the old PNG; animation gentle; reduced-motion (devtools emulation) → static. Commit: `git add -A && git commit -m "feat(allo): replace GIF mascot with part-animated SVG retriever"`.

### Task 6: Shell B app frame + 404 route

**Files:**
- Rewrite: `src/App.vue`
- Modify: `src/router/index.js` (catch-all only), `src/lib/components/LiCommandPalette.vue` wiring (static command list), `src/modules/dd/components/DdSidebar.vue` untouched here
- Create: `src/modules/errors/views/NotFoundView.vue`

**Interfaces:**
- Consumes: `useTheme`, `LiMascot`/`LiLogo`, `LiCommandPalette`, `useAuth`/`useAccess`.
- Produces: Shell B frame — sticky top bar 56px (`--shadow-header`): LiLogo (mascot mark + "SP-lite" wordmark, Inter 800), module dropdown ("Products" pattern: current module + chevron; items = `modules` computed, same filter logic as today), Ctrl-K button (shows `Ctrl K` hint), theme toggle (Lucide `sun`/`moon`), avatar (LiAvatar → profile). Below 900: module dropdown collapses into menu sheet (LiBottomSheet) behind a hamburger. No persistent sidebar for non-DD routes — DD provides its own nested sidebar (Task 11). `router.push` semantics, `authError` toast logic, `handleLogout` unchanged. Command palette commands: navigate to each accessible module, `/profile`, `/admin` (if admin), toggle theme, sign out — nothing else.
- `NotFoundView.vue`: L7 per `errors.html` — centred 620, mascot, "404", one sentence, one primary action (Back to dashboard → `firstAccessibleRoute()`).

- [ ] **Step 1: Implement shell + route**

App.vue rewrite per Interfaces; delete mesh orbs, glass sidebar, all Lithium styles. Router: append `{ path: '/:pathMatch(.*)*', name: 'not-found', component: () => import('../modules/errors/views/NotFoundView.vue') }` It stays gated (not in `PUBLIC_ROUTES`): authed users see it inside the shell; unauth visitors redirect to login — correct.

- [ ] **Step 2: Verify**

Run: `npm run build && node --test tests/design-tokens.test.mjs`
In `npm run dev`: top bar at 56, theme toggle flips instantly and persists across reload, Ctrl-K opens palette, unknown `#/x` shows 404 with working button, mobile width (devtools 375) shows sheet nav. Commit: `git commit -am "feat(allo): Shell B app frame, Ctrl-K palette wiring, 404 route"`.

### Task 7: Landing (L1, light-only)

**Files:**
- Rewrite: `src/modules/landing/views/LandingView.vue`

**Interfaces:**
- Consumes: tokens, LiButton, LiMascot.
- Produces: L1 front door — site header 80 (logo, no menu needed: single-page), centred 1152/16-48-144 gutters, hero (mascot large, "SP-lite" display 800, one yellow primary CTA → `/login`), module cards for each public tool (Qris/Template/Video per module registry access — keep current data sourcing, same links), site footer. Scroll-reveal classes allowed here only (plain CSS `.reveal` + IntersectionObserver, not a component). Light-only: this view ignores dark (tokens still resolve; page sets its own light surface — simplest: wrap in a `data-theme="light"`-pinned container div style via `background: var(--color-bg)` on a scope that never flips — landing never renders the toggle, and if OS is dark the page still pins light by setting `document.documentElement.dataset.theme='light'` on mount, restoring on unmount).

- [ ] **Step 1: Implement + verify**

Reference: `mockups/marketing.html` hero/section/footer patterns at compact-adjacent scale. Delete LiGlassCard/LiMeshBackground/LiGradientText/LiMarquee/LiParallaxSection/LiRevealOnScroll usages (components themselves die in Task 15).
Run: `npm run build`. Eyeball 1440 + 375. Commit: `git commit -am "feat(allo): landing on L1"`.

### Task 8: Login (L2, comfortable)

**Files:**
- Rewrite styles/markup: `src/modules/auth/views/LoginView.vue`

**Interfaces:**
- Consumes: tokens, LiTextField, LiButton, LiMascot.
- Produces: L2 — bare centred column, card ≤640, 44–48px controls (comfortable sizing via local scope, not token overrides), mascot on the card head, exactly one primary action per step, links per `auth.html` (sign-up toggle keeps its current logic/flow untouched). All Supabase auth logic unchanged.

- [ ] **Step 1: Implement + verify**

Run: `npm run build`; eyeball light+dark at 1440/375; login with real credentials still works (`npm run dev`, full sign-in → dashboard). Commit: `git commit -am "feat(allo): login on L2"`.

### Task 9: Dashboard (L3)

**Files:**
- Rewrite styles/markup: `src/modules/dashboard/views/DashboardView.vue`

**Interfaces:**
- Produces: L3 — page head (title 24/700 + one muted line + actions right), stat tiles (LiCard skins: label `--text-xs` muted, value `--text-lg` strong), module shortcut grid, recent activity list (LiListTile). Keep current data sourcing (none — dashboard is static links today; do not invent data).

- [ ] **Step 1: Implement + verify**

Reference: `mockups/dashboard.html`. Run `npm run build`; eyeball light+dark. Commit: `git commit -am "feat(allo): dashboard on L3"`.

### Task 10: QRIS, Template Tools, Video Frames

**Files:**
- Modify: `src/modules/qris/views/QrisView.vue`, `src/modules/template-tools/views/TemplateToolsView.vue`, `src/modules/video-frames/views/VideoFramesView.vue`

**Interfaces:**
- Produces: centred ≤640 tool cards (L2 body, compact controls) — QRIS as steps (parse → fields → generate → history table with L5 skin), Template Tools as upload → convert → download flow with dropzone skin (`.drop` in app.css), Video Frames as file → timeline → extract with progress. All parsing/conversion logic unchanged. Every async state gets skeleton/empty/error/data where missing.

- [ ] **Step 1: Implement + verify, one module per commit**

Order: qris, template-tools, video-frames. After each: `npm run build` + eyeball light+dark; exercise the tool end-to-end in dev (QRIS parse a real code; DOCX convert a real file; frame-extract a real video). Commits: `feat(allo): qris on Allo`, `feat(allo): template-tools on Allo`, `feat(allo): video-frames on Allo`.

### Task 11: DD shell + DD dashboard

**Files:**
- Modify: `src/modules/dd/views/DdLayout.vue`, `src/modules/dd/components/DdSidebar.vue`, `src/modules/dd/views/DdDashboard.vue`

**Interfaces:**
- Produces: DdLayout gains the project sidebar inside Shell B content: 248 expanded / 56 collapsed (collapse toggle, state in localStorage `dd-sidebar`), sections per current grouping, `--color-selected` + 3px `--color-accent-strong` bar for current, below 900 a sheet. DdDashboard: L3 with stat tiles over existing data (today's counts/summaries — keep current queries), one period filter if data supports it.

- [ ] **Step 1: Implement + verify**

Reference: `mockups/board.html` sidebar + `dashboard.html`. Run `npm run build`; dev: sidebar collapse persists, menu gates (`canMenu`) still hide unauthorized items, deep link `#/dd/merchants` still lands. Commit: `git commit -am "feat(allo): DD shell sidebar and dashboard"`.

### Task 12: DD data tables

**Files:**
- Modify: `src/modules/dd/views/DdBuAccounts.vue`, `DdMerchants.vue`, `DdPromos.vue`

**Interfaces:**
- Consumes: LiTable skin from Task 4, `useDdTable.js` (untouched).
- Produces: L5 — filter row under page head (one row), 40px-row tables, bulk bar floating pill on selection (existing bulk upsert actions move into it), status lozenges for validity/state columns, four states. Edit flows stay in whatever overlay they use today, reskinned.

- [ ] **Step 1: Implement + verify, one screen per commit**

After each: `npm run build`; dev: list loads (real data), create/edit/delete one row works, bulk upsert works, CSV/XLSX export still emits `="…"` text columns unchanged (diff an export before/after if unsure). Commits: `feat(allo): dd bu-accounts table`, `… merchants …`, `… promos …`.

### Task 13: DD explorer, SQL editor, export, audit, email

**Files:**
- Modify: `src/modules/dd/views/DdTableExplorer.vue`, `DdSqlEditor.vue`, `DdExport.vue`, `DdAudit.vue`, `DdEmail.vue`

**Interfaces:**
- Produces: TableExplorer/SqlEditor = L5+L6 hybrid (two panes, mono font `--font-mono`, terminal-like SQL results table); Export = L5 page with column-spec lists and run buttons; Audit = timeline/activity-log skin (`.log` in app.css; `dd_audit_log` read-only list, one row per event, actor + relative time); Email = settings page pattern (`delivery-settings.html` reference) with log table. All logic (schema.js, columns.js, validate.js, sql-export.js, Edge Function call) untouched.

- [ ] **Step 1: Implement + verify, one screen per commit**

Run audit trail sanity: make one edit in dev, see it appear in DdAudit. Commits: `feat(allo): dd table-explorer`, `… sql-editor …`, `… export …`, `… audit …`, `… email …`.

### Task 14: Admin + Profile

**Files:**
- Modify: `src/modules/admin/views/AdminView.vue`, `src/modules/profile/views/ProfileView.vue`

**Interfaces:**
- Produces: Admin = L5 (users table with lozenge roles, role/module access panels as description lists + tables; RBAC writes untouched). Profile = settings variant (description list, forms with field skins, theme preference row reusing `useTheme`). Four states on every list.

- [ ] **Step 1: Implement + verify**

Dev: admin role-switch still works (write a role, sign in as affected user — or at minimum verify the RPC fires and UI reflects), profile save works. Commit: `git commit -am "feat(allo): admin and profile on Allo"`.

### Task 15: Lithium deletion sweep

**Files:**
- Delete: the 9 components (`LiGlassCard`, `LiGlassPanel`, `LiGradientText`, `LiMagneticButton`, `LiMarquee`, `LiMeshBackground`, `LiParallaxSection`, `LiRevealOnScroll`, `LiRipple`) + `src/lib/composables/useRipple.js` + `LiMotion.vue`, `LiKanbanColumn.vue` **if** `grep -r "LiMotion\|LiKanbanColumn" src` shows zero live usages after Tasks 7–14
- Modify: nothing else — by now every consumer is rewritten

- [ ] **Step 1: Verify zero usage, delete, gate**

Run: `grep -rn "LiGlass\|LiGradientText\|LiMagnetic\|LiMarquee\|LiMesh\|LiParallax\|LiRevealOnScroll\|LiRipple\|useRipple" src` → empty. Delete files.
Run: `node --test tests/design-tokens.test.mjs && npm run build` → **design-tokens test fully green now** (every view restyled). Commit: `git commit -am "chore(allo): delete Lithium layer"`.

### Task 16: Screenshot gate + docs

**Files:**
- Create: `scripts/shots.mjs`, `tests/fixtures/` (Supabase REST fixtures)
- Modify: `package.json` (`"shots": "node scripts/shots.mjs"`), `CLAUDE.md`, `README.md` (only if it names the old UI)

**Interfaces:**
- Produces: `npm run shots` — Playwright chromium, `npm run preview` server, route table = every route × {1440, 375} × {light, dark} minus landing-dark. Supabase REST fully route-mocked (`page.route('**/rest/v1/**', …)`) from `tests/fixtures/*.json` shaped from the real client's calls (check Network tab once in dev to capture exact URLs incl. `select=` params). Script asserts: zero unmocked requests, every shot non-blank (pixel variance check), writes `shots/<route>-<w>-<theme>.png`. Keyboard probe on one dialog route (Tab/Esc). Exits nonzero on any failure.

- [ ] **Step 1: Write harness, capture, compare, fix**

Run `npm run shots`. Build a contact sheet (or open the folder) comparing each shot against its reference mockup from the guide (`components.html`, `desk.html`, `dashboard.html`, `auth.html`, `board.html`, `errors.html`) — spacing, radius, tone, states. Fix deviations; re-shoot until the pass is clean. This is the spec's "cocok is a visual claim" gate — do not skip the eyeballing.
- [ ] **Step 2: Update CLAUDE.md**

Rewrite the Design system section: tokens source (guide repo path), role-name rule, density, theme mechanism (`useTheme`, `data-theme`), mascot (`LiMascot`, placement rules), shots gate (`npm run shots`), Lucide icon workflow (`icons:sync`). Remove Lithium references.
- [ ] **Step 3: Full verification + commit**

Run: `npm install && npm run icons:sync && npm run check:icons && node --test tests/*.test.mjs && npm run build && npm run shots`
Expected: all green. Commit: `git add -A && git commit -m "feat(allo): screenshot gate and docs"`.

---

## Sequencing note for executors

Tasks 1→2→3→4→5 are strictly ordered (each consumes the previous). Task 6 needs 1+2+5. Tasks 7–14 are parallelizable after 6 but each touches distinct files — execute in listed order. Task 15 requires all of 7–14. Task 16 requires everything.
