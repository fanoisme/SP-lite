<template>
  <LiModal
    :model-value="modelValue"
    :title="isEdit ? 'Edit promo rule' : (isDuplicate ? 'Duplicate promo rule' : 'New promo rule')"
    size="lg"
    @update:model-value="close"
  >
    <div class="ddpromoform">
      <!-- Every problem at once. validateRow returns the whole list and the
           person deserves to see it — fixing one field only to be told about
           the next is what the old qrdd form did. -->
      <ul v-if="problems.length" class="ddpromoform__problems">
        <li v-for="p in problems" :key="p">{{ p }}</li>
      </ul>

      <p v-if="isDuplicate" class="ddpromoform__note">
        Copied from <code>{{ duplicateOf.promo_id }}</code>. A fresh promo ID has been generated;
        everything else is editable before you save.
      </p>

      <div class="ddpromoform__grid">
        <!-- ── Identity ────────────────────────────────────────────────── -->
        <p class="ddpromoform__section">Identity</p>

        <div class="ddpromoform__field">
          <LiTextField
            v-model="form.promo_id"
            label="Promo ID *"
            :disabled="isEdit"
            :error="idError"
            :helper-text="isEdit ? 'The primary key — it cannot be changed after creation.' : idHint"
            placeholder="e.g. transmart_payday_26_08_1"
          />
          <!-- Only offered on create: an edit addresses the row by this value. -->
          <button
            v-if="!isEdit"
            class="ddpromoform__generate"
            type="button"
            :disabled="!form.promo_name.trim()"
            :title="form.promo_name.trim() ? 'Generate from the promo name' : 'Enter a promo name first'"
            @click="generate"
          >
            <LiIcon name="autorenew" />
            Generate
          </button>
        </div>

        <LiTextField
          v-model="form.promo_name"
          label="Promo name *"
          placeholder="e.g. Transmart Payday Special"
        />

        <!-- ── Scope ───────────────────────────────────────────────────── -->
        <p class="ddpromoform__section">Scope</p>

        <LiSelect
          v-model="form.bu_name"
          label="Business unit *"
          placeholder="- select business unit -"
          :options="buOptions"
          helper-text="Must already exist in BU Accounts."
        />
        <!-- No placeholder here: "All merchants" is a real choice with a real
             value ('' -> SQL NULL), not an unfilled field. -->
        <LiSelect
          v-model="form.merchant_id"
          label="Merchant"
          :options="merchantOptions"
          helper-text="All merchants means the rule applies to every whitelisted merchant."
        />

        <!-- ── Period ──────────────────────────────────────────────────── -->
        <p class="ddpromoform__section">Period</p>

        <LiTextField v-model="form.start_date" label="Start date *" type="date" />
        <LiTextField v-model="form.end_date" label="End date *" type="date" :error="dateError" />

        <!-- ── Channels ────────────────────────────────────────────────── -->
        <p class="ddpromoform__section">Discount channels</p>

        <div v-for="ch in CHANNELS" :key="ch.prefix" class="ddpromoform__channel">
          <span class="ddpromoform__channel-name">{{ ch.label }}</span>

          <LiSelect
            v-model="form.ch[ch.prefix].type"
            label="Eligibility"
            :options="eligibilityOptions"
          />

          <!-- Hidden, not disabled: a channel with no type carries no value and
               no cap at all, and a greyed-out box invites the reader to wonder
               what number is hiding in it. -->
          <template v-if="form.ch[ch.prefix].type">
            <LiTextField
              v-model="form.ch[ch.prefix].value"
              label="Discount value *"
              type="number"
              :suffix="form.ch[ch.prefix].type === 'PERCENTAGE' ? '%' : 'Rp'"
              :helper-text="form.ch[ch.prefix].type === 'PERCENTAGE'
                ? 'Percentage off the transaction.'
                : moneyHint(form.ch[ch.prefix].value)"
            />

            <LiTextField
              v-model="form.ch[ch.prefix].cap"
              label="Max discount *"
              type="number"
              suffix="Rp"
              :disabled="form.ch[ch.prefix].unlimited"
              :helper-text="form.ch[ch.prefix].unlimited
                ? unlimitedHint
                : moneyHint(form.ch[ch.prefix].cap)"
            />
            <label class="ddpromoform__check">
              <input v-model="form.ch[ch.prefix].unlimited" type="checkbox" />
              Unlimited cap
            </label>
          </template>
          <p v-else class="ddpromoform__muted">Not eligible — this channel gets no discount.</p>
        </div>

        <!-- ── Limits ──────────────────────────────────────────────────── -->
        <p class="ddpromoform__section">Transaction limits</p>

        <div class="ddpromoform__field">
          <LiTextField
            v-model="form.min_txn_amount"
            label="Min transaction *"
            type="number"
            suffix="Rp"
            :disabled="form.no_minimum"
            :helper-text="form.no_minimum ? noMinimumHint : moneyHint(form.min_txn_amount)"
          />
          <label class="ddpromoform__check">
            <input v-model="form.no_minimum" type="checkbox" />
            No minimum
          </label>
        </div>

        <div class="ddpromoform__field">
          <!-- max_txn_amount and budget_amount are nullable downstream, so
               "unlimited" is a real NULL here. The discount caps above cannot
               do the same: their columns are NOT NULL, which is why they carry
               UNLIMITED_AMOUNT instead. Same word, two storage shapes. -->
          <LiTextField
            v-model="form.max_txn_amount"
            label="Max transaction"
            type="number"
            suffix="Rp"
            :disabled="form.max_unlimited"
            :helper-text="form.max_unlimited ? 'Stored as NULL — no ceiling' : moneyHint(form.max_txn_amount)"
          />
          <label class="ddpromoform__check">
            <input v-model="form.max_unlimited" type="checkbox" />
            Unlimited
          </label>
        </div>

        <div class="ddpromoform__field">
          <LiTextField
            v-model="form.budget_amount"
            label="Budget"
            type="number"
            suffix="Rp"
            :disabled="form.budget_unlimited"
            :helper-text="form.budget_unlimited ? 'Stored as NULL — no budget ceiling' : moneyHint(form.budget_amount)"
          />
          <label class="ddpromoform__check">
            <input v-model="form.budget_unlimited" type="checkbox" />
            Unlimited
          </label>
        </div>

        <!-- ── Placement ───────────────────────────────────────────────── -->
        <p class="ddpromoform__section">Placement</p>

        <LiTextField
          v-model="form.priority"
          label="Priority *"
          type="number"
          helper-text="Higher wins when several promos match the same transaction."
        />
        <LiSelect v-model="form.status" label="Status *" :options="statusOptions" />
      </div>
    </div>

    <template #footer>
      <LiButton variant="ghost" @click="close">Cancel</LiButton>
      <LiButton variant="primary" :loading="saving" @click="submit">
        {{ isEdit ? 'Save changes' : 'Create promo' }}
      </LiButton>
    </template>
  </LiModal>
