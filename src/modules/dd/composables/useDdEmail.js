import { ref } from 'vue'
import { supabase } from '@/lib/supabase.js'
import { useAuth } from '@/composables/useAuth.js'
import { EMAIL_TEMPLATES, TEMPLATE_IDS } from '../lib/email-templates.js'

// Three rows and a short history: both tables are small and bounded, so this
// reads them whole rather than paging like useAuditLog does.
const LOG_LIMIT = 100

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

/**
 * Plain-English rendering of a five-field cron, so nobody has to decode
 * `0 3 * * 2` to find out when a mail leaves. Deliberately narrow: it explains
 * the shapes this screen writes (fixed minute, fixed hour, a weekday or every
 * day) and says plainly when an expression is outside that, rather than
 * guessing and being confidently wrong.
 *
 * pg_cron fires on the database's clock, which is UTC on Supabase, so the WIB
 * time is spelled out too — that offset is the whole reason the seeds look
 * seven hours early.
 */
export function describeCron(expr) {
  const raw = String(expr || '').trim()
  if (!raw) return 'Not scheduled — this template only goes out when you press Send now.'

  const f = raw.split(/\s+/)
  if (f.length !== 5) return `Unrecognised schedule (${raw}). Five space-separated fields are expected.`

  const [min, hour, dom, mon, dow] = f
  const isNum = v => /^\d+$/.test(v)
  if (!isNum(min) || !isNum(hour) || dom !== '*' || mon !== '*') {
    return `Runs on cron ${raw} (UTC). Too complex to spell out here — check it against crontab.guru.`
  }

  const utc = `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')} UTC`
  // WIB is UTC+7 and has no daylight saving, so this is a plain shift.
  const wibHour = (Number(hour) + 7) % 24
  const rolls = Number(hour) + 7 >= 24
  const wib = `${String(wibHour).padStart(2, '0')}:${String(min).padStart(2, '0')} WIB`

  let when
  if (dow === '*') when = 'Every day'
  else if (isNum(dow) && Number(dow) <= 6) {
    // A UTC weekday that rolls past midnight is the next day locally, and that
    // is exactly the mistake this sentence exists to prevent.
    when = `Every ${DAY_NAMES[rolls ? (Number(dow) + 1) % 7 : Number(dow)]}`
  } else return `Runs on cron ${raw} (UTC). Too complex to spell out here — check it against crontab.guru.`

  return `${when} at ${wib} (${utc}).`
}

export function useDdEmail() {
  const { profile, session } = useAuth()

  const settings = ref([])
  const log = ref([])
  const loading = ref(true)
  const error = ref(null)

  const actor = () => profile.value?.full_name || session.value?.user?.email || 'SYSTEM'

  async function load() {
    loading.value = true
    error.value = null
    try {
      const [s, l] = await Promise.all([
        supabase.from('dd_email_settings').select('*'),
        supabase.from('dd_email_log').select('*').order('id', { ascending: false }).limit(LOG_LIMIT),
      ])
      if (s.error) throw s.error
      if (l.error) throw l.error
      // Registry order, not the database's: the three mails are a sequence
      // (remind, confirm, export) and an alphabetical list reads as noise.
      const rank = t => {
        const i = TEMPLATE_IDS.indexOf(t)
        return i === -1 ? TEMPLATE_IDS.length : i
      }
      settings.value = (s.data || []).slice().sort((a, b) => rank(a.template) - rank(b.template))
      log.value = l.data || []
    } catch (e) {
      error.value = e.message
      settings.value = []
      log.value = []
    } finally {
      loading.value = false
    }
  }

  /**
   * Saves one template, then rebuilds the cron jobs from the saved rows. The
   * two are one action on purpose: a schedule edited on screen but never
   * installed is the drift DD's Admin screen needed a warning banner for.
   */
  async function save(template, values) {
    const patch = {
      ...values,
      updated_by: actor(),
      updated_at: new Date().toISOString(),
    }
    const { data, error: e } = await supabase
      .from('dd_email_settings').update(patch).eq('template', template).select().single()
    if (e) throw new Error(e.message)

    const i = settings.value.findIndex(r => r.template === template)
    if (i !== -1) settings.value[i] = data

    // A project without pg_cron answers with a sentence rather than an error,
    // and a save must not be reported as failed because scheduling is off.
    const { data: note, error: syncErr } = await supabase.rpc('dd_email_sync_schedules')
    return { row: data, schedule: syncErr ? syncErr.message : note }
  }

  /**
   * Unwraps supabase-js's function errors. On a non-2xx the client throws away
   * the body and hands back a FunctionsHttpError, so the structured
   * `{ error, stage }` this function returns — the actual reason the send
   * failed — has to be read off the raw Response.
   */
  async function invoke(payload) {
    const { data, error: e } = await supabase.functions.invoke('dd-send-email', { body: payload })
    if (!e) return data
    let detail = null
    try { detail = await e.context?.json?.() } catch { /* not JSON, keep the generic message */ }
    throw new Error(detail?.error || e.message)
  }

  async function sendNow(template) {
    const res = await invoke({ template })
    await load()
    return res
  }

  /** Renders without sending: no log row, no recipient is touched. */
  async function preview(template) {
    return await invoke({ template, preview: true })
  }

  /** Static copy for a template id — label, and the sample the preview uses. */
  function meta(template) {
    return EMAIL_TEMPLATES[template] || null
  }

  return {
    settings, log, loading, error,
    load, save, sendNow, preview, meta, describeCron,
  }
}
