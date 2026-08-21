<template>
  <LiModal :model-value="modelValue" size="lg" @update:model-value="close">
    <template #header>
      <h2 class="ddrf__head">
        {{ verb }} <span class="ddrf__table">{{ targetTable }}</span>
      </h2>
    </template>

    <div class="ddrf__lead">
      <p class="ddrf__lead-text">
        <template v-if="isEdit">
          Editing <code>{{ pk }}</code> = <b>{{ row?.[pk] }}</b>. Blank leaves a
          nullable column NULL; the id and the stamps are filled in for you.
        </template>
        <template v-else-if="duplicate">
          Every value copied from <code>{{ pk }}</code> = <b>{{ row?.[pk] }}</b>,
          except the key columns — those have to be new.
        </template>
        <template v-else>
          Raw insert. The business rules below still apply — they are the same
          ones the guided screens enforce.
        </template>
      </p>
      <button class="ddrf__toggle" type="button" :aria-pressed="jsonMode" @click="toggleJson">
        <LiIcon :name="jsonMode ? 'view_list' : 'data_object'" />
        {{ jsonMode ? 'Fields' : 'Raw JSON' }}
      </button>
    </div>

    <!-- Every problem at once. createRow/updateRow toast only the first, which
         is fine on a guided screen and useless here, where someone typing raw
         values wants the whole list before they try again. -->
    <ul v-if="problems.length" class="ddrf__problems">
      <li v-for="p in problems" :key="p">{{ p }}</li>
    </ul>

    <!-- The escape hatch inside the escape hatch: for the row shape the field
         list cannot express, e.g. a value the input type refuses to hold. -->
    <div v-if="jsonMode" class="ddrf__json">
      <LiTextField
        v-model="jsonText"
        type="area"
        :rows="16"
        :error="jsonError"
        helper-text="One JSON object keyed by column name. Unknown keys are ignored on save."
      />
    </div>

    <div v-else class="ddrf__fields">
      <div v-for="col in editable" :key="col.name" class="ddrf__field">
        <label class="ddrf__label">
          <code>{{ col.name }}</code>
          <span v-if="col.required" class="ddrf__req" title="Required">*</span>
          <span v-else-if="col.nullable" class="ddrf__nullable">nullable</span>
        </label>

        <LiSelect
          v-if="col.type === 'enum'"
          :model-value="values[col.name] ?? ''"
          :options="enumOptions(col)"
          :placeholder="col.nullable ? '' : '— select —'"
          :disabled="isLocked(col)"
          :helper-text="helperFor(col)"
          @update:model-value="v => (values[col.name] = v)"
        />
        <LiTextField
          v-else
          :model-value="values[col.name] ?? ''"
          :type="inputType(col)"
          :disabled="isLocked(col)"
          :helper-text="helperFor(col)"
          @update:model-value="v => (values[col.name] = v)"
        />
      </div>
    </div>

    <!-- Who last touched this row, and when. Read-only because the app writes
         them and the audit trigger derives its own actor server-side anyway. -->
    <div v-if="isEdit && stamps.length" class="ddrf__stamps">
      <p class="ddrf__stamps-title">Stamps</p>
      <div class="ddrf__stamps-grid">
        <div v-for="s in stamps" :key="s.name" class="ddrf__stamp">
          <code>{{ s.name }}</code>
          <span v-if="s.value === null || s.value === undefined || s.value === ''" class="ddrf__null">NULL</span>
          <span v-else class="ddrf__stamp-value">{{ s.display }}</span>
        </div>
      </div>
    </div>

    <template #footer>
      <LiButton variant="ghost" @click="close">Cancel</LiButton>
      <LiButton :loading="saving" :disabled="!!jsonError" @click="submit">
        {{ isEdit ? 'Save changes' : 'Insert row' }}
      </LiButton>
    </template>
  </LiModal>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import LiModal from '@lib/components/LiModal.vue'
import LiButton from '@lib/components/LiButton.vue'
import LiTextField from '@lib/components/LiTextField.vue'
import LiSelect from '@lib/components/LiSelect.vue'
import { useDdTable } from '../composables/useDdTable.js'
import { DD_TABLES, TABLE_IDS } from '../lib/schema.js'
import { columns, editableColumns, primaryKey, STAMP_COLUMNS } from '../lib/columns.js'
import { validateRow } from '../lib/validate.js'
import { formatTimestamp } from '../lib/format.js'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  tableId: { type: String, required: true },
  // null creates. With `duplicate`, an existing row is only a template.
  row: { type: Object, default: null },
  duplicate: { type: Boolean, default: false },
})

