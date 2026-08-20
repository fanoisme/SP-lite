// DD module — report bodies for the scheduled emails (Phase 6).
//
// Port of the HTML building blocks in DD's gas/Mailer.gs. Everything here is
// pure: rows in, markup out, no Supabase, no Vue, no browser API. That is what
// lets the Deno Edge Function (supabase/functions/dd-send-email) import this
// exact file, so the preview in DdEmail.vue and the mail that actually leaves
// the building are rendered by the same code rather than two that drift.
//
// Inline styles only. Mail clients strip <style> blocks and class attributes,
// so a rule that is not on the element does not exist.

export const BRAND = {
  name: 'DD MPM',
  subtitle: 'Direct Discount MPM',
  gold: '#FFAF03',
  orange: '#FF6B00',
  ink: '#333333',
  muted: '#808080',
  faint: '#999999',
  line: '#E6E6E6',
  surface: '#F5F7FA',
  success: '#059669',
  info: '#0047B2',
  danger: '#C83E3B',
}

// Business timezone. The mails report Indonesian business hours whichever
// region the function happens to run in, so every date below is formatted
// against this rather than the host's locale.
export const TZ = 'Asia/Jakarta'

/**
 * Character budget for one message.
 *
 * Every row is listed in full. The only reason to stop is Gmail, which clips a
 * message past roughly 102 kB and hides the rest behind "View entire message",
 * so the tables share one budget and say how many rows were left out.
 */
export const BODY_BUDGET = 70000

export function escapeHtml(v) {
  return String(v === null || v === undefined ? '' : v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function toDate(v) {
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v
  if (v === null || v === undefined || v === '') return null
  const d = new Date(v)
  return isNaN(d.getTime()) ? null : d
}

function parts(d) {
  // en-GB gives "1 Sep 2026" / "09:14" rather than the American ordering, which
  // is what DD's Utilities.formatDate patterns produced.
  const f = new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ, day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', weekday: 'long', hour12: false,
  }).formatToParts(d)
  const o = {}
  for (const p of f) o[p.type] = p.value
  return o
}

/** '1 Sep 2026' */
export function fmtDate(v) {
  const d = toDate(v)
  if (!d) return ''
  const p = parts(d)
  return `${p.day} ${p.month} ${p.year}`
}

/** '1 Sep 2026 09:14' */
export function fmtDateTime(v) {
  const d = toDate(v)
  if (!d) return ''
  const p = parts(d)
  return `${p.day} ${p.month} ${p.year} ${p.hour}:${p.minute}`
}

/** '11 Aug 09:14' — the compact form the change list uses. */
export function fmtDayTime(v) {
  const d = toDate(v)
  if (!d) return ''
  const p = parts(d)
  return `${p.day} ${p.month} ${p.hour}:${p.minute}`
}

/** 'Monday, 1 Sep 2026 09:14' */
export function fmtFull(v) {
  const d = toDate(v)
  if (!d) return ''
  const p = parts(d)
  return `${p.weekday}, ${p.day} ${p.month} ${p.year} ${p.hour}:${p.minute}`
}

/* ── Building blocks ─────────────────────────────────────────────────────── */

/** Coloured stat tiles, three across. */
export function statTiles(items) {
  const cells = items.map(s => (
    `<td width="33%" style="padding:6px;" valign="top">` +
    `<div style="background:${s.bg || BRAND.surface};border-radius:12px;padding:14px 16px;">` +
    `<div style="font-size:24px;font-weight:700;color:${s.color || BRAND.ink};line-height:1.1;">${escapeHtml(s.value)}</div>` +
    `<div style="font-size:12px;color:${BRAND.muted};margin-top:3px;">${escapeHtml(s.label)}</div>` +
    `</div></td>`
  )).join('')
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 8px;"><tr>${cells}</tr></table>`
}

export function sectionTitle(text) {
  return `<div style="font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;` +
    `color:${BRAND.faint};margin:18px 0 8px;">${escapeHtml(text)}</div>`
}

export function pill(text, color, bg) {
  return `<span style="display:inline-block;padding:2px 9px;border-radius:999px;background:${bg};` +
    `color:${color};font-size:11px;font-weight:600;">${escapeHtml(text)}</span>`
}

