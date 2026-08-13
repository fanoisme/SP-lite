# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Vite dev server (hot reload)
npm run build     # production build → dist/
npm run preview   # preview production build locally
```

No test suite exists. No linter is configured.

## Architecture

**Stack:** Vue 3 SPA (Composition API, `<script setup>`) + Vite + Vue Router (hash history) + Supabase JS client. Zero backend — static site hosted on GitHub Pages.

**Routing:** Hash-based (`createWebHashHistory`) because GitHub Pages can't rewrite server-side. Supabase auth uses PKCE flow so `?code=` params don't collide with `#/path` fragments.

**Auth:** Supabase Auth (`src/composables/useAuth.js`). Profile is fetched via `ensure_profile()` RPC — it self-heals if the DB trigger missed a signup. Session state is module-level singleton (shared across all consumers). Login sets `session.value` synchronously before `router.push` because the router guard reads it synchronously — relying on `onAuthStateChange` alone is too slow.

**Access control (RBAC):** Mirrors SO-Platform. Access tables live in Supabase (`roles`, `module_access`, `feature_access`, `module_state`, `user_access`) with RLS. Resolution is client-side via `src/lib/access.js` (`computeAccess` — pure function, verbatim port of SO-Platform). Admin role gets all modules/features; other roles get role-granted modules + per-user overrides (deny wins). Non-admin privilege escalation is blocked by DB trigger.

**Module registry:** `src/lib/modules.js` — static `MODULE_REGISTRY` array. Single source of truth for module ids, labels, icons, and feature lists. Must stay in sync with DB seeds in `supabase/schema.sql`.

**DD module shape:** `dd` is the only module with its own nested router and a
second-level sidebar (`src/modules/dd/views/DdLayout.vue` +
`components/DdSidebar.vue`), because it ports DD MPM — a twelve-screen app with
grouped navigation. Its index child keeps `name: 'dd'` so SP-lite's sidebar and
`firstAccessibleRoute()`, which resolve a module to `{ name: moduleId }`, keep
working unchanged.

**DD access has two axes.** Menu scopes (`merchants.update`) and database scopes
(`db.ihybrid_discount.update`) are granted independently, and a table is
reachable through either — DD's `canWriteSheet` rule. Both are stored as
`feature_access` rows under the single `dd` module; the OR lives in
`src/modules/dd/composables/useDdAccess.js`, never in `src/lib/access.js`, which
is a verbatim port of SO-Platform's and shared by every module.

**Path aliases** (from `vite.config.js`):
- `@` → `src/`
- `@lib` → `src/lib/`

**Design system:** Custom component library in `src/lib/components/` (LiButton, LiModal, LiTable, etc.). Design tokens in `src/assets/tokens.css`.

## Key files

| File | Role |
|------|------|
| `src/main.js` | App entry — mounts Vue, imports global CSS |
| `src/App.vue` | Shell: sidebar, mobile nav, page transitions, auth error toast |
| `src/router/index.js` | Route definitions + `beforeEach` guard (auth gate) |
| `src/composables/useAuth.js` | Session/profile/access singleton, login/logout/signup |
| `src/composables/useAccess.js` | `canModule()` / `canFeature()` predicates |
| `src/lib/access.js` | Pure `computeAccess()` + Supabase-backed `buildAccessContext` |
| `src/lib/modules.js` | Static module registry |
| `src/lib/supabase.js` | Supabase client singleton |
| `src/lib/qris-core.js` | EMVCo QRIS TLV parser + CRC-16 (runs in browser) |
| `src/lib/export-xlsx.js` | Excel export helper (uses `xlsx` package) |
| `supabase/schema.sql` | Full DB schema + seed data — idempotent, re-runnable |
| `supabase/migrations/` | Incremental migration scripts (named by date) |

## Modules

Each module lives under `src/modules/<name>/` with its own `views/`, `components/`, `composables/` (no `index.js` — views are lazy-loaded via `router/index.js`).

| Module | Path | Backend |
|--------|------|---------|
| landing | `/` | None |
| auth | `/login` | Supabase Auth |
| dashboard | `/dashboard` | None |
| qris | `/qris` | localStorage + `qris_history` table (Supabase) |
| template-tools | `/template-tools` | None (client-side DOCX→HTML→FTL) |
| video-frames | `/video-frames` | None (canvas-based frame extraction) |
| qrdd | `/qrdd` | Supabase tables: `qrdd_bu_accounts`, `qrdd_merchant_whitelist`, `qrdd_promo_rules` |
| dd | `/dd` (nested) | Supabase: `dd_audit_log` (+ reads the `qrdd_*` tables) |
| admin | `/admin` | Supabase RBAC tables |
| profile | `/profile` | Supabase `profiles` table |

## Supabase schema

All tables use Row Level Security. Key constraint: **only Admin can write to RBAC tables**; all authenticated users can read them (needed for access computation). `qris_history` is per-user via `insert_qris_history()` RPC (security definer). QRDD tables (`qrdd_bu_accounts`, `qrdd_merchant_whitelist`, `qrdd_promo_rules`) allow all authenticated users full CRUD (open RLS, gated by module/feature access at the app level).

`supabase/schema.sql` is the full idempotent schema (safe to re-run). `supabase/migrations/` contains incremental changes as dated files.

`dd_audit_log` is **append-only**: `authenticated` holds `select` and nothing
else, TRUNCATE is explicitly revoked from `anon` and `authenticated` (it would
otherwise bypass both RLS and row triggers), and the only writer is the
`dd_audit_row()` trigger (security definer) on the three `qrdd_*` tables. It
records one row per record for INSERT/DELETE and one row per changed column for
UPDATE, skipping `updated_at`/`updated_by`. When a key column is itself renamed
the old key is stamped into `detail` so the history stays linkable. The actor
comes from `dd_actor()` (`auth.uid()` → `profiles.full_name`), not from the
client-supplied `created_by`/`updated_by` columns.

## Deployment

Pushing to `main` triggers `.github/workflows/deploy-pages.yml` → builds with Vite → publishes `dist/` to GitHub Pages. Secrets `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` must be set in repo Actions secrets. Build is stale for ~1-2 min after push.

## Docs

Specs and plans live in `docs/superpowers/specs/` and `docs/superpowers/plans/` — dated markdown files. Read relevant ones before touching a module.

The DD module is a phased port of the `VIBE/DD` Apps Script app. Phase 1 is
specced in `docs/superpowers/specs/2026-08-13-dd-module-phase1-design.md` — read
its "Revision" subsection, which records why the first pill-tab shell was
replaced by DD's real sidebar — and planned in
`docs/superpowers/plans/2026-08-13-dd-module-phase1-rev2.md`. That spec's header
lists all six phases. The plan was itself amended mid-flight: Phase 1 was
originally specced with a single `/dd` route and a pill-tab strip, which was
built, rejected on sight, and reverted in favour of DD's real nested-route-plus-
sidebar shape described above — commit `6d91b54` in the log is that reverted
attempt, not live code. `qrdd` is retired after Phase 2; until then both modules
ship and `qrdd` is the working surface for BU accounts, merchants and promos.
