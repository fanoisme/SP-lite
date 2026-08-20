<template>
  <section class="ddmail">
    <header class="ddmail__head">
      <div>
        <h1 class="ddmail__title">Email Settings</h1>
        <p class="ddmail__sub">Recipients, subject, schedule and the HTML each scheduled report uses.</p>
      </div>
      <p class="ddmail__count">{{ settings.length }} {{ settings.length === 1 ? 'template' : 'templates' }}</p>
    </header>

    <!-- Remove this banner once a real send has reached the Zimbra host from
         Supabase's Edge runtime. Until then it is the only thing on the screen
         telling someone why a send they are about to make may fail, and a
         silent screen would make the failure look like their mistake. -->
    <LiBanner
      variant="warning"
      title="SMTP connectivity has not been verified"
      message="Nobody has yet confirmed that the company mail server answers from Supabase's Edge runtime. Sends may fail with 'could not reach the mail server' until that is sorted out. Every attempt, successful or not, is recorded in the history below."
    />

    <p v-if="error" class="ddmail__error">{{ error }}</p>

    <div v-if="loading" class="ddmail__loading">Loading…</div>

    <article v-for="row in settings" :key="row.template" class="ddmail__card">
      <header class="ddmail__card-head">
        <div>
          <h2 class="ddmail__card-title">{{ row.label }}</h2>
          <p class="ddmail__card-sub">{{ row.notes }}</p>
          <code class="ddmail__id">{{ row.template }}</code>
        </div>
        <div class="ddmail__card-state">
          <LiBadge
            v-if="row.last_status"
            :label="row.last_status === 'sent' ? 'Last send OK' : 'Last send failed'"
            :variant="row.last_status === 'sent' ? 'success' : 'error'"
            size="sm"
            is-pill
          />
          <span v-if="row.last_sent_at" class="ddmail__muted">{{ formatTs(row.last_sent_at) }}</span>
          <LiToggle
            v-model="form(row).is_enabled"
            :label="form(row).is_enabled ? 'Enabled' : 'Paused'"
            :disabled="!canWrite"
          />
        </div>
      </header>

      <div class="ddmail__fields">
        <div class="ddmail__full">
          <LiTextField
            v-model="form(row).subject"
            label="Subject"
            :disabled="!canWrite"
            :error="subjectError(row)"
            :helper-text="SUBJECT_HINT"
          />
        </div>
        <LiTextField
          v-model="form(row).to_addresses"
          label="To"
          :disabled="!canWrite"
          :error="toError(row)"
          helper-text="Comma-separated."
        />
        <LiTextField
          v-model="form(row).cc_addresses"
          label="CC"
          :disabled="!canWrite"
          :error="ccError(row)"
          helper-text="Optional. Leave empty for no copies."
        />
        <div class="ddmail__full">
          <LiTextField
            v-model="form(row).schedule_cron"
            label="Schedule (cron)"
            placeholder="Leave empty for manual only"
            :disabled="!canWrite"
            :helper-text="describeCron(form(row).schedule_cron)"
          />
        </div>
        <div class="ddmail__full">
          <LiTextField
            v-model="form(row).html"
            type="area"
            :rows="10"
            label="HTML wrapper"
            :disabled="!canWrite"
            :error="htmlError(row)"
            :helper-text="HTML_HINT"
          />
        </div>
      </div>

      <footer class="ddmail__card-foot">
        <p v-if="row.last_status === 'failed' && row.last_error" class="ddmail__last-error">
          {{ row.last_error }}
        </p>
        <span v-else-if="canWrite" class="ddmail__muted">{{ dirty(row) ? 'Unsaved changes' : 'Saved' }}</span>
        <span v-else class="ddmail__muted">Read only — you cannot change these settings.</span>

        <div class="ddmail__buttons">
          <LiButton variant="ghost" size="sm" :loading="busy === `preview:${row.template}`" @click="openPreview(row)">
            Preview
          </LiButton>
          <template v-if="canWrite">
            <!-- Not gated on the form being valid: the Edge Function sends the
                 saved row, so validating what is on screen would block a send
                 the server would accept and allow one it would not. The
                 confirm dialog names the saved recipients instead. -->
            <LiButton variant="secondary" size="sm" @click="askSend(row)">
              Send now
            </LiButton>
            <LiButton
              size="sm"
              :disabled="!dirty(row) || !valid(row)"
              :loading="busy === `save:${row.template}`"
              @click="onSave(row)"
            >
              Save
            </LiButton>
          </template>
        </div>
      </footer>
    </article>

    <section class="ddmail__history">
      <h2 class="ddmail__section">Send history</h2>
      <LiTable :data="log" :columns="logColumns" row-key="id" :loading="loading">
        <template #cell-ts="{ value }">{{ formatTs(value) }}</template>
        <template #cell-template="{ value }">{{ templateLabel(value) }}</template>
        <template #cell-status="{ value }">
          <LiBadge :label="value" :variant="value === 'sent' ? 'success' : 'error'" size="sm" is-pill />
        </template>
        <template #cell-recipients="{ value }">
          <template v-if="value">{{ value }}</template>
          <span v-else class="ddmail__muted">—</span>
        </template>
        <template #cell-error="{ value }">
          <span v-if="value" class="ddmail__err-cell">{{ value }}</span>
          <span v-else class="ddmail__muted">—</span>
        </template>
      </LiTable>
    </section>

    <!-- The wrapper is generated markup with inline styles meant for a mail
         client. Rendered with v-html it would join the app's DOM and inherit
         (and fight with) the app's CSS; a sandboxed iframe keeps it out of
         both. -->
    <LiModal v-model="previewOpen" :title="`Preview — ${previewSubject}`" size="lg">
      <iframe class="ddmail__preview" title="Email preview" sandbox="" :srcdoc="previewHtml" />
      <template #footer>
        <LiButton variant="ghost" @click="previewOpen = false">Close</LiButton>
      </template>
    </LiModal>

    <!-- This one leaves the building, so every address is named before it does. -->
    <LiModal v-model="sendOpen" title="Send now" size="sm">
      <p class="ddmail__confirm">
        Send <b>{{ sendTarget?.label }}</b> immediately, using the settings currently saved on the server?
      </p>
      <p v-if="sendDirty" class="ddmail__confirm ddmail__confirm--warn">
        This template has unsaved changes. The mail goes out with the saved values, not what is on screen.
      </p>
      <ul class="ddmail__recipients">
        <li v-for="a in sendRecipients" :key="a.address">
          <span class="ddmail__kind">{{ a.kind }}</span>{{ a.address }}
        </li>
      </ul>
      <template #footer>
        <LiButton variant="ghost" @click="sendOpen = false">Cancel</LiButton>
        <LiButton :loading="busy === `send:${sendTarget?.template}`" @click="onSend">Send</LiButton>
      </template>
    </LiModal>
  </section>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import LiBanner from '@lib/components/LiBanner.vue'