</template>

<script setup>
import { ref, reactive, computed, watch } from 'vue'
import LiModal from '@lib/components/LiModal.vue'
import LiButton from '@lib/components/LiButton.vue'
import LiTextField from '@lib/components/LiTextField.vue'
import LiSelect from '@lib/components/LiSelect.vue'
import { supabase } from '@/lib/supabase.js'
import { DD_TABLES } from '../lib/schema.js'
import {
  UNLIMITED_AMOUNT, NO_MINIMUM, isUnlimited, DISCOUNT_TYPES, STATUS_VALUES,
} from '../lib/columns.js'
import { validateRow, generatePromoId, PROMO_ID_MAX } from '../lib/validate.js'
import { formatAmount, amountInputValue } from '../lib/format.js'
import { useDdTable } from '../composables/useDdTable.js'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  // The row being edited. Null on create.
  row: { type: Object, default: null },
  // A row to copy every field from *without* becoming an edit of it — the
  // Duplicate action. Ignored when `row` is set.
  duplicateOf: { type: Object, default: null },
})
const emit = defineEmits(['update:modelValue', 'saved'])

// Writes go through the shared composable so validation, the actor stamps and
// the Postgres-error translation stay in one place. pageSize 1 keeps the reload
// createRow/updateRow does on *this* instance down to a single row — the parent
// view reloads its own page off the `saved` event.
const { createRow, updateRow, saving } = useDdTable('promos', { pageSize: 1 })

