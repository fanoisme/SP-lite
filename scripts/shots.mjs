// Screenshot gate (plan Task 16): every route × {1440,375} × {light,dark},
// Supabase fully route-mocked, deterministic. Exits nonzero on any failure:
// unmocked network request, blank shot, or a broken dialog keyboard probe.
import { spawn, spawnSync } from 'node:child_process'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { chromium } from 'playwright'

const ROOT = resolve(new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'))
const OUT = resolve(ROOT, 'shots')
const FIXTURES = JSON.parse(await readFile(new URL('../tests/fixtures/access.json', import.meta.url), 'utf8'))

const TABLES = ['roles', 'module_access', 'feature_access', 'module_state', 'user_access',
  'qrdd_bu_accounts', 'qrdd_merchant_whitelist', 'qrdd_promo_rules', 'dd_audit_log',
  'dd_email_settings', 'dd_email_log', 'qris_history']

const SESSION = {
  access_token: 'shot-token',
  refresh_token: 'shot-refresh',
  token_type: 'bearer',
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  user: {
    id: FIXTURES.profile.id,
    email: FIXTURES.profile.email,
    aud: 'authenticated',
    role: 'authenticated',
    app_metadata: { provider: 'email' },
    user_metadata: {},
    created_at: '2026-01-01T00:00:00Z',
  },
}

const ROUTES = [
  ['login', '/login', true],
  ['dashboard', '/dashboard', false],
  ['qris', '/qris', false],
  ['template-tools', '/template-tools', false],
  ['video-frames', '/video-frames', false],
  ['dd', '/dd', false],
  ['dd-business-units', '/dd/business-units', false],
  ['dd-merchants', '/dd/merchants', false],
  ['dd-promos', '/dd/promos', false],
  ['dd-table', '/dd/table/qrdd_promo_rules', false],
  ['dd-export', '/dd/export', false],
  ['dd-audit', '/dd/audit', false],
  ['dd-sql', '/dd/sql', false],
  ['dd-email', '/dd/email', false],
  ['admin', '/admin', false],
  ['profile', '/profile', false],
  ['not-found', '/definitely-missing', false],
]

const unmocked = []
let shotIndex = 0

function fixtureFor(pathname) {
  const table = pathname.split('/').pop()
  if (TABLES.includes(table)) return FIXTURES[table] ?? []
  return []
}

async function mockSupabase(page) {
  await page.route('**/auth/v1/**', async route => {
    const url = new URL(route.request().url())
    if (url.pathname.endsWith('/token')) {
      return route.fulfill({ json: SESSION })
    }
    if (url.pathname.endsWith('/logout')) {
      return route.fulfill({ status: 204, body: '' })
    }
    return route.fulfill({ json: SESSION.user })
  })
  await page.route('**/rest/v1/**', async route => {
    const url = new URL(route.request().url())
    if (url.pathname.includes('/rpc/')) {
      return route.fulfill({ json: FIXTURES.profile })
    }
    return route.fulfill({ json: fixtureFor(url.pathname) })
  })
  page.on('request', req => {
    const u = req.url()
    if (u.includes('supabase') && !u.startsWith('https://placeholder.supabase.co')) {
      unmocked.push(u)
    }
  })
}

async function shot(page, name, path, width, theme, bare) {
  await page.setViewportSize({ width, height: width > 1000 ? 900 : 720 })
  if (!bare) {
    await page.evaluate(t => {
      const stored = t === 'light' || t === 'dark' ? t : null
      document.documentElement.dataset.theme = stored || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    }, theme)
  } else if (name !== 'landing') {
    await page.evaluate(t => { document.documentElement.dataset.theme = t }, theme)
  }
  await page.goto(`http://localhost:4173/SP-lite/#${path}`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(400)
  const file = `${OUT}/${name}-${width}-${theme}.png`
  await page.screenshot({ path: file, fullPage: false })
  shotIndex += 1
  // non-blank: png size above a blank-page floor (~2kB of flat colour compresses tiny)
  const buf = await readFile(file)
  if (buf.length < 4000) {
    throw new Error(`suspiciously small (blank?) screenshot: ${file} (${buf.length} bytes)`)
  }
}

// preview server on the built bundle
const preview = spawn(process.execPath, [resolve(ROOT, 'node_modules/vite/bin/vite.js'), 'preview', '--port', '4173', '--strictPort'], {
  cwd: ROOT, stdio: 'pipe',
})
async function waitPort(url, ms = 30000) {
  const deadline = Date.now() + ms
  while (Date.now() < deadline) {
    try {
      const r = await fetch(url)
      if (r.ok || r.status > 0) return
    } catch { /* not up yet */ }
    await new Promise(r => setTimeout(r, 250))
  }
  throw new Error('preview server did not start')
}
await waitPort('http://localhost:4173/SP-lite/')

let failures = []
try {
  await rm(OUT, { recursive: true, force: true })
  await mkdir(OUT, { recursive: true })
  const browser = await chromium.launch()
  const context = await browser.newContext({
    reducedMotion: 'reduce',
    colorScheme: 'light',
    deviceScaleFactor: 1,
  })
  await context.addInitScript(session => {
    try {
      localStorage.setItem('sb-placeholder-auth-token', session)
    } catch { /* ignore */ }
  }, JSON.stringify(SESSION))
  const page = await context.newPage()
  await mockSupabase(page)

  for (const [name, path, bare] of ROUTES) {
    for (const width of [1440, 375]) {
      for (const theme of ['light', 'dark']) {
        try {
          await shot(page, name, path, width, theme, bare)
        } catch (e) {
          failures.push(`${name} ${width} ${theme}: ${e.message}`)
        }
      }
    }
  }

  // keyboard probe: dialog on qris (history detail) or dd promos — open the
  // first focusable overlay we can find via Ctrl+K palette instead (always present)
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.evaluate(() => { document.documentElement.dataset.theme = 'light' })
  await page.goto('http://localhost:4173/SP-lite/#/dashboard', { waitUntil: 'networkidle' })
  await page.keyboard.press('Control+KeyK')
  await page.waitForTimeout(300)
  const paletteVisible = await page.isVisible('.li-command-palette')
  if (!paletteVisible) failures.push('keyboard probe: Ctrl+K did not open the command palette')
  await page.keyboard.press('Escape')
  await page.waitForTimeout(500)
  const paletteGone = !(await page.isVisible('.li-command-palette'))
  if (!paletteGone) failures.push('keyboard probe: Escape did not close the command palette')

  await browser.close()
} finally {
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/pid', String(preview.pid), '/T', '/F'], { shell: true })
  } else {
    preview.kill('SIGTERM')
  }
}

if (unmocked.length) failures.push(`unmocked supabase requests (${unmocked.length}): ${unmocked.slice(0, 3).join(', ')}`)
if (failures.length) {
  console.error('SHOT GATE FAILED:\n' + failures.join('\n'))
  process.exit(1)
}
console.log(`shot gate passed: ${shotIndex} screenshots in shots/, zero unmocked requests, keyboard probe ok`)
