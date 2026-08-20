<template>
  <LiModal
    :model-value="modelValue"
    :title="isEdit ? 'Edit Merchant' : 'Add Merchant'"
    size="md"
    @update:model-value="close"
  >
    <div class="ddmerf">
      <p class="ddmerf__req"><span>*</span> Required.</p>

      <div class="ddmerf__field">
        <LiTextField
          v-model="form.merchant_id"
          label="Merchant ID *"
          placeholder="e.g. 000885002405722"
          :disabled="isEdit"
          helper-text="Stored and exported as text — leading zeros are kept."
        />
        <!-- Not silently greyed out: merchant_id is the key the downstream
             import matches on and the target of the promo rules' foreign key,
             so renaming it here would orphan promos rather than rename them. -->
        <p v-if="isEdit" class="ddmerf__note">
          The merchant ID cannot be changed. It is the key downstream imports match on, and promo rules
          point at it — delete this merchant and add it again under the new ID if it really has to change.
        </p>
        <p v-else-if="leadingZeroNote" class="ddmerf__warn">
          <span class="material-symbols-outlined">info</span>
          {{ leadingZeroNote }}
        </p>
      </div>

      <LiTextField
        v-model="form.merchant_name"
        label="Merchant Name *"
        placeholder="e.g. TRANSMART CENTRAL PARK"
      />

      <!-- Offered as a list, never as free text: bu_name is a foreign key onto
           qrdd_bu_accounts.name, and a typo comes back as an opaque 23503. -->
      <LiSelect
        v-model="form.bu_name"
        label="BU Name *"
        placeholder="- select business unit -"
        :options="buOptions"
        helper-text="Must already exist under Business Units."
      />

      <LiSelect v-model="form.status" label="Status *" :options="statusOptions" />

      <ul v-if="problems.length" class="ddmerf__problems">
        <li v-for="p in problems" :key="p">{{ p }}</li>
      </ul>
    </div>

    <template #footer>
      <LiButton variant="ghost" @click="close">Cancel</LiButton>
      <LiButton :loading="saving" @click="submit">{{ isEdit ? 'Save Changes' : 'Create' }}</LiButton>
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
import { STATUS_VALUES } from '../lib/columns.js'
import { validateRow } from '../lib/validate.js'
import { useDdTable } from '../composables/useDdTable.js'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  row: { type: Object, default: null },
})
const emit = defineEmits(['update:modelValue', 'saved'])

// A second useDdTable instance, used for its write path only. The alternative
// was passing createRow/updateRow down as props, which would let a caller hand
// this form a writer for a different table.
const { saving, createRow, updateRow } = useDdTable('merchants')

const statusOptions = STATUS_VALUES.map(v => ({ label: v, value: v }))

const blank = () => ({ merchant_id: '', merchant_name: '', bu_name: '', status: 'ACTIVE' })
const form = reactive(blank())
const problems = ref([])

const isEdit = computed(() => !!props.row)

const buNames = ref([])
const buOptions = computed(() => {
  // A merchant may still name a BU that has since been renamed or removed. Keep
  // it in the list or opening the form would silently blank the field.
  const names = new Set(buNames.value)
  if (form.bu_name) names.add(form.bu_name)
  return [...names].sort().map(n => ({ label: n, value: n }))
})

/** One row per source of fund downstream, so each BU name arrives twice. */
async function loadBuNames() {
  const { data, error } = await supabase.from('qrdd_bu_accounts').select('name').order('name')
  if (error) return
  buNames.value = [...new Set((data || []).map(r => r.name).filter(Boolean))]
}

// The case people lose most often: a spreadsheet reads 000885… as a number,
// drops the zeros, and the ID no longer matches anything downstream. Advisory
// only — a genuinely zero-led ID is normal here.
const leadingZeroNote = computed(() => {
  const v = String(form.merchant_id).trim()
  return /^0\d+$/.test(v)
    ? 'This ID starts with a zero. That is kept as typed — check it against the source, since a spreadsheet may have dropped leading zeros before you copied it.'
    : ''
})

watch(() => props.modelValue, (open) => {
  if (!open) return
  problems.value = []
  Object.assign(form, blank())
  if (props.row) {
    form.merchant_id = props.row.merchant_id ?? ''
    form.merchant_name = props.row.merchant_name ?? ''
    form.bu_name = props.row.bu_name ?? ''
    form.status = props.row.status ?? 'ACTIVE'
  }
  loadBuNames()
}, { immediate: true })

function close() {
  emit('update:modelValue', false)
}

async function submit() {
  const values = {
    merchant_id: String(form.merchant_id).trim(),
    merchant_name: String(form.merchant_name).trim(),
    bu_name: form.bu_name,
    status: form.status,
  }

  // Validated here as well as inside the composable: the composable toasts only
  // the first problem, and a form that reports one missing field at a time
  // makes people submit four times to learn four things.
  problems.value = validateRow('merchants', values)
  if (problems.value.length) return

  const res = isEdit.value
    ? await updateRow(props.row.id, values)
    : await createRow(values)

  if (!res.ok) {
    problems.value = res.problems || []
    return
  }
  emit('saved')
  close()
}
</script>

<style scoped>
.ddmerf { display: flex; flex-direction: column; gap: var(--space-sm, 12px); }
.ddmerf__req { margin: 0; font-size: 12.5px; color: var(--color-gray-500, #8e8ea0); }
.ddmerf__req span { color: var(--color-red-400, #C83E3B); font-weight: 700; }

.ddmerf__field { display: flex; flex-direction: column; gap: 4px; }
.ddmerf__note {
  margin: 0; font-size: 12px; line-height: 1.45;
  color: var(--color-gray-600, #808080);
}
.ddmerf__warn {
  display: flex; align-items: flex-start; gap: 6px;
  margin: 0; padding: 8px 10px;
  border-radius: var(--radius-sm, 12px);
  background: rgba(255, 188, 37, 0.14);
  font-size: 12px; line-height: 1.45;
  color: var(--color-gray-800, #4D4D4D);
}
.ddmerf__warn .material-symbols-outlined { font-size: 16px; flex-shrink: 0; }

.ddmerf__problems {
  margin: 0; padding: 10px 14px 10px 30px;
  border-radius: var(--radius-sm, 12px);
  background: rgba(200, 62, 59, 0.08);
  color: var(--color-red-400, #C83E3B);
  font-size: 12.5px; line-height: 1.6;
}
</style>