const emit = defineEmits(['update:modelValue', 'saved'])

// One composable per table, all three built up front: useDdTable registers
// watchers and an onUnmounted hook during setup, so it cannot be created from a
// watcher when `tableId` changes under a mounted modal. None of them query
// anything until a write happens.
const tables = Object.fromEntries(TABLE_IDS.map(id => [id, useDdTable(id)]))
const api = computed(() => tables[props.tableId] ?? null)

const values = ref({})
const problems = ref([])
const jsonMode = ref(false)
const jsonText = ref('')

const isEdit = computed(() => !!props.row && !props.duplicate)
const pk = computed(() => primaryKey(props.tableId))
const targetTable = computed(() => DD_TABLES[props.tableId]?.targetTable ?? props.tableId)
const saving = computed(() => api.value?.saving.value ?? false)

const verb = computed(() => {
  if (isEdit.value) return 'Edit row in'
  if (props.duplicate) return 'Duplicate row in'
  return 'Insert row into'
})

// uuid and timestamp columns are all `auto`, so editableColumns already drops
// them; the filter states the rule rather than relying on that staying true.
const editable = computed(() =>
  editableColumns(props.tableId).filter(c => c.type !== 'uuid' && c.type !== 'timestamp'),
)

const stamps = computed(() => {
  if (!props.row) return []
  return columns(props.tableId)
    .filter(c => STAMP_COLUMNS.includes(c.name))
    .map(c => ({
      name: c.name,
      value: props.row[c.name],
      display: c.type === 'timestamp' ? formatTimestamp(props.row[c.name]) : props.row[c.name],
    }))
})

/** useDdTable.toRow() drops the primary key from an UPDATE, so an editable key
 *  would look changeable and silently not change. Locked instead. */
const isLocked = (col) => isEdit.value && col.name === pk.value

const inputType = (col) => {
  if (col.type === 'date') return 'date'
  if (col.type === 'number' || col.type === 'integer') return 'number'
  return 'text'
}

// The reverse of the guided forms: the column name is the label, because on
// this screen the person is thinking in column names, and the friendly label is
// the hint that tells them which one they are looking at.
function helperFor(col) {
  if (isLocked(col)) return `${col.label} · primary key, fixed after insert`
  if (col.decimals != null) return `${col.label} · ${col.decimals} dp downstream`
  return col.label
}

function enumOptions(col) {
  const opts = (col.options || []).map(v => ({ label: v, value: v }))
  // A nullable enum has to be clearable, or a value set once can never be unset.
  return col.nullable ? [{ label: '— none —', value: '' }, ...opts] : opts
}

const jsonError = computed(() => {
  if (!jsonMode.value) return ''
  try {
    const parsed = JSON.parse(jsonText.value)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return 'Expected a single JSON object keyed by column name.'
    }
    return ''
  } catch (e) {
    return e.message
  }
})

function reset() {
  const next = {}
  editable.value.forEach((col) => {
    const raw = props.row ? props.row[col.name] : ''
    // A null becomes '' in the input; coerce() turns it back into null on save
    // for a nullable column, so the round trip is lossless.
    next[col.name] = raw === null || raw === undefined ? '' : raw
  })
  // A duplicate that keeps its keys inserts into a unique index and fails on a
  // row the person cannot see from here. Cleared so they are typed fresh —
  // keyColumns, not just the local pk, because merchant_id and name+sof are
  // what make a row distinct downstream even where a surrogate id exists.
  if (props.duplicate) {
    const keys = new Set([...(DD_TABLES[props.tableId]?.keyColumns || []), pk.value])
    keys.forEach((k) => { if (k in next) next[k] = '' })
  }
  values.value = next
  problems.value = []
  jsonMode.value = false
  jsonText.value = ''
}

// Reset on open rather than on prop change: the row and the mode are set by the
// caller in the same tick it flips this open.
watch(() => props.modelValue, (open) => { if (open) reset() })

function toggleJson() {
  if (!jsonMode.value) {
    jsonText.value = JSON.stringify(values.value, null, 2)
    jsonMode.value = true
    return
  }
  // Going back to the fields with unparseable text would silently discard it.
  if (jsonError.value) return
  values.value = { ...values.value, ...JSON.parse(jsonText.value) }
  jsonMode.value = false
}

