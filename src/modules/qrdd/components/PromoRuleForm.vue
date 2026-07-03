<template>
  <LiModal :modelValue="true" :title="editing ? 'Edit Promo Rule' : 'Add Promo Rule'" size="lg" @update:modelValue="$emit('close')">
    <div class="form">
      <!-- Section: Basic -->
      <div class="form__section"><span class="form__section-label">Basic Info</span></div>
      <div class="form__row">
        <LiTextField v-model="form.promo_id" label="Promo ID" placeholder="e.g. antavaya_promo_2026_01" :disabled="!!editing" />
        <LiTextField v-model="form.promo_name" label="Promo Name" placeholder="e.g. Antavaya Promo 2026" />
      </div>
      <div class="form__row">
        <LiSelect v-model="form.merchant_id" label="Merchant" :options="merchantIdOptions" placeholder="All Merchants" />
        <LiSelect v-model="form.bu_name" label="BU Name" :options="buNameOptions" placeholder="Select BU..." />
      </div>
      <div class="form__row">
        <LiTextField v-model="form.start_date" label="Start Date" type="date" />
        <LiTextField v-model="form.end_date" label="End Date" type="date" />
      </div>

      <!-- Section: PRIME & PAYLATER Discount (side by side) -->
      <div class="form__section"><span class="form__section-label">PRIME &amp; PAYLATER Discount</span></div>
      <div class="form__side-by-side">
        <!-- PRIME -->
        <div class="form__discount-panel">
          <span class="form__discount-panel-label">PRIME</span>
          <div class="form__row">
            <LiSelect v-model="form.prm_discount_type" label="Type" :options="discountTypeOptions" />
          </div>
          <div class="form__row" v-if="form.prm_discount_type !== NULL_SENTINEL">
            <LiTextField v-model.number="form.prm_discount_value" label="Value" type="number" :suffix="form.prm_discount_type === 'PERCENTAGE' ? '%' : ''" />
          </div>
          <div class="form__row" v-if="form.prm_discount_type !== NULL_SENTINEL">
            <LiTextField v-model.number="form.prm_max_discount" label="Max Discount" type="number" :disabled="form.prm_unlimited" />
            <label class="form__toggle-label">
              <input type="checkbox" v-model="form.prm_unlimited" />
              Unlimited
            </label>
          </div>
        </div>

        <!-- PAYLATER -->
        <div class="form__discount-panel">
          <span class="form__discount-panel-label">PAYLATER</span>
          <div class="form__row">
            <LiSelect v-model="form.pl_discount_type" label="Type" :options="discountTypeOptions" />
          </div>
          <div class="form__row" v-if="form.pl_discount_type !== NULL_SENTINEL">
            <LiTextField v-model.number="form.pl_discount_value" label="Value" type="number" :suffix="form.pl_discount_type === 'PERCENTAGE' ? '%' : ''" />
          </div>
          <div class="form__row" v-if="form.pl_discount_type !== NULL_SENTINEL">
            <LiTextField v-model.number="form.pl_max_discount" label="Max Discount" type="number" :disabled="form.pl_unlimited" />
            <label class="form__toggle-label"><input type="checkbox" v-model="form.pl_unlimited" /> Unlimited</label>
          </div>
        </div>
      </div>

      <!-- Section: Limits -->
      <div class="form__section"><span class="form__section-label">Limits</span></div>
      <div class="form__row">
        <LiTextField v-model.number="form.min_txn_amount" label="Min Transaction" type="number" :disabled="form.min_no_minimum" />
        <label class="form__toggle-label"><input type="checkbox" v-model="form.min_no_minimum" /> No minimum</label>
      </div>
      <div class="form__row">
        <LiTextField v-model.number="form.max_txn_amount" label="Max Transaction" type="number" :disabled="form.max_unlimited" />
        <label class="form__toggle-label"><input type="checkbox" v-model="form.max_unlimited" /> Unlimited</label>
      </div>
      <div class="form__row">
        <LiTextField v-model.number="form.budget_amount" label="Budget" type="number" :disabled="form.budget_unlimited" />
        <label class="form__toggle-label"><input type="checkbox" v-model="form.budget_unlimited" /> Unlimited</label>
      </div>

      <!-- Section: Meta -->
      <div class="form__section"><span class="form__section-label">Meta</span></div>
      <div class="form__row">
        <LiTextField v-model.number="form.priority" label="Priority" type="number" />
        <LiSelect v-model="form.status" label="Status" :options="statusOptions" />
      </div>
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

const props = defineProps({
  editing: Object,
  merchantOptions: { type: Array, default: () => [] },
  buNameOptions: { type: Array, default: () => [] },
})
const emit = defineEmits(['save', 'close'])

const NULL_SENTINEL = '__NULL__'

const discountTypeOptions = [
  { label: 'Not Eligible', value: NULL_SENTINEL },
  { label: 'PERCENTAGE', value: 'PERCENTAGE' },
  { label: 'FIXED', value: 'FIXED' },
]
const statusOptions = [
  { label: 'ACTIVE', value: 'ACTIVE' },
  { label: 'INACTIVE', value: 'INACTIVE' },
]

const merchantIdOptions = computed(() => [
  { label: 'All Merchants', value: '' },
  ...props.merchantOptions,
])

