<template>
  <LiModal :modelValue="true" :title="editing ? 'Edit Merchant' : 'Add Merchant'" size="md" @update:modelValue="$emit('close')">
    <div class="form">
      <LiTextField v-model="form.merchant_id" label="Merchant ID" placeholder="e.g. 000885002405722" />
      <LiTextField v-model="form.merchant_name" label="Merchant Name" placeholder="e.g. C&F TSM Cibubur" />
      <LiSelect v-model="form.bu_name" label="BU Name" :options="buNameOptions" placeholder="Select BU..." />
      <LiSelect v-model="form.status" label="Status" :options="statusOptions" />
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

const props = defineProps({ editing: Object, buNameOptions: { type: Array, default: () => [] } })
const emit = defineEmits(['save', 'close'])

const statusOptions = [
  { label: 'ACTIVE', value: 'ACTIVE' },
  { label: 'INACTIVE', value: 'INACTIVE' },
]

const form = reactive({ merchant_id: '', merchant_name: '', bu_name: '', status: 'ACTIVE' })

const valid = computed(() => form.merchant_id.trim() && form.merchant_name.trim() && form.bu_name)

onMounted(() => {
  if (props.editing) {
    form.merchant_id = props.editing.merchant_id
    form.merchant_name = props.editing.merchant_name
    form.bu_name = props.editing.bu_name
    form.status = props.editing.status
  }
})

function onSave() {
  if (!valid.value) return
  emit('save', { ...form })
}
</script>

<style scoped>
.form { display: flex; flex-direction: column; gap: 12px; }
.form__btn { display: inline-flex; align-items: center; gap: 6px; padding: 8px 18px; border: 1px solid transparent; border-radius: var(--radius-pill, 999px); font-family: var(--font-body, 'Inter', sans-serif); font-size: 13px; font-weight: 600; cursor: pointer; transition: all 200ms; }
.form__btn--cancel { color: var(--color-gray-700, #666); border-color: rgba(0,0,0,0.1); background: transparent; }
.form__btn--cancel:hover { background: rgba(0,0,0,0.04); }
.form__btn--save { color: var(--cta-primary-text, #1E1E1E); background: var(--cta-primary-bg, #FFBC25); border-color: var(--cta-primary-bg, #FFBC25); }
.form__btn--save:hover { transform: translateY(-1px); }
.form__btn--save:disabled { opacity: 0.4; cursor: not-allowed; }
</style>