function close() {
  emit('update:modelValue', false)
}

async function submit() {
  if (!api.value) return
  if (jsonMode.value) {
    if (jsonError.value) return
    values.value = { ...values.value, ...JSON.parse(jsonText.value) }
  }

  // This screen bypasses the guided forms; it must not bypass the rules they
  // enforce. Below this line the only remaining gate is the CHECK constraints,
  // whose messages name an expression rather than a column.
  const found = validateRow(props.tableId, values.value)
  if (found.length) {
    problems.value = found
    return
  }
  problems.value = []

  const res = isEdit.value
    ? await api.value.updateRow(props.row[pk.value], values.value)
    : await api.value.createRow(values.value)

  if (res?.ok) {
    emit('saved')
    close()
  } else {
    problems.value = res?.problems ?? []
  }
}
</script>

<style scoped>
.ddrf__head { margin: 0; font-size: 17px; font-weight: 700; letter-spacing: -0.2px; }
.ddrf__table { font-family: var(--font-mono, ui-monospace, monospace); color: #6366F1; }

.ddrf__lead {
  display: flex; align-items: flex-start; justify-content: space-between; gap: 12px;
  margin-bottom: var(--space-md, 16px);
}
.ddrf__lead-text {
  margin: 0; font-size: 12.5px; line-height: 1.6;
  color: var(--color-gray-500, #8e8ea0);
}
.ddrf__lead-text code, .ddrf__label code, .ddrf__stamp code {
  font-family: var(--font-mono, ui-monospace, monospace); font-size: 11.5px;
  background: rgba(0, 0, 0, 0.04); border-radius: 5px; padding: 1px 6px;
}
.ddrf__toggle {
  display: inline-flex; align-items: center; gap: 6px; flex: none;
  padding: 6px 14px; border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: var(--radius-pill, 999px); background: transparent;
  font-family: var(--font-body, 'Inter', sans-serif);
  font-size: 12px; font-weight: 600; color: var(--color-gray-700, #666);
  cursor: pointer; transition: all 200ms; white-space: nowrap;
}
.ddrf__toggle:hover { background: rgba(0, 0, 0, 0.04); }
.ddrf__toggle .li-icon { font-size: 16px; }

.ddrf__problems {
  margin: 0 0 var(--space-md, 16px); padding: 10px 14px 10px 30px;
  border-radius: var(--radius-sm, 12px);
  background: rgba(200, 62, 59, 0.08);
  font-size: 12.5px; line-height: 1.7; color: var(--color-red-500, #A33129);
}

.ddrf__fields {
  display: grid; grid-template-columns: 1fr 1fr;
  gap: var(--space-sm, 12px) var(--space-md, 16px);
}
.ddrf__field { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.ddrf__label { display: flex; align-items: center; gap: 6px; }
.ddrf__req { color: var(--color-red-400, #C83E3B); font-weight: 700; font-size: 12px; }
.ddrf__nullable { font-size: 10px; letter-spacing: 0.3px; color: var(--color-gray-400, #B3B3B3); }

/* The JSON view is code, so it is set as code — a proportional font here makes
   a misplaced brace invisible. */
.ddrf__json :deep(.li-textfield-input) {
  font-family: var(--font-mono, ui-monospace, monospace);
  font-size: 12px; line-height: 1.6;
}

.ddrf__stamps { margin-top: var(--space-md, 16px); padding-top: 12px; border-top: 1px solid rgba(0, 0, 0, 0.06); }
.ddrf__stamps-title {
  margin: 0 0 8px; font-size: 10px; font-weight: 700; letter-spacing: 0.7px;
  text-transform: uppercase; color: var(--color-gray-400, #aaa);
}
.ddrf__stamps-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 16px; }
.ddrf__stamp { display: flex; align-items: center; gap: 8px; min-width: 0; }
.ddrf__stamp-value {
  font-size: 12px; color: var(--color-gray-700, #666); min-width: 0;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.ddrf__null {
  font-size: 11px; letter-spacing: 0.4px; color: var(--color-gray-400, #aaa);
}

@media (max-width: 640px) {
  .ddrf__fields, .ddrf__stamps-grid { grid-template-columns: 1fr; }
  .ddrf__lead { flex-direction: column; }
}
</style>