export function callout(html, tone) {
  const map = {
    warn: { bg: '#FFF3D6', color: '#FF3000' },
    bad: { bg: '#FDECEE', color: BRAND.danger },
    good: { bg: '#D7F9E9', color: BRAND.success },
  }
  const c = map[tone] || map.warn
  return `<div style="background:${c.bg};color:${c.color};border-radius:12px;padding:12px 16px;` +
    `font-size:13px;line-height:1.6;margin:4px 0 8px;">${html}</div>`
}

export function newBudget() {
  return { left: BODY_BUDGET }
}

/**
 * Data table with a header row. `rows` is an array of arrays whose cells are
 * already-escaped HTML — callers pass pills and other markup through here.
 * Pass the shared budget so one long table cannot clip the ones after it.
 */
export function dataTable(headers, rows, emptyText, budget) {
  if (!rows.length) {
    return `<div style="font-size:13px;color:${BRAND.faint};padding:10px 0;">${escapeHtml(emptyText)}</div>`
  }
  let kept = rows
  let omitted = 0
  if (budget) {
    kept = []
    for (const row of rows) {
      // The markup around each cell costs far more than the value in it, so the
      // estimate charges a fixed overhead per cell rather than measuring.
      const size = row.join('').length + 90 * row.length
      if (budget.left - size < 0 && kept.length) { omitted = rows.length - kept.length; break }
      budget.left -= size
      kept.push(row)
    }
  }
  const head = headers.map(h => (
    `<th align="left" style="padding:8px 10px;background:${BRAND.surface};font-size:11px;` +
    `text-transform:uppercase;letter-spacing:0.04em;color:${BRAND.muted};font-weight:600;">${escapeHtml(h)}</th>`
  )).join('')
  const body = kept.map(r => (
    '<tr>' + r.map(c => (
      `<td style="padding:9px 10px;border-top:1px solid ${BRAND.line};font-size:12.5px;color:${BRAND.ink};">${c}</td>`
    )).join('') + '</tr>'
  )).join('')
  const note = omitted
    ? `<div style="font-size:12px;color:${BRAND.faint};padding:8px 0 0;">${omitted} further row(s) are not ` +
      `shown here so the message is not clipped by the mail client. Open the app to see the rest.</div>`
    : ''
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" ` +
    `style="border-collapse:collapse;border:1px solid ${BRAND.line};border-radius:10px;overflow:hidden;">` +
    `<tr>${head}</tr>${body}</table>${note}`
}

const INSERT_PILL = () => pill('INSERT', BRAND.success, '#D7F9E9')
const UPDATE_PILL = () => pill('UPDATE', BRAND.info, '#E6E6FF')

/* ── Report bodies ───────────────────────────────────────────────────────── */

/**
 * data: {
 *   activeCount: number,
 *   expiring: [{ name, bu, end, days }],   // ends within 14 days, still ACTIVE
 *   overdue:  [{ name, end, days }],       // end date passed, still ACTIVE
 * }
 */
function buildPromoReminder(data) {
  const expiring = data.expiring || []
  const overdue = data.overdue || []
  const budget = newBudget()

  let body = statTiles([
    { value: data.activeCount ?? 0, label: 'Active promos', bg: '#FFF3D6', color: BRAND.orange },
    { value: expiring.length, label: 'Ending in 14 days' },
    { value: overdue.length, label: 'Past end date, still active', color: overdue.length ? BRAND.danger : BRAND.ink },
  ])

  if (overdue.length) {
    body += callout(
      `<b>${overdue.length} promo(s) are still ACTIVE after their end date.</b> They no longer apply, but ` +
      'anyone reading the table sees them as live. Each one needs to be deactivated or given a new end date.',
      'bad',
    )
    body += sectionTitle('Already past their end date')
    body += dataTable(
      ['Promo', 'Ended', 'Overdue by'],
      overdue.map(p => [
        escapeHtml(p.name),
        fmtDate(p.end),
        pill(`${p.days} day(s)`, '#FFFFFF', BRAND.danger),
      ]),
      '',
      budget,
    )
  }

  body += sectionTitle('Ending within 14 days')
  body += dataTable(
    ['Promo', 'Business unit', 'Ends', 'Countdown'],
    expiring.map(p => [
      escapeHtml(p.name),
      escapeHtml(p.bu),
      fmtDate(p.end),
      // Three days or fewer is solid red: at that point it is not a heads-up.
      p.days <= 3
        ? pill(p.days === 0 ? 'today' : `${p.days} days`, '#FFFFFF', BRAND.danger)
        : pill(`${p.days} days`, '#FF3000', '#FFF3D6'),
    ]),
    'Nothing is ending in the next 14 days.',
    budget,
  )

  body += sectionTitle('What is expected this week')
  body += `<div style="font-size:13.5px;line-height:1.75;color:${BRAND.ink};">` +
    'Please record the Direct Discount promos for the coming period, and settle the ones listed above by ' +
    'extending the end date or setting the status to inactive. The confirmation email reports whatever ' +
    'stands in the tables when it runs, so an entry made after that point is carried to the following week.' +
    '</div>'

  return body
}

