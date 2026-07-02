# SP-lite

Public, static, backend-free build of three tools from [SO-Platform](https://github.com/fanoisme/SO-Platform):

- **QRIS Tools** — generate and parse EMVCo QRIS codes (client-side EMVCo TLV + CRC-16 logic, history in `localStorage`)
- **Template Tools** — DOCX → HTML/FTL conversion and preview (client-side; PDF rendering sidecar is not included, falls back to the approximate client preview)
- **Video Frames** — extract distinct frames from a video file (100% client-side, canvas-based)

No login, no server, no database, no proxy to any internal system. Everything runs in the browser.

## Why this exists

SO-Platform is a full-stack internal tool (Express + PGlite + JWT + a proxy to an internal-only DDS-MW service) and can't be hosted on GitHub Pages as-is. SP-lite carves out the subset of modules that have no backend dependency, so they can be hosted for free on GitHub Pages.

## Development

```bash
npm install
npm run dev      # local dev server
npm run build    # production build -> dist/
```

## Deployment

Pushing to `main` triggers `.github/workflows/deploy-pages.yml`, which builds and publishes `dist/` to GitHub Pages automatically.