import LiBadge from '@lib/components/LiBadge.vue'
import LiButton from '@lib/components/LiButton.vue'
import LiModal from '@lib/components/LiModal.vue'
import LiTable from '@lib/components/LiTable.vue'
import LiTextField from '@lib/components/LiTextField.vue'
import LiToggle from '@lib/components/LiToggle.vue'
import { useToast } from '@lib/composables/useToast.js'
import { useDdAccess } from '../composables/useDdAccess.js'
import { useDdEmail } from '../composables/useDdEmail.js'
import { PLACEHOLDERS, templateLabel } from '../lib/email-templates.js'

// Built in script, not written inline in the template: mustaches inside a
// plain attribute value are ambiguous to read and one stray `:` would turn
// this copy into a broken expression.
const SUBJECT_HINT = '{{date}} becomes today\'s date, {{brand}} becomes DD MPM.'
const HTML_HINT =
  'Must contain {{body}} — that is where the generated report is spliced in. ' +
  `Also available: ${PLACEHOLDERS.filter(p => p !== '{{body}}').join(' ')}`

const toast = useToast()
const { canMenu } = useDdAccess()
const { settings, log, loading, error, load, save, sendNow, preview, describeCron } = useDdEmail()

// Read-only is the default here: someone with email.read sees every value and
// no button that changes anything.
const canWrite = computed(() => canMenu('email', 'update'))

// Editable copies, keyed by template. The server rows stay untouched so `dirty`
// has something to compare against, and so a failed save leaves the screen
// showing what the person typed rather than snapping back.
const forms = reactive({})
// One id at a time, so only the button that was pressed spins.
const busy = ref('')

