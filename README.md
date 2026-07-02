# SP-lite

Static build of three tools from [SO-Platform](https://github.com/fanoisme/SO-Platform), plus a
landing page, login, and an admin panel backed by [Supabase](https://supabase.com):

- **QRIS Tools** — generate and parse EMVCo QRIS codes (client-side EMVCo TLV + CRC-16 logic, history in `localStorage`)
- **Template Tools** — DOCX → HTML/FTL conversion and preview (client-side; PDF rendering sidecar is not included, falls back to the approximate client preview)
- **Video Frames** — extract distinct frames from a video file (100% client-side, canvas-based)

No server of its own — the app is still a static site hosted on GitHub Pages, but authentication and
the `profiles` table live in Supabase and are called directly from the browser.

## Why this exists

SO-Platform is a full-stack internal tool (Express + PGlite + JWT + a proxy to an internal-only DDS-MW service) and can't be hosted on GitHub Pages as-is. SP-lite carves out the subset of modules that have no backend dependency, adds Supabase for auth/data instead of a custom backend, and hosts the result for free on GitHub Pages.

## Setup

### 1. Create a Supabase project
Create a project at [supabase.com/dashboard](https://supabase.com/dashboard), then open **SQL Editor**
and run [`supabase/schema.sql`](supabase/schema.sql) once. It creates the `profiles` table, the
trigger that auto-creates a profile on signup, and the Row Level Security policies that gate `/admin`.

### 2. Local dev credentials
Copy `.env.example` to `.env.local` (already gitignored — never commit it) and fill in your project's
URL and **anon/public** key from *Settings → API*:

```bash
cp .env.example .env.local
```

The anon key is safe to put in frontend code — it has no special privileges on its own; access is
enforced by the RLS policies in `supabase/schema.sql`. Never use the `service_role` key here.

### 3. Install & run

```bash
npm install
npm run dev      # local dev server
npm run build    # production build -> dist/
```

### 4. First admin account
Sign up once through the app's Login page, then in the Supabase SQL Editor run:

```sql
update public.profiles set role = 'admin' where username = 'your_username';
```

That account can now see the Admin nav item and manage other users' roles/active status at `/admin`.

## Deployment

Pushing to `main` triggers `.github/workflows/deploy-pages.yml`, which builds and publishes `dist/` to
GitHub Pages automatically. Before the first deploy, add two **repository secrets** (Settings →
Secrets and variables → Actions) with the same values as your `.env.local`:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

These are injected as build-time env vars and never appear in the git history — only in the built
JS bundle shipped to the browser, which is expected for a Supabase anon key.
