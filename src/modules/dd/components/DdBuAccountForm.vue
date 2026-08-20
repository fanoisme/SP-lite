<template>
  <LiModal
    :model-value="modelValue"
    :title="isEdit ? 'Edit business unit' : 'New business unit'"
    size="lg"
    @update:model-value="close"
  >
    <p class="ddbuf__note">Every field is required.</p>

    <div class="ddbuf__grid">
      <div class="ddbuf__full">
        <LiTextField
          v-model="form.name"
          label="Business unit name"
          placeholder="e.g. Antavaya"
          :helper-text="isEdit
            ? 'Renaming re-keys this record downstream — the export matches on name AND sof.'
            : 'Merchants and promos will reference this exact name.'"
        />
      </div>
      <div class="ddbuf__full">
        <LiSelect
          v-model="form.sof"
          label="Source of fund"
          :options="sofOptions"
          :helper-text="isEdit
            ? 'Changing this re-keys the record downstream, same as the name.'
            : ''"
        />
      </div>

      <!-- The downstream UPDATE/DELETE match on name AND sof, so an edit to
           either does not amend a row down there — it addresses a different one
           and leaves the original behind. -->
      <p v-if="rekeyed" class="ddbuf__warn ddbuf__full">
        <span class="material-symbols-outlined">warning</span>
        You changed {{ rekeyed }}. Downstream this becomes a different record — the
        row under the old key will still be there until someone removes it.
      </p>

      <p class="ddbuf__section ddbuf__full">Expense account</p>
      <LiTextField v-model="form.account1" label="Account number" placeholder="e.g. 101001360540601269000005" />
      <LiTextField v-model="form.acctname1" label="Account name" placeholder="e.g. CTBU Prime Discount Expense - Antavaya" />

      <p class="ddbuf__section ddbuf__full">Receivable account</p>
      <LiTextField v-model="form.account2" label="Account number" placeholder="e.g. 101001360540601279000006" />
      <LiTextField v-model="form.acctname2" label="Account name" placeholder="e.g. CTBU Prime Discount Receivable - Antavaya" />

      <p class="ddbuf__section ddbuf__full">Split</p>
      <LiTextField
        v-model="form.percentage1"
        label="Expense share"
        placeholder="0.7500"
        :suffix="shareSuffix(share1)"
        helper-text="Type 0.75 or 75% — both are stored as 0.7500."
        @blur="onShareBlur('percentage1')"
      />
      <LiTextField
        v-model="form.percentage2"
        label="Receivable share"
        placeholder="0.2500"
        :suffix="shareSuffix(share2)"
        helper-text="Type 0.25 or 25% — both are stored as 0.2500."
        @blur="onShareBlur('percentage2')"
      />

      <!-- The one BU rule no database constraint enforces, so it is enforced
           here in the only way that works: visibly, while they type. -->
      <div class="ddbuf__total ddbuf__full" :class="{ 'ddbuf__total--ok': splitOk }">
        <span class="material-symbols-outlined">{{ splitOk ? 'check_circle' : 'error' }}</span>
        <span class="ddbuf__total-text">
          Split total <strong>{{ totalText }}</strong>
          <template v-if="!splitOk"> — must be exactly 1.0000</template>
        </span>
        <button v-if="!splitOk && canBalance" class="ddbuf__balance" type="button" @click="balance">
          Balance to 1.0000
        </button>
      </div>

      <ul v-if="problems.length" class="ddbuf__problems ddbuf__full">
        <li v-for="p in problems" :key="p">{{ p }}</li>
      </ul>
    </div>

    <template #footer>
      <LiButton variant="ghost" @click="close">Cancel</LiButton>
      <LiButton :disabled="!canSubmit" :loading="saving" @click="submit">
        {{ isEdit ? 'Save changes' : 'Create business unit' }}
      </LiButton>
    </template>
  </LiModal>
</template>

<script setup>
import { ref, reactive, computed, watch } from 'vue'
import LiModal from '@lib/components/LiModal.vue'
import LiTextField from '@lib/components/LiTextField.vue'
import LiSelect from '@lib/components/LiSelect.vue'
import LiButton from '@lib/components/LiButton.vue'
import { useDdTable } from '../composables/useDdTable.js'
import { SOF_VALUES } from '../lib/columns.js'
import { validateRow, BU_REQUIRED } from '../lib/validate.js'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  row: { type: Object, default: null },
})
const emit = defineEmits(['update:modelValue', 'saved'])