const previewOpen = ref(false)
const previewHtml = ref('')
const previewSubject = ref('')

const sendOpen = ref(false)
const sendTarget = ref(null)

const EDITABLE = ['subject', 'to_addresses', 'cc_addresses', 'html', 'schedule_cron', 'is_enabled']

const logColumns = [
  { key: 'ts', label: 'When' },
  { key: 'template', label: 'Template' },
  { key: 'status', label: 'Status' },
  { key: 'recipients', label: 'Recipients' },
  { key: 'actor', label: 'By' },
  { key: 'error', label: 'Error' },
]

function seedOne(template) {
  const row = settings.value.find(r => r.template === template)
  if (row) forms[template] = Object.fromEntries(EDITABLE.map(k => [k, row[k] ?? '']))
}

// Only ever called on first load. Re-seeding everything after one card is saved
// would silently discard what someone had typed into the other two.
function seed() {
  for (const row of settings.value) seedOne(row.template)
}

function form(row) {
  if (!forms[row.template]) forms[row.template] = Object.fromEntries(EDITABLE.map(k => [k, row[k] ?? '']))
  return forms[row.template]
}

function dirty(row) {
  return EDITABLE.some(k => String(form(row)[k] ?? '') !== String(row[k] ?? ''))
}

const addressList = v => String(v || '').split(/[,;]/).map(a => a.trim()).filter(Boolean)
const badAddress = a => !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(a)

function subjectError(row) {
  return form(row).subject.trim() ? '' : 'Subject is required'
}
function toError(row) {
  if (!form(row).to_addresses.trim()) return 'At least one recipient is required'
  const bad = addressList(form(row).to_addresses).filter(badAddress)
  return bad.length ? `Invalid address: ${bad[0]}` : ''
}
function ccError(row) {
  const bad = addressList(form(row).cc_addresses).filter(badAddress)
  return bad.length ? `Invalid address: ${bad[0]}` : ''
}
function htmlError(row) {
  const html = form(row).html || ''
  // The database has the same CHECK. Saying so here means the person finds out
  // while typing rather than from a constraint violation on save.
  return html && !html.includes('{{body}}')
    ? 'The wrapper must keep {{body}}: that is where the generated report goes.'
    : ''
}
function valid(row) {
  return !subjectError(row) && !toError(row) && !ccError(row) && !htmlError(row)
}

async function onSave(row) {
  busy.value = `save:${row.template}`
  try {
    const values = Object.fromEntries(EDITABLE.map(k => [k, form(row)[k]]))
    const res = await save(row.template, values)
    seedOne(row.template)
    toast.success(`${row.label} saved`)
    // Scheduling is best-effort: pg_cron may not be installed. Report what
    // actually happened rather than implying the schedule is live.
    if (res.schedule) toast.info(res.schedule, 6000)
  } catch (e) {
    toast.error(e.message, 8000)
  } finally {
    busy.value = ''
  }
}

async function openPreview(row) {
  busy.value = `preview:${row.template}`
  try {
    const res = await preview(row.template)
    previewHtml.value = res.html
    previewSubject.value = res.subject
    previewOpen.value = true
  } catch (e) {
    toast.error(e.message, 8000)
  } finally {
    busy.value = ''
  }
}

const sendRecipients = computed(() => {
  const row = sendTarget.value
  if (!row) return []
  return [
    ...addressList(row.to_addresses).map(address => ({ kind: 'To', address })),
    ...addressList(row.cc_addresses).map(address => ({ kind: 'CC', address })),
  ]
})

// The Edge Function reads the saved row, so a dirty form would send something
// other than what the screen shows. Say so instead of quietly saving first.
const sendDirty = computed(() => (sendTarget.value ? dirty(sendTarget.value) : false))

function askSend(row) {
  sendTarget.value = row
  sendOpen.value = true
}

async function onSend() {
  const row = sendTarget.value
  if (!row) return
  busy.value = `send:${row.template}`
  try {
    await sendNow(row.template)
    toast.success(`${row.label} sent`)
    sendOpen.value = false
  } catch (e) {
    // Left open: the failure is the answer to the question the dialog asked,
    // and the history table behind it now has the attempt.
    toast.error(e.message, 12000)
  } finally {
    // No re-seed: sendNow reloads the rows for the history and the last_*
    // badges, and none of that belongs in the edit forms.
    busy.value = ''
  }
}

