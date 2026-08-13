<template>
  <section class="ddaudit">
    <header class="ddaudit__head">
      <div>
        <h1 class="ddaudit__title">Audit Log</h1>
        <p class="ddaudit__sub">Who changed what, and when.</p>
      </div>
      <p class="ddaudit__count">{{ total }} {{ total === 1 ? 'entry' : 'entries' }}</p>
    </header>

    <div class="ddaudit__filters">
      <LiSelect v-model="filterTable" :options="tableOptions" placeholder="All tables" />
      <LiSelect v-model="filterAction" :options="actionOptions" placeholder="All actions" />
      <LiSelect v-model="filterActor" :options="actorOptions" placeholder="All people" />
      <LiTextField v-model="search" placeholder="Search record, column or value…" />
      <button class="ddaudit__reset" type="button" @click="resetFilters">Reset</button>
    </div>

    <p v-if="error" class="ddaudit__error">{{ error }}</p>

    <LiTable :data="rows" :columns="columns" row-key="audit_id" :loading="loading">
      <template #cell-ts="{ value }">{{ formatTs(value) }}</template>
      <template #cell-table_id="{ value }">{{ tableLabel(value) }}</template>
      <template #cell-column_name="{ value }">{{ value || '—' }}</template>
      <template #cell-detail="{ value }">{{ value || '—' }}</template>
    </LiTable>

    <div v-if="totalPages > 1" class="ddaudit__pagination">
      <LiPagination v-model="currentPage" :total-pages="totalPages" />
    </div>
  </section>
</template>

<script setup>
import { computed, onMounted } from 'vue'
import LiTable from '@lib/components/LiTable.vue'
import LiPagination from '@lib/components/LiPagination.vue'
import LiSelect from '@lib/components/LiSelect.vue'
import LiTextField from '@lib/components/LiTextField.vue'
import { TABLE_IDS, tableLabel } from '../lib/schema.js'
import { useAuditLog } from '../composables/useAuditLog.js'

const {
  rows, loading, error, total, currentPage, totalPages,
  filterTable, filterAction, filterActor, search, actors,
  load, loadActors, resetFilters,
} = useAuditLog()

const columns = [
  { key: 'ts', label: 'When' },
  { key: 'actor', label: 'Who' },
  { key: 'action', label: 'Action' },
  { key: 'table_id', label: 'Table' },
  { key: 'record_key', label: 'Record' },
  { key: 'column_name', label: 'Column' },
  { key: 'old_value', label: 'Old' },
  { key: 'new_value', label: 'New' },
  { key: 'detail', label: 'Detail' },
]

// '' is the "no filter" sentinel the composable expects.
const tableOptions = computed(() => [
  { label: 'All tables', value: '' },
  ...TABLE_IDS.map(id => ({ label: tableLabel(id), value: id })),
])

const actionOptions = [
  { label: 'All actions', value: '' },
  { label: 'Insert', value: 'INSERT' },
  { label: 'Update', value: 'UPDATE' },
  { label: 'Delete', value: 'DELETE' },
  { label: 'Replace', value: 'REPLACE' },
]

const actorOptions = computed(() => [
  { label: 'All people', value: '' },
  ...actors.value.map(a => ({ label: a, value: a })),
])

function formatTs(v) {
  if (!v) return '—'
  return new Date(v).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

onMounted(() => { load(); loadActors() })
</script>

<style scoped>
.ddaudit { display: flex; flex-direction: column; gap: var(--space-md, 16px); }
.ddaudit__head { display: flex; align-items: flex-end; justify-content: space-between; gap: 12px; }
.ddaudit__title { font-size: 24px; font-weight: 800; margin: 0; letter-spacing: -0.4px; }
.ddaudit__sub { font-size: 14px; color: var(--color-gray-500, #8e8ea0); margin: 2px 0 0; }
.ddaudit__count { font-size: 13px; color: var(--color-gray-500, #8e8ea0); margin: 0; white-space: nowrap; }
.ddaudit__error {
  font-size: 13px; color: var(--color-red-400, #C83E3B);
  background: rgba(200, 62, 59, 0.08);
  border-radius: var(--radius-sm, 12px); padding: 10px 14px; margin: 0;
}
.ddaudit__pagination { display: flex; justify-content: center; }

.ddaudit__filters {
  display: grid; grid-template-columns: 1fr 1fr 1fr 2fr auto;
  gap: var(--space-sm, 12px); align-items: end;
}
.ddaudit__reset {
  padding: 10px 18px; border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: var(--radius-pill, 999px); background: transparent;
  font-family: var(--font-body, 'Inter', sans-serif);
  font-size: 13px; font-weight: 600; color: var(--color-gray-700, #666);
  cursor: pointer; transition: all 200ms;
}
.ddaudit__reset:hover { background: rgba(0, 0, 0, 0.04); }

@media (max-width: 1100px) {
  .ddaudit__filters { grid-template-columns: 1fr 1fr; }
}
</style>
