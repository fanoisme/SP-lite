# SP-lite × Allo Design System — full restyle

**Date:** 2026-10-31
**Status:** approved in conversation, pending builder check
**Scope:** every module, every screen, one pass — visual restyle only.

## Intent

SP-lite is an internal Allo Bank tool wearing a generic "Lithium" skin — glassmorphism,
organic blobs, cursor spotlight, glow shadows. The Allo Design System
(`E:\Work\Vibe\design-system-guide`, our own repo) exists to prevent exactly that. This
project retires the Lithium layer entirely and rebuilds SP-lite's UI on the Allo tokens,
components and layouts, so the tool looks and behaves like an Allo product.

The guide's README is explicit about method, and we follow it: **build from the mockups,
not from the prose** — lift markup and patterns from `mockups/*.html` + `mockups/app.css`,
load the same `tokens.css`, and prove the result visually with screenshots, never from
the spec alone.

## Goals

1. Allo tokens (light + dark) replace Lithium tokens, verbatim from the guide.
2. All 18 views across 9 modules restyled to Allo components, compact density.
3. App shell becomes the guide's Shell B (top bar 56 + collapsible sidebar 248/56).
4. Dark mode shipped: `data-theme="dark"` value swap, stored choice wins.
5. The mascot becomes a layered, part-animated SVG golden retriever (see §7) — replacing
   the broken cross-dissolve GIF (root cause: blending photographed poses produces
   double-exposure ghosting, not motion; unfixable by tuning).
6. Verified by screenshots of every screen, light + dark, ≥1280 and 375, compared
   side-by-side against the guide's mockups.

## Non-goals

- No router, RBAC, Supabase, or CRUD-behavior changes. Routes, guards, data flow, module
  registry, DD's schema/columns/validate layers untouched.
- No bilingual copy. Existing English copy stays; structure must not block adding ID later.
- No new features. A screen gets a new component skin, not new capabilities (exception:
  missing list states — loading/empty/error — are part of the restyle, per APP.md rule 4).
- No mobile PWA. Responsive collapse ladder only (SP-lite is desktop-first internal).
- Retrivo is **not** used — the mascot is SP-lite's own dog, redrawn (§7).

## Anti-goals

- Screens that "look Allo-ish" but invent values — hex codes, paddings, radii, durations
  not in the tokens — is failure even if it looks finished.
- Any surviving Lithium artifact (glass, mesh, spotlight, glow-shadow, blob shapes,
  marquee, parallax) anywhere in the app.
- Glass/expressive components kept "temporarily" because a screen still references them.

## Constraints

- Vue 3 `<script setup>` + existing `Li*` component API stays: props, events, slots
  unchanged, so views keep working while internals are restyled. Rename/delete only
  components whose concept dies (§5).
- Zero-backend static site; fonts self-hosted (guide's `fonts/Inter-latin.woff2`), no
  Google Fonts request, no new npm dependency unless a screen provably needs one
  (target: none).
- DD's timestamps/export facts (CLAUDE.md) are behavior, untouched by this restyle.
- Guide gates (`contrast.py`, `validate_palette.py`) don't re-run: tokens are copied
  verbatim and already validated. Only the mascot introduces new art colors (§7).

## Decisions

### 1. Tokens & fonts

- `src/assets/tokens.css` ← guide's `tokens.css` verbatim (both themes, viz palette,
  motion tokens, base rules), with the `@font-face` path pointing at
  `src/assets/fonts/Inter-latin.woff2` (copied from the guide, with its OFL licence note
  in a comment).
- Lithium token file content is deleted, not archived in place. Any global CSS still
  reading Lithium variables gets rewritten in the same pass (see §5).
- Theme switching: `data-theme="dark"` on `<html>`, set by a tiny composable
  (`useTheme`): stored choice > OS preference > light, instant swap, no cross-fade.
  Toggle lives in the top bar (sun/moon Lucide icon) and persists in localStorage.

### 2. Density & shells

- **Compact** everywhere (body 14/20, inputs 32px, pills 28/32/40), per APP.md §1 —
  internal tool used daily.
- Two comfortable exceptions, allowed by the guide (mixing across a product is fine,
  never inside one screen):
  - `auth` — L2 focused flow, centred card ≤640, 44–48px controls, from
    `mockups/auth.html`.
  - `landing` — L1 front door, centred 1152, from `mockups/index.html`/`marketing.html`
    patterns. Scroll reveals allowed here only.