// The view owns the list; this instance exists only for its writes, so its own
// page is kept to one row — createRow/updateRow reload before returning and
// there is no point paying for 25 rows nobody will render.
const { saving, createRow, updateRow } = useDdTable('bu_accounts', { pageSize: 1 })

const sofOptions = SOF_VALUES.map(v => ({ label: v, value: v }))

const blank = () => ({
  name: '', sof: 'PRIME',
  account1: '', acctname1: '', percentage1: '',
  account2: '', acctname2: '', percentage2: '',
})
const form = reactive(blank())
const problems = ref([])

// Which share was typed into last. When the two roundings cannot both land on
// 1.0000 the *other* one absorbs the difference, so what the person just typed
// survives verbatim.
const lastShare = ref('percentage1')

const isEdit = computed(() => !!props.row)

/** "0.75", "75", "75%" and "0,75" all mean the same share. Stored as 0–1. */
function parseShare(raw) {
  const s = String(raw ?? '').trim().replace(/\s+/g, '')
  if (!s) return NaN
  const isPct = s.endsWith('%')
  const n = Number(s.replace(/%$/, '').replace(/,/g, '.'))
  if (Number.isNaN(n)) return NaN
  // Above 1 it can only have been meant as a percentage — 1 itself is 100%.
  return isPct || n > 1 ? n / 100 : n
}

const round4 = (n) => Number(n.toFixed(4))

const share1 = computed(() => parseShare(form.percentage1))
const share2 = computed(() => parseShare(form.percentage2))

const total = computed(() =>
  (Number.isNaN(share1.value) ? 0 : share1.value) + (Number.isNaN(share2.value) ? 0 : share2.value),
)
const totalText = computed(() => total.value.toFixed(4))
const splitOk = computed(() =>
  !Number.isNaN(share1.value) && !Number.isNaN(share2.value)
  && Math.abs(total.value - 1) <= 0.00005,
)

// Balancing needs one readable share to derive the other from.
const canBalance = computed(() => !Number.isNaN(share1.value) || !Number.isNaN(share2.value))

const allFilled = computed(() => BU_REQUIRED.every(c => String(form[c] ?? '').trim() !== ''))
const canSubmit = computed(() => allFilled.value && splitOk.value && !saving.value)

const rekeyed = computed(() => {
  if (!props.row) return ''
  const changed = []
  if (String(form.name).trim() !== String(props.row.name ?? '')) changed.push('the name')
  if (form.sof !== props.row.sof) changed.push('the source of fund')
  return changed.join(' and ')
})

function shareSuffix(share) {
  return Number.isNaN(share) ? '' : `${(share * 100).toFixed(2)}%`
}

// Only on blur: rewriting the field on every keystroke would fight the typist
// mid-number ("7" on its way to "75%" would jump to 0.0700).
function onShareBlur(field) {
  lastShare.value = field
  const parsed = parseShare(form[field])
  if (Number.isNaN(parsed)) return
  form[field] = parsed.toFixed(4)

  // Filling the first share on a new record implies the second. An existing
  // value is never overwritten behind the person's back.
  const other = field === 'percentage1' ? 'percentage2' : 'percentage1'
  if (String(form[other]).trim() === '') form[other] = round4(1 - parsed).toFixed(4)
}

function balance() {
  const from = Number.isNaN(share1.value) ? 'percentage2' : lastShare.value
  const known = from === 'percentage1' ? share1.value : share2.value
  if (Number.isNaN(known)) return
  const other = from === 'percentage1' ? 'percentage2' : 'percentage1'
  form[from] = round4(known).toFixed(4)
  form[other] = round4(1 - known).toFixed(4)
}

watch(() => props.modelValue, (open) => {
  if (!open) return
  Object.assign(form, blank())
  problems.value = []
  lastShare.value = 'percentage1'
  if (props.row) {
    Object.keys(blank()).forEach((f) => { form[f] = props.row[f] ?? '' })
    form.percentage1 = Number(props.row.percentage1 ?? 0).toFixed(4)
    form.percentage2 = Number(props.row.percentage2 ?? 0).toFixed(4)
  }
})