const CHANNELS = [
  { prefix: 'prm', label: 'PRIME' },
  { prefix: 'pl', label: 'PAYLATER' },
]

// '' is "not eligible": the discount type column is nullable and coerce() turns
// a blank enum into SQL NULL, so no separate sentinel is needed.
const eligibilityOptions = [
  { label: 'Not eligible', value: '' },
  ...DISCOUNT_TYPES.map(v => ({ label: v === 'PERCENTAGE' ? 'Percentage discount' : 'Fixed amount', value: v })),
]
const statusOptions = STATUS_VALUES.map(v => ({ label: v, value: v }))

// The two channels are shaped identically, so they are nested rather than
// spelled out twice with prefixes — the template renders them from one v-for.
const blankChannel = () => ({ type: '', value: '', cap: '', unlimited: false })

const blank = () => ({
  promo_id: '', promo_name: '',
  bu_name: '', merchant_id: '',
  start_date: '', end_date: '',
  ch: { prm: blankChannel(), pl: blankChannel() },
  min_txn_amount: '', no_minimum: true,
  max_txn_amount: '', max_unlimited: true,
  budget_amount: '', budget_unlimited: true,
  priority: '0', status: 'ACTIVE',
})

const form = reactive(blank())
const problems = ref([])

const buOptions = ref([])
const merchantOptions = ref([{ label: 'All merchants', value: '' }])
// Existing promo ids, for the generator and for the "already taken" hint.
const takenIds = ref(new Set())

const isEdit = computed(() => !!props.row)
const isDuplicate = computed(() => !props.row && !!props.duplicateOf)

const dateError = computed(() => {
  if (!form.start_date || !form.end_date) return ''
  return form.start_date > form.end_date ? 'End date must be on or after the start date' : ''
})

const idError = computed(() => {
  const v = form.promo_id.trim()
  if (!v) return ''
  if (v.length > PROMO_ID_MAX) return `Too long (${v.length}/${PROMO_ID_MAX})`
  // On edit the id is the row's own and is never rewritten, so it cannot clash.
  if (isEdit.value) return ''
  return takenIds.value.has(v) ? 'That promo ID is already taken' : ''
})

const moneyHint = (v) => {
  const s = String(v ?? '').trim()
  if (s === '' || Number.isNaN(Number(s))) return ''
  return formatAmount(s)
}

// Static helper strings, kept out of the template so no attribute has to carry
// a template literal.
const idHint = `Max ${PROMO_ID_MAX} characters, unique across every promo.`
const unlimitedHint = `Stored as ${UNLIMITED_AMOUNT} — the column is NOT NULL downstream, so an unlimited cap needs a sentinel rather than a blank.`
const noMinimumHint = `Stored as ${NO_MINIMUM} — same reason: the column cannot hold NULL.`

// Clearing the box when a cap flips to unlimited: leaving a stale number behind
// a disabled input is how someone later "fixes" a value that is not being used.
CHANNELS.forEach(({ prefix }) => {
  watch(() => form.ch[prefix].unlimited, (on) => {
    if (on) form.ch[prefix].cap = ''
  })
})
watch(() => form.no_minimum, (on) => { if (on) form.min_txn_amount = '' })
watch(() => form.max_unlimited, (on) => { if (on) form.max_txn_amount = '' })
watch(() => form.budget_unlimited, (on) => { if (on) form.budget_amount = '' })