/**
 * data: {
 *   lookbackDays: number, since: Date|string, until: Date|string,
 *   totals:   [{ label, records }],                       // whole-table counts
 *   perTable: [{ label, inserts, updates, total }],       // moved this window
 *   detail:   [{ kind: 'INSERT'|'UPDATE', label, record, key, when, by }],
 * }
 */
function buildDataConfirmation(data) {
  const totals = data.totals || []
  const perTable = data.perTable || []
  const detail = data.detail || []
  const records = totals.reduce((a, t) => a + (t.records || 0), 0)
  const inserts = perTable.reduce((a, t) => a + (t.inserts || 0), 0)
  const updates = perTable.reduce((a, t) => a + (t.updates || 0), 0)
  const budget = newBudget()

  let body = statTiles([
    { value: records, label: 'Records in total' },
    { value: inserts, label: 'Rows inserted', bg: '#D7F9E9', color: BRAND.success },
    { value: updates, label: 'Rows updated', bg: '#E6E6FF', color: BRAND.info },
  ])

  body += sectionTitle('Total records held')
  body += dataTable(
    ['Table', 'Records'],
    totals.map(t => [escapeHtml(t.label), String(t.records ?? 0)]),
    'No table has any rows yet.',
    budget,
  )

  body += sectionTitle(`Inserted or changed in the last ${data.lookbackDays} days`)
  body += `<div style="font-size:13px;color:${BRAND.muted};margin:0 0 8px;">` +
    `${fmtDateTime(data.since)} to ${fmtDateTime(data.until)} WIB.</div>`
  body += dataTable(
    ['Table', 'Inserted', 'Updated', 'Total'],
    perTable.map(t => [
      escapeHtml(t.label), String(t.inserts ?? 0), String(t.updates ?? 0), String(t.total ?? 0),
    ]),
    'No table changed.',
    budget,
  )

  body += sectionTitle('Every change in the window')
  body += dataTable(
    ['Action', 'Table', 'Record', 'Key', 'When', 'By'],
    detail.map(r => [
      r.kind === 'INSERT' ? INSERT_PILL() : UPDATE_PILL(),
      escapeHtml(r.label),
      escapeHtml(r.record),
      escapeHtml(r.key),
      fmtDayTime(r.when),
      escapeHtml(r.by),
    ]),
    'Nothing was inserted or updated in this window.',
    budget,
  )

  if (!inserts && !updates) {
    body += callout(
      'No changes were recorded in this window. If that is not what you expect, the edits were most likely ' +
      'made straight against the database rather than through the app, in which case they carry no ' +
      'timestamp and cannot be reported here.',
      'warn',
    )
  }

  return body
}

/**
 * data: {
 *   lookbackDays: number, since: Date|string, until: Date|string,
 *   manifest: [{ db, table, type: 'INSERT'|'UPDATE', statements, cache }],
 * }
 *
 * DD attached the workbook itself here. SP-lite's Edge Function sends the
 * manifest only and leaves the file to the Export Center — see the note in
 * supabase/functions/dd-send-email/index.ts.
 */