function formatTs(v) {
  if (!v) return '—'
  return new Date(v).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

onMounted(async () => {
  await load()
  seed()
})
</script>

<style scoped>
.ddmail { display: flex; flex-direction: column; gap: var(--space-md, 16px); }
.ddmail__head { display: flex; align-items: flex-end; justify-content: space-between; gap: 12px; }
.ddmail__title { font-size: 24px; font-weight: 800; margin: 0; letter-spacing: -0.4px; }
.ddmail__sub { font-size: 14px; color: var(--color-gray-500, #8e8ea0); margin: 2px 0 0; }
.ddmail__count { font-size: 13px; color: var(--color-gray-500, #8e8ea0); margin: 0; white-space: nowrap; }
.ddmail__loading { font-size: 13px; color: var(--color-gray-500, #8e8ea0); }
.ddmail__error {
  font-size: 13px; color: var(--color-red-400, #C83E3B);
  background: rgba(200, 62, 59, 0.08);
  border-radius: var(--radius-sm, 12px); padding: 10px 14px; margin: 0;
}

.ddmail__card {
  display: flex; flex-direction: column; gap: var(--space-sm, 12px);
  padding: var(--space-md, 16px);
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: var(--radius-md, 16px);
  background: var(--color-surface, #fff);
}
.ddmail__card-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
.ddmail__card-title { font-size: 16px; font-weight: 700; margin: 0; }
.ddmail__card-sub { font-size: 13px; color: var(--color-gray-500, #8e8ea0); margin: 2px 0 0; }
.ddmail__card-state { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; justify-content: flex-end; }
.ddmail__id {
  display: inline-block; margin-top: 6px;
  font-family: var(--font-mono, ui-monospace, monospace); font-size: 11px;
  background: rgba(0, 0, 0, 0.04); border-radius: 5px; padding: 1px 6px;
}

.ddmail__fields {
  display: grid; grid-template-columns: 1fr 1fr;
  gap: var(--space-sm, 12px) var(--space-md, 16px); align-items: start;
}
.ddmail__full { grid-column: 1 / -1; }

.ddmail__card-foot { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.ddmail__buttons { display: flex; align-items: center; gap: 8px; margin-left: auto; }
.ddmail__muted { font-size: 12px; color: var(--color-gray-400, #aaa); }
/* The last failure is the most useful thing on the card while SMTP is
   unconfirmed, so it takes the footer slot rather than hiding in the table. */
.ddmail__last-error {
  margin: 0; font-size: 12.5px; line-height: 1.5;
  color: var(--color-red-400, #C83E3B);
  flex: 1 1 320px; min-width: 0;
}

.ddmail__history { display: flex; flex-direction: column; gap: var(--space-sm, 12px); }
.ddmail__section {
  margin: var(--space-sm, 12px) 0 0; font-size: 11px; font-weight: 700;
  letter-spacing: 0.08em; text-transform: uppercase;
  color: var(--color-gray-400, #aaa);
}
.ddmail__err-cell { font-size: 12px; color: var(--color-red-400, #C83E3B); }

.ddmail__preview {
  width: 100%; height: 60vh; border: none;
  border-radius: var(--radius-sm, 12px); background: #EFF1F4;
}

.ddmail__confirm { margin: 0 0 8px; font-size: 14px; line-height: 1.7; color: var(--color-gray-700, #666); }
.ddmail__confirm--warn { color: var(--color-red-400, #C83E3B); }
.ddmail__recipients { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 4px; }
.ddmail__recipients li {
  font-family: var(--font-mono, ui-monospace, monospace); font-size: 12.5px;
  display: flex; align-items: baseline; gap: 8px;
}
.ddmail__kind {
  font-family: var(--font-body, 'Inter', sans-serif); font-size: 10px; font-weight: 700;
  letter-spacing: 0.08em; text-transform: uppercase;
  color: var(--color-gray-400, #aaa); min-width: 22px;
}

@media (max-width: 900px) {
  .ddmail__fields { grid-template-columns: 1fr; }
  .ddmail__card-head { flex-direction: column; }
  .ddmail__card-state { justify-content: flex-start; }
}
</style>