const form = reactive({
  promo_id: '', promo_name: '',
  merchant_id: '', bu_name: '',
  start_date: '', end_date: '',
  prm_discount_type: 'PERCENTAGE', prm_discount_value: 0, prm_max_discount: 0, prm_unlimited: false,
  pl_discount_type: 'PERCENTAGE', pl_discount_value: 0, pl_max_discount: 0, pl_unlimited: false,
  min_txn_amount: 1, min_no_minimum: true,
  max_txn_amount: null, max_unlimited: true,
  budget_amount: null, budget_unlimited: true,
  priority: 0, status: 'ACTIVE',
})

const valid = computed(() => {
  if (!form.promo_id.trim() || !form.promo_name.trim() || !form.bu_name || !form.start_date || !form.end_date) return false
  // PRIME: skip value/max validation if Not Eligible
  if (form.prm_discount_type !== NULL_SENTINEL && Number(form.prm_discount_value) < 0) return false
  // PAYLATER: at least one side must be eligible
  if (form.prm_discount_type === NULL_SENTINEL && form.pl_discount_type === NULL_SENTINEL) return false
  if (form.pl_discount_type !== NULL_SENTINEL && Number(form.pl_discount_value) < 0) return false
  return true
})

onMounted(() => {
  if (props.editing) {
    const e = props.editing
    form.promo_id = e.promo_id
    form.promo_name = e.promo_name
    form.merchant_id = e.merchant_id || ''
    form.bu_name = e.bu_name
    form.start_date = e.start_date
    form.end_date = e.end_date
    form.prm_discount_type = e.prm_discount_type || NULL_SENTINEL
    form.prm_discount_value = Number(e.prm_discount_value) || 0
    form.prm_max_discount = Number(e.prm_max_discount) || 0
    form.prm_unlimited = Number(e.prm_max_discount) >= 49999999999
    form.pl_discount_type = e.pl_discount_type || NULL_SENTINEL
    form.pl_discount_value = Number(e.pl_discount_value) || 0
    form.pl_max_discount = Number(e.pl_max_discount) || 0
    form.pl_unlimited = Number(e.pl_max_discount) >= 49999999999
    form.min_txn_amount = Number(e.min_txn_amount)
    form.min_no_minimum = Number(e.min_txn_amount) <= 1
    form.max_txn_amount = e.max_txn_amount ? Number(e.max_txn_amount) : null
    form.max_unlimited = e.max_txn_amount == null
    form.budget_amount = e.budget_amount ? Number(e.budget_amount) : null
    form.budget_unlimited = e.budget_amount == null
    form.priority = e.priority
    form.status = e.status
  }
})

function onSave() {
  if (!valid.value) return
  const payload = { ...form }
  // NULL_SENTINEL → actual null for DB
  if (payload.prm_discount_type === NULL_SENTINEL) {
    payload.prm_discount_type = null
    payload.prm_discount_value = null
    payload.prm_max_discount = null
    payload.prm_unlimited = false
  }
  if (payload.pl_discount_type === NULL_SENTINEL) {
    payload.pl_discount_type = null
    payload.pl_discount_value = null
    payload.pl_max_discount = null
    payload.pl_unlimited = false
  }
  emit('save', payload)
}
</script>

<style scoped>
.form { display: flex; flex-direction: column; gap: 12px; max-height: 60vh; overflow-y: auto; }
.form__section { border-top: 1px solid rgba(0,0,0,0.06); padding-top: 8px; margin-top: 4px; }
.form__section-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: var(--color-gray-400, #B3B3B3); }
.form__row { display: flex; gap: 12px; align-items: flex-end; }
.form__row > * { flex: 1; }
.form__toggle-label { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--color-gray-600, #888); white-space: nowrap; flex: 0 0 auto; cursor: pointer; }
.form__side-by-side { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.form__discount-panel { display: flex; flex-direction: column; gap: 12px; padding: 12px; background: rgba(0,0,0,0.02); border-radius: var(--radius-sm, 12px); border: 1px solid rgba(0,0,0,0.06); }
.form__discount-panel-label { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: var(--color-gray-600, #888); }
.form__btn { display: inline-flex; align-items: center; gap: 6px; padding: 8px 18px; border: 1px solid transparent; border-radius: var(--radius-pill, 999px); font-family: var(--font-body, 'Inter', sans-serif); font-size: 13px; font-weight: 600; cursor: pointer; transition: all 200ms; }
.form__btn--cancel { color: var(--color-gray-700, #666); border-color: rgba(0,0,0,0.1); background: transparent; }
.form__btn--cancel:hover { background: rgba(0,0,0,0.04); }
.form__btn--save { color: var(--cta-primary-text, #1E1E1E); background: var(--cta-primary-bg, #FFBC25); border-color: var(--cta-primary-bg, #FFBC25); }
.form__btn--save:hover { transform: translateY(-1px); }
.form__btn--save:disabled { opacity: 0.4; cursor: not-allowed; }

/* ── Responsive ── */
@media (max-width: 768px) {
  .form__side-by-side { grid-template-columns: 1fr; }
}
@media (max-width: 480px) {
  .form__row { flex-direction: column; gap: 8px; }
}
</style>