function buildWeeklyExport(data) {
  const manifest = data.manifest || []
  const statementCount = manifest.reduce((a, m) => a + (m.statements || 0), 0)
  const tableCount = manifest.filter(m => !m.cache).length
  const dataRows = manifest.filter(m => !m.cache).reduce((a, m) => a + (m.statements || 0), 0)
  const budget = newBudget()

  let body = statTiles([
    { value: statementCount, label: 'Statements to run', bg: '#D7F9E9', color: BRAND.success },
    { value: tableCount, label: 'Tables in the export' },
    { value: dataRows, label: 'Rows behind them' },
  ])

  body += `<div style="font-size:13px;color:${BRAND.muted};margin:4px 0;">` +
    `Covers ${fmtDateTime(data.since)} to ${fmtDateTime(data.until)} WIB.</div>`

  body += sectionTitle('Apply in this order')
  body += dataTable(
    ['#', 'Target', 'Type', 'Statements'],
    manifest.map((m, i) => [
      String(i + 1),
      `<span style="font-family:Consolas,Menlo,monospace;font-size:12px;">${escapeHtml(`${m.db}.${m.table}`)}</span>` +
        (m.cache ? `<div style="font-size:11.5px;color:${BRAND.faint};margin-top:2px;">cache reset</div>` : ''),
      m.cache ? UPDATE_PILL() : INSERT_PILL(),
      String(m.statements ?? 0),
    ]),
    'Nothing changed in this window, so there is nothing to apply.',
    budget,
  )

  if (statementCount) {
    body += sectionTitle('What is inside')
    body += `<div style="font-size:13.5px;line-height:1.75;color:${BRAND.ink};">` +
      'Each database ends with its <b>app_instances</b> reset, which clears the cached static data so the ' +
      `new rows are picked up. The ${dataRows} row(s) behind these statements are downloaded from the ` +
      'Export Center in the app, where the <b>id</b> column is left out so the target database assigns its ' +
      'own and <b>created_by</b>/<b>updated_by</b> are written as SYSTEM.' +
      '</div>'
  } else {
    body += callout(
      'No rows changed in this window, so there is nothing to apply. Nothing needs to be run.',
      'warn',
    )
  }

  return body
}

/* ── Registry ────────────────────────────────────────────────────────────── */

// template id -> { label, title, intro, build(data), sample }
//
// `title` and `intro` fill the wrapper's {{title}}/{{intro}}; they are here
// rather than in the settings row because they describe what the mail computed,
// which is code, not configuration. `sample` drives the preview so someone
// editing the wrapper sees a realistic mail without hitting the database.
export const EMAIL_TEMPLATES = {
  promo_reminder: {
    label: 'Promo update reminder',
    title: 'Promo entries for the coming period',
    intro: 'The promos that are about to expire, and the ones that have already passed their end date.',
    build: buildPromoReminder,
    sample: {
      activeCount: 12,
      overdue: [{ name: 'Transmart Ramadan', end: '2026-08-02', days: 11 }],
      expiring: [
        { name: 'Transmart Payday', bu: 'Transmart', end: '2026-09-01', days: 3 },
        { name: 'Multimart Weekend', bu: 'Multimart', end: '2026-09-04', days: 6 },
      ],
    },
  },
  data_confirmation: {
    label: 'Data confirmation',
    title: 'Recorded changes awaiting your confirmation',
    intro: 'Every record inserted or updated in the last 6 days, listed in full so it can be verified before the data is applied.',
    build: buildDataConfirmation,
    sample: {
      lookbackDays: 6,
      since: '2026-08-14T09:00:00+07:00',
      until: '2026-08-20T09:00:00+07:00',
      totals: [
        { label: 'BU Accounts', records: 14 },
        { label: 'Merchants', records: 431 },
        { label: 'Promo Rules', records: 37 },
      ],
      perTable: [
        { label: 'BU Accounts', inserts: 0, updates: 0, total: 0 },
        { label: 'Merchants', inserts: 6, updates: 2, total: 8 },
        { label: 'Promo Rules', inserts: 2, updates: 3, total: 5 },
      ],
      detail: [
        { kind: 'INSERT', label: 'Promo Rules', record: 'Transmart Payday', key: 'PRM-0091', when: '2026-08-19T09:14:00+07:00', by: 'Stefano' },
        { kind: 'UPDATE', label: 'Merchants', record: 'Multimart Kelapa Gading', key: '1029384', when: '2026-08-18T16:02:00+07:00', by: 'Rina' },
      ],
    },
  },
  weekly_export: {
    label: 'Weekly export',
    title: 'Export manifest for the past 6 days',
    intro: 'The statements for this period, listed in the order they should be applied.',
    build: buildWeeklyExport,
    sample: {
      lookbackDays: 6,
      since: '2026-08-14T09:00:00+07:00',
      until: '2026-08-20T09:00:00+07:00',
      manifest: [
        { db: 'ihybrid_order', table: 'discount_bu_accounts', type: 'INSERT', statements: 4, cache: false },
        { db: 'ihybrid_order', table: 'app_instances', type: 'UPDATE', statements: 1, cache: true },
        { db: 'ihybrid_discount', table: 'merchant_whitelist', type: 'INSERT', statements: 6, cache: false },
        { db: 'ihybrid_discount', table: 'promo_rule', type: 'INSERT', statements: 2, cache: false },
        { db: 'ihybrid_discount', table: 'app_instances', type: 'UPDATE', statements: 1, cache: true },
      ],
    },
  },
}