/** Copies a stored row into the form's string-and-checkbox shape. */
function fill(src) {
  form.promo_id = String(src.promo_id ?? '')
  form.promo_name = String(src.promo_name ?? '')
  form.bu_name = String(src.bu_name ?? '')
  form.merchant_id = src.merchant_id == null ? '' : String(src.merchant_id)
  form.start_date = String(src.start_date ?? '').slice(0, 10)
  form.end_date = String(src.end_date ?? '').slice(0, 10)

  CHANNELS.forEach(({ prefix }) => {
    const c = form.ch[prefix]
    const type = src[`${prefix}_discount_type`] || ''
    c.type = type
    c.value = type ? String(src[`${prefix}_discount_value`] ?? '') : ''
    // amountInputValue hides the sentinel: the box shows blank, the checkbox
    // carries the fact.
    c.unlimited = type ? isUnlimited(src[`${prefix}_max_discount`]) : false
    c.cap = type ? String(amountInputValue(src[`${prefix}_max_discount`])) : ''
  })

  const min = Number(src.min_txn_amount)
  form.no_minimum = !Number.isNaN(min) && min <= NO_MINIMUM
  form.min_txn_amount = form.no_minimum ? '' : String(src.min_txn_amount ?? '')

  form.max_unlimited = src.max_txn_amount == null
  form.max_txn_amount = form.max_unlimited ? '' : String(src.max_txn_amount)

  form.budget_unlimited = src.budget_amount == null
  form.budget_amount = form.budget_unlimited ? '' : String(src.budget_amount)

  form.priority = String(src.priority ?? '0')
  form.status = src.status || 'ACTIVE'
}

async function loadReferenceData() {
  const [bu, merch] = await Promise.all([
    supabase.from(DD_TABLES.bu_accounts.local).select('name').order('name'),
    supabase.from(DD_TABLES.merchants.local).select('merchant_id, merchant_name').order('merchant_name'),
  ])
  // A BU appears once per source-of-fund row, so the list has to be deduped
  // before it becomes a dropdown.
  buOptions.value = [...new Set((bu.data || []).map(r => r.name))]
    .map(name => ({ label: name, value: name }))
  merchantOptions.value = [
    { label: 'All merchants', value: '' },
    ...(merch.data || []).map(r => ({
      label: `${r.merchant_id} — ${r.merchant_name}`, value: r.merchant_id,
    })),
  ]
}

/** One read of every id in use — the generator needs the whole set to pick a
 *  free sequence number, and the uniqueness hint needs it to say anything. */
async function loadTakenIds() {
  const { data } = await supabase.from(DD_TABLES.promos.local).select('promo_id')
  takenIds.value = new Set((data || []).map(r => String(r.promo_id)))
}

function generate() {
  form.promo_id = generatePromoId(form.promo_name, takenIds.value)
}

watch(() => props.modelValue, async (open) => {
  if (!open) return
  Object.assign(form, blank())
  problems.value = []

  loadReferenceData()

  if (props.row) {
    fill(props.row)
  } else if (props.duplicateOf) {
    fill(props.duplicateOf)
    // The copy must not carry the original's key, and cannot be saved without
    // one, so it is regenerated the moment the dialog opens.
    await loadTakenIds()
    form.promo_id = generatePromoId(form.promo_name, takenIds.value)
  } else {
    await loadTakenIds()
  }
})

function close() {
  emit('update:modelValue', false)
}

/** The form's controls mapped back onto the columns. Blanks are left as '' —
 *  the composable runs them through coerce(), which knows which columns take a
 *  SQL NULL and which take an empty string. */
function values() {
  const out = {
    promo_id: form.promo_id.trim(),
    promo_name: form.promo_name.trim(),
    bu_name: form.bu_name,
    merchant_id: form.merchant_id,
    start_date: form.start_date,
    end_date: form.end_date,
    min_txn_amount: form.no_minimum ? NO_MINIMUM : form.min_txn_amount,
    max_txn_amount: form.max_unlimited ? '' : form.max_txn_amount,
    budget_amount: form.budget_unlimited ? '' : form.budget_amount,
    priority: form.priority,
    status: form.status,
  }

  CHANNELS.forEach(({ prefix }) => {
    const c = form.ch[prefix]
    out[`${prefix}_discount_type`] = c.type
    out[`${prefix}_discount_value`] = c.type ? c.value : ''
    out[`${prefix}_max_discount`] = !c.type ? '' : (c.unlimited ? UNLIMITED_AMOUNT : c.cap)
  })

  return out
}