function close() {
  emit('update:modelValue', false)
}

function values() {
  let p1 = round4(share1.value)
  let p2 = round4(share2.value)
  // Four stored decimals cannot always hold both roundings and still total 1;
  // the share not being typed gives way.
  if (Math.abs(p1 + p2 - 1) > 1e-9) {
    if (lastShare.value === 'percentage1') p2 = round4(1 - p1)
    else p1 = round4(1 - p2)
  }
  return {
    name: String(form.name).trim(),
    sof: form.sof,
    account1: String(form.account1).trim(),
    acctname1: String(form.acctname1).trim(),
    percentage1: p1,
    account2: String(form.account2).trim(),
    acctname2: String(form.acctname2).trim(),
    percentage2: p2,
  }
}

async function submit() {
  if (!canSubmit.value) return
  const payload = values()

  // Every problem at once. createRow/updateRow validate again and toast only
  // the first, which is fine as a backstop but useless as a to-do list.
  problems.value = validateRow('bu_accounts', payload)
  if (problems.value.length) return

  const res = props.row
    ? await updateRow(props.row.id, payload)
    : await createRow(payload)
  if (!res?.ok) {
    problems.value = res?.problems ?? []
    return
  }
  close()
  emit('saved')
}
</script>

<style scoped>
.ddbuf__note {
  margin: 0 0 var(--space-sm, 12px);
  font-size: 12.5px; color: var(--color-gray-500, #8e8ea0);
}

.ddbuf__grid {
  display: grid; grid-template-columns: 1fr 1fr;
  gap: var(--space-sm, 12px) var(--space-md, 16px);
}
.ddbuf__full { grid-column: 1 / -1; }

.ddbuf__section {
  margin: var(--space-sm, 8px) 0 0; padding-bottom: 5px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
  font-size: 11px; font-weight: 700; letter-spacing: 0.08em;
  text-transform: uppercase; color: var(--color-gray-400, #B3B3B3);
}

.ddbuf__warn {
  display: flex; align-items: flex-start; gap: 8px; margin: 0;
  padding: 10px 14px; border-radius: var(--radius-sm, 12px);
  background: rgba(255, 188, 37, 0.12);
  border: 1px solid rgba(255, 188, 37, 0.35);
  font-size: 12.5px; color: var(--color-gray-800, #4D4D4D);
}
.ddbuf__warn .material-symbols-outlined { font-size: 18px; color: var(--color-yellow-500, #F4A600); }

.ddbuf__total {
  display: flex; align-items: center; gap: 8px;
  padding: 10px 14px; border-radius: var(--radius-sm, 12px);
  background: rgba(200, 62, 59, 0.08);
  border: 1px solid rgba(200, 62, 59, 0.25);
  color: var(--color-red-400, #C83E3B);
  font-size: 13px;
}
.ddbuf__total--ok {
  background: rgba(16, 185, 129, 0.1);
  border-color: rgba(16, 185, 129, 0.3);
  color: var(--color-green-400, #10B981);
}
.ddbuf__total .material-symbols-outlined { font-size: 18px; }
.ddbuf__total-text { flex: 1; font-variant-numeric: tabular-nums; }
.ddbuf__balance {
  padding: 5px 12px; border: 1px solid currentColor;
  border-radius: var(--radius-pill, 999px); background: transparent;
  font-family: var(--font-body, 'Inter', sans-serif);
  font-size: 12px; font-weight: 600; color: inherit;
  cursor: pointer; transition: all 200ms; white-space: nowrap;
}
.ddbuf__balance:hover { background: rgba(200, 62, 59, 0.08); }

.ddbuf__problems {
  margin: 0; padding: 10px 14px 10px 30px;
  border-radius: var(--radius-sm, 12px);
  background: rgba(200, 62, 59, 0.08);
  color: var(--color-red-400, #C83E3B); font-size: 12.5px;
}
.ddbuf__problems li + li { margin-top: 4px; }

@media (max-width: 640px) {
  .ddbuf__grid { grid-template-columns: 1fr; }
}
</style>