export const TEMPLATE_IDS = Object.keys(EMAIL_TEMPLATES)

export function templateLabel(id) {
  return EMAIL_TEMPLATES[id]?.label ?? id
}

/** Placeholders the wrapper may use, shown as a hint on the edit screen. */
export const PLACEHOLDERS = [
  '{{title}}', '{{intro}}', '{{body}}', '{{brand}}',
  '{{subtitle}}', '{{app_button}}', '{{date}}', '{{generated_at}}',
]

function appButton(appUrl) {
  if (!appUrl) return ''
  return '<tr><td style="padding:0 32px 28px;">' +
    `<a href="${escapeHtml(appUrl)}" style="display:inline-block;background:${BRAND.gold};color:#1E1E1E;` +
    `text-decoration:none;font-weight:700;font-size:14px;padding:12px 22px;border-radius:999px;">` +
    `Open ${BRAND.name}</a></td></tr>`
}

/**
 * Splices a rendered report body into the wrapper stored on the settings row.
 * Keeping the wrapper in the database means wording and styling change without
 * a deploy; this only supplies the parts that are computed.
 */
export function renderTemplate(wrapperHtml, { title, intro, body, appUrl, now } = {}) {
  const at = now || new Date()
  return String(wrapperHtml || '')
    .replace(/\{\{brand\}\}/g, BRAND.name)
    .replace(/\{\{subtitle\}\}/g, BRAND.subtitle)
    .replace(/\{\{title\}\}/g, title || '')
    .replace(/\{\{intro\}\}/g, intro || '')
    // {{body}} last among the content slots would still be safe, but the button
    // is substituted after it so a body that happens to contain the literal
    // string {{app_button}} cannot inject one.
    .replace(/\{\{body\}\}/g, body || '')
    .replace(/\{\{app_button\}\}/g, appButton(appUrl))
    .replace(/\{\{generated_at\}\}/g, fmtFull(at))
    .replace(/\{\{date\}\}/g, fmtDate(at))
}

/** Subject line from the settings row, with the same date/brand placeholders. */
export function renderSubject(subject, now) {
  const at = now || new Date()
  return String(subject || '')
    .replace(/\{\{date\}\}/g, fmtDate(at))
    .replace(/\{\{brand\}\}/g, BRAND.name)
}

/**
 * One call from raw data to a finished message. Both the Edge Function and the
 * preview go through here, so a template that renders in the browser renders
 * identically on the way out.
 */
export function renderEmail(templateId, wrapperHtml, data, options = {}) {
  const tpl = EMAIL_TEMPLATES[templateId]
  if (!tpl) throw new Error(`Unknown email template: ${templateId}`)
  return renderTemplate(wrapperHtml, {
    title: tpl.title,
    intro: tpl.intro,
    body: tpl.build(data || tpl.sample),
    appUrl: options.appUrl,
    now: options.now,
  })
}
