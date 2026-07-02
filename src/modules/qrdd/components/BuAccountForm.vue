<template>
  <LiModal :modelValue="true" :title="editing ? 'Edit BU Account' : 'Add BU Account'" size="md" @update:modelValue="$emit('close')">
    <div class="form">
      <LiTextField v-model="form.name" label="Name" placeholder="e.g. Antavaya" />
      <LiSelect v-model="form.sof" label="SOF" :options="sofOptions" placeholder="Select SOF..." />

      <div class="form__section"><span class="form__section-label">Allo Expense</span></div>
      <LiTextField v-model="form.account1" label="Account Number" placeholder="e.g. 101001360540601269000005" />
      <LiTextField v-model="form.acctname1" label="Account Name" placeholder="e.g. CTBU Prime Discount Expense - Antavaya" />
      <LiTextField v-model.number="form.percentage1" label="Percentage (%)" type="number" placeholder="50" />

      <div class="form__section"><span class="form__section-label">Receivable</span></div>
      <LiTextField v-model="form.account2" label="Account Number" placeholder="e.g. 101001360540601279000006" />
      <LiTextField v-model="form.acctname2" label="Account Name" placeholder="e.g. CTBU Prime Discount Receivable - Antavaya" />
      <LiTextField v-model.number="form.percentage2" label="Percentage (%)" type="number" placeholder="50" />

      <p v-if="pctError" class="form__error">{{ pctError }}</p>
    </div>
    <template #footer>
      <button class="form__btn form__btn--cancel" @click="$emit('close')">Cancel</button>
      <button class="form__btn form__btn--save" :disabled="!valid" @click="onSave">
        {{ editing ? 'Save Changes' : 'Create' }}
      </button>
    </template>
  </LiModal>
</template>

<script setup>
import { reactive, computed, onMounted } from 'vue'
import LiModal from '@lib/components/LiModal.vue'
import LiTextField from '@lib/components/LiTextField.vue'
import LiSelect from '@lib/components/LiSelect.vue'

const props = defineProps({ editing: Object })
const emit = defineEmits(['save', 'close'])

const sofOptions = [
  { label: 'PRIME', value: 'PRIME' },
  { label: 'PAYLATER', value: 'PAYLATER' },
]

const form = reactive({
  name: '', sof: 'PRIME',
  account1: '', acctname1: '', percentage1: 50,
  account2: '', acctname2: '', percentage2: 50,
})

const valid = computed(() => {
  return form.name.trim() && form.sof &&
    form.account1.trim() && form.acctname1.trim() &&
    form.account2.trim() && form.acctname2.trim() &&
    Number(form.percentage1) > 0 && Number(form.percentage2) > 0 &&
    Math.abs(Number(form.percentage1) + Number(form.percentage2) - 100) < 0.01
})

const pctError = computed(() => {
  const p1 = Number(form.percentage1) || 0
  const p2 = Number(form.percentage2) || 0
  const sum = p1 + p2
  if (p1 > 0 && p2 > 0 && Math.abs(sum - 100) >= 0.01) {
    return `Percentages must sum to 100% (currently ${sum}%)`
  }
  return null
})

onMounted(() => {
  if (props.editing) {
    form.name = props.editing.name
    form.sof = props.editing.sof
    form.account1 = props.editing.account1
    form.acctname1 = props.editing.acctname1
    form.percentage1 = Math.round(Number(props.editing.percentage1) * 100)
    form.account2 = props.editing.account2
    form.acctname2 = props.editing.acctname2
    form.percentage2 = Math.round(Number(props.editing.percentage2) * 100)
  }
})

function onSave() {
  if (!valid.value) return
  emit('save', { ...form })
}
</script>

<style scoped>
.form { display: flex; flex-direction: column; gap: 12px; }
.form__section { border-top: 1px solid rgba(0,0,0,0.06); padding-top: 8px; margin-top: 4px; }
.form__section-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: var(--color-gray-400, #B3B3B3); }
.form__error { color: var(--color-red-400, #C83E3B); font-size: 12px; font-weight: 500; margin: 0; }
.form__btn { display: inline-flex; align-items: center; gap: 6px; padding: 8px 18px; border: 1px solid transparent; border-radius: var(--radius-pill, 999px); font-family: var(--font-body, 'Inter', sans-serif); font-size: 13px; font-weight: 600; cursor: pointer; transition: all 200ms; }
.form__btn--cancel { color: var(--color-gray-700, #666); border-color: rgba(0,0,0,0.1); background: transparent; }
.form__btn--cancel:hover { background: rgba(0,0,0,0.04); }
.form__btn--save { color: var(--cta-primary-text, #1E1E1E); background: var(--cta-primary-bg, #FFBC25); border-color: var(--cta-primary-bg, #FFBC25); }
.form__btn--save:hover { transform: translateY(-1px); }
.form__btn--save:disabled { opacity: 0.4; cursor: not-allowed; }
</style>