- Everything else: **Shell B** — sticky product top bar 56 (logo, module nav, Ctrl-K
  search, theme toggle, avatar), collapsible sidebar 248/56 on module screens where a
  second level exists (DD), mobile menu sheet below 900. One scrolling region per view.

### 3. Screen → layout map (reference mockup for each)

| View | Layout | Density | Reference |
|---|---|---|---|
| LandingView | L1 front door | comfortable | marketing.html, index.html |
| LoginView | L2 flow | comfortable | auth.html |
| DashboardView | L3 overview | compact | dashboard.html |
| QrisView | L2 flow (multi-step tool) | compact controls in a centred ≤640 card | payment.html patterns (steps, hero result) |
| TemplateToolsView | L2/L7 hybrid centred tool | compact | onboarding.html (upload/review steps) |
| VideoFramesView | L2 hybrid centred tool | compact | onboarding.html |
| DdLayout + DdSidebar | Shell B nested sidebar | compact | board.html shell |
| DdDashboard | L3 | compact | dashboard.html |
| DdBuAccounts, DdMerchants, DdPromos | L5 queue & table | compact | desk.html (40px rows, sticky header, bulk bar) |
| DdTableExplorer, DdSqlEditor | L5/L6 hybrid | compact | desk.html + wiki.html (two panes) |
| DdExport, DdAudit, DdEmail | L5 variants | compact | desk.html, report.html |
| AdminView | L5 | compact | desk.html |
| ProfileView | L4-shell settings variant | compact | desk.html context panel patterns |
| 404 / auth errors | L7 | matches parent | errors.html |

Every list/table gets the four states: skeleton, empty state, error banner + retry,
data (APP.md rule 4). Statuses map to the six tones (neutral/info/discovery/success/
warning/danger) as lozenges.

### 4. Component layer (`src/lib/components/`)

Restyle in place, skins lifted from `mockups/app.css` + `components.html`: LiButton
(one yellow primary per view, secondary/subtle/danger/link, loading, 3 compact sizes),
LiInput/LiSelect/LiCheckbox/etc. (32px, label/help/error, 2px focus ring), LiTable
(40px rows, sticky header, sticky first column where wide, bulk action bar), LiModal
(dialog + bottom sheet), LiDrawer (600, focus trap, Esc), LiBanner family, LiToast
stack bottom-right, LiSkeleton, LiEmptyState, LiTabs (underline, gliding ink),
LiStepper, LiPagination, LiBadge → status lozenge, LiDropdown/LiCommandPalette
(Ctrl-K), LiAccordion, LiDatePicker, LiComboBox.

Keyboard/focus/copy rules from `components.md` apply (Esc closes and returns focus;
icon-only buttons labeled; visible 2px ring, `on-accent` ring on yellow fills).

### 5. Deletions (Lithium concepts with no Allo equivalent)

- Components: LiGlassCard, LiGlassPanel, LiMeshBackground, LiGradientText, LiMarquee,
  LiParallaxSection, LiMagneticButton, LiRipple, LiRevealOnScroll (landing keeps plain
  scroll reveals via a small CSS class, not a component).
- CSS: spotlight cursor, glass blur/saturate, glow shadows, blob shapes, 3D perspective
  tokens, `--cta-*` block, breathe/pulse ambience — all removed with their consumers
  rewritten the same pass.
- `src/assets/brand/sp-lite-golden.gif`, `build-golden-logo.py`, and the chroma-key
  pipeline. `sp-lite-golden.png` is superseded by the SVG (§7).

### 6. Icons

Lucide only, 16px stroke 2 in compact UI. SP-lite recently moved to local SVG assets
(commit fba5f4d) — keep the local-asset approach (no icon-font/npm package), swapping
any non-Lucide glyphs for Lucide paths.

### 7. Mascot — layered SVG golden retriever

- **One SVG**, flat-vector redraw in the guide's visual language (flat fills, minimal
  lines, fur from the amber ramp `--viz-seq-300…600` + `--color-accent`, ink
  `--color-text-strong`), preserving the current dog's identity (golden head, friendly).
  No bandana — that's Retrivo's.
- **Parts as separate groups** with pivots: head, left/right ear, eyes (upper+lower
  lids for blink), snout/nose, brow, chest. New `LiMascot.vue` renders it inline
  (currentColor-safe, size-prop, `role="img"` + `aria-label` when standalone,
  `aria-hidden` when decorative).