async function submit() {
  const v = values()
  // validateRow is the shared gate — the bulk upload and the raw insert form
  // run the same one. Uniqueness is the one thing it cannot judge: it sees a
  // single row and has no view of the ids already in the table.
  const found = validateRow('promos', v)
  if (idError.value) found.unshift(`promo_id: ${idError.value}`)
  problems.value = found
  if (found.length) return

  const res = props.row
    ? await updateRow(props.row.promo_id, v)
    : await createRow(v)

  if (!res?.ok) {
    problems.value = res?.problems ?? []
    return
  }
  emit('saved')
  close()
}
</script>

<style scoped>
.ddpromoform { display: flex; flex-direction: column; gap: var(--space-sm, 12px); }

.ddpromoform__problems {
  margin: 0; padding: 10px 14px 10px 30px;
  list-style: disc;
  font-size: 13px; color: var(--color-red-400, #C83E3B);
  background: rgba(200, 62, 59, 0.08);
  border-radius: var(--radius-sm, 12px);
}
.ddpromoform__problems li + li { margin-top: 3px; }

.ddpromoform__note {
  margin: 0; font-size: 12.5px; color: var(--color-gray-600, #808080);
}
.ddpromoform__note code {
  font-family: var(--font-mono, ui-monospace, monospace); font-size: 12px;
  background: rgba(0, 0, 0, 0.04); border-radius: 5px; padding: 1px 6px;
}

.ddpromoform__grid {
  display: grid; grid-template-columns: 1fr 1fr;
  gap: var(--space-sm, 12px) var(--space-md, 16px);
  align-items: start;
}

.ddpromoform__section {
  grid-column: 1 / -1;
  margin: var(--space-sm, 12px) 0 0;
  padding-bottom: 5px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
  font-size: 11px; font-weight: 700;
  letter-spacing: 0.08em; text-transform: uppercase;
  color: var(--color-gray-400, #B3B3B3);
}

/* An input plus the checkbox or button that modifies it, kept on one line so
   the pairing reads as one control rather than two unrelated ones. */
.ddpromoform__field { display: flex; align-items: flex-end; gap: 10px; }
.ddpromoform__field > .li-textfield-wrapper { flex: 1; }

.ddpromoform__check {
  display: flex; align-items: center; gap: 6px;
  flex: 0 0 auto; padding-bottom: 22px;
  font-size: 12px; color: var(--color-gray-600, #808080);
  white-space: nowrap; cursor: pointer;
}

.ddpromoform__generate {
  display: inline-flex; align-items: center; gap: 5px;
  flex: 0 0 auto; margin-bottom: 22px;
  padding: 10px 14px; border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: var(--radius-pill, 999px); background: transparent;
  font-family: var(--font-body, 'Inter', sans-serif);
  font-size: 12px; font-weight: 600; color: var(--color-gray-700, #666);
  cursor: pointer; transition: all 200ms; white-space: nowrap;
}
.ddpromoform__generate:hover:not(:disabled) { background: rgba(0, 0, 0, 0.04); }
.ddpromoform__generate:disabled { opacity: 0.45; cursor: not-allowed; }
.ddpromoform__generate .li-icon { font-size: 16px; }

.ddpromoform__channel {
  display: flex; flex-direction: column; gap: var(--space-sm, 12px);
  padding: 12px; border: 1px solid rgba(0, 0, 0, 0.06);
  border-radius: var(--radius-sm, 12px); background: rgba(0, 0, 0, 0.02);
}
.ddpromoform__channel-name {
  font-size: 12px; font-weight: 700;
  letter-spacing: 0.05em; text-transform: uppercase;
  color: var(--color-gray-600, #808080);
}
.ddpromoform__channel .ddpromoform__check { padding-bottom: 0; }
.ddpromoform__muted { margin: 0; font-size: 12px; color: var(--color-gray-400, #B3B3B3); }

@media (max-width: 640px) {
  .ddpromoform__grid { grid-template-columns: 1fr; }
  .ddpromoform__field { flex-direction: column; align-items: stretch; gap: 6px; }
  .ddpromoform__check, .ddpromoform__generate { padding-bottom: 0; margin-bottom: 0; }
}
</style>