- **Animation = transforms on parts only** (CSS keyframes, Allo motion tokens):
  breathing (chest scale ~3s), blink (lid scaleY, every ~4–6s randomized), ear flop on
  hover, occasional head tilt (~8s cadence, `--ease-spring` for the flop/tilt). No
  cross-dissolves, no sprite swaps. `prefers-reduced-motion` → static pose.
  This idle loop is a deliberate, documented deviation from "nothing loops forever"
  (MOTION.md) — it is the logo, it is gentle, and the user asked for it.
- **Static export**: same SVG rendered as `sp-lite-mark.svg` (one file, two uses —
  animated in-app via `LiMascot`, static for favicon/print).
- **Placement** (adapted from MASCOT.md §3): header mark, landing hero, empty states,
  friendly errors, loading >2s. Never on destructive confirmations or dense tables.
  One per screen.

### 8. Motion

Allo motion tokens only (`--dur-*`, `--ease-*`, `--stagger` 28ms cap 8). Compact rules:
state changes only, nothing auto-advances (landing scroll reveals excepted). Reduced
motion honoured globally by the token file's own `@media` block plus component CSS.

### 9. Verification (the "cocok is a visual claim" rule)

- `npm run build` must pass; every route screenshotted at 1440 and 375, light and dark
  (Playwright script, reduced-motion off, deterministic) — checked against the
  referenced mockup per screen, plus a scroll-through of interactive states (hover,
  focus, one open dialog, one error banner).
- `tests/logo-assets.test.mjs` rewritten for the SVG mascot (valid SVG, parts present,
  reduced-motion static exists). Existing tests keep passing.
- SP-lite `CLAUDE.md` updated: design system section rewritten (tokens source, density,
  theme mechanism, mascot, verification script).

## Builder check — resolved (my calls unless flagged)

1. **`app.css` is mined, not vendored.** The guide's "load the same app.css" is its
   mockup-page method. In a Vue component system, patterns port into the `Li*`
   components' scoped styles; a shared `src/assets/allo-base.css` carries only the
   global base rules (reset-ish bits the token file doesn't own). No 171KB page CSS.
2. **Landing stays light-only** — APP.md §5: the marketing site stays light. The dark
   screenshot matrix covers auth + authed product routes; landing drops out of it.
   Login (L2) is a product surface and gets dark.
3. **Screenshot harness:** Playwright as a **devDependency** (the no-new-deps constraint
   covers the shipped bundle; devDeps for tooling are fine — same ruling as the icon
   sync source below). Supabase REST calls are **route-mocked with fixtures** — fully
   deterministic, no live project, no writes, no flake. Fixtures model the admin role
   only; RBAC-filtered nav is access.js logic, already covered, not restyle scope.
4. **Mascot is fixed-palette art, not token-driven** — MASCOT.md's own precedent: the
   Retrivo head "keeps its illustrated colors… it is art, not a token color". Fur uses
   literal light-theme values in both themes (reads golden on dark surfaces too);
   favicon/print use the same static fills.
5. **Router exception, exactly one:** add a `/:pathMatch(.*)*` catch-all → L7 404 view.
   "No router changes" otherwise stands.
6. **Ctrl-K palette searches routes/modules + static commands** (theme toggle, logout).
   No Supabase reads — palette stays presentation-layer.
7. **Icons migrate honestly:** registry names become Lucide names (rewrite
   `scripts/icon-names.mjs`, the ~130 assets, every `LiIcon name=` usage, and the
   governance scripts/tests); sync source switches to `lucide-static` (devDep, local
   SVGs stay the shipped assets). Stroke-only — the `filled` prop is dropped; the one
   filled check glyph (checkbox) becomes an inline path in LiCheckbox.

## Left to the builder

- Exact per-screen DOM/class adjustments and icon choices.
- Which tables earn sticky-first-column / bulk bar (only where rows are selectable
  today).
- The dog's vector geometry (must read as the same dog as the old PNG at 48px).
- Sequencing within the pass (suggested: tokens+fonts → shell → core Li components →
  auth → landing/dashboard → tools → DD → admin/profile → mascot → dark → screenshots).

## Why (for the record)

The mascot decision chain: the GIF was diagnosed (cross-dissolve between photographed
poses ghosts; 64-color palette bands; no holds), the fix-by-tuning path was rejected as
architectural, Retrivo was offered and declined by the user in favour of redrawing
SP-lite's own dog as part-animated SVG.
