<template>
  <section class="ddaudit">
    <header class="ddaudit__head">
      <div>
        <h1 class="ddaudit__title">Audit Log</h1>
        <p class="ddaudit__sub">Who changed what, and when.</p>
      </div>
      <div class="ddaudit__actions">
        <p class="ddaudit__count">{{ total }} {{ total === 1 ? 'entry' : 'entries' }}</p>
        <button class="ddaudit__export" type="button" :disabled="!rows.length" @click="exportCsv">
          <span class="material-symbols-outlined">file_save</span>
          Export page
        </button>
      </div>
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
      <template #cell-action="{ value }">
        <LiBadge :label="value" :variant="actionVariant(value)" size="sm" is-pill />
      </template>
      <template #cell-table_id="{ value }">{{ tableLabel(value) }}</template>
      <template #cell-column_name="{ value }">
        <code v-if="value" class="ddaudit__col">{{ value }}</code>
        <span v-else class="ddaudit__muted">—</span>
      </template>
      <template #cell-change="{ row }">
        <span v-if="!row.column_name" class="ddaudit__muted">—</span>
        <span v-else class="ddaudit__change">
          <span class="ddaudit__old">
            <template v-if="row.old_value !== null">{{ row.old_value }}</template>
            <i v-else class="ddaudit__null">NULL</i>
          </span>
          <span class="ddaudit__arrow">→</span>
          <span class="ddaudit__new">
            <template v-if="row.new_value !== null">{{ row.new_value }}</template>
            <i v-else class="ddaudit__null">NULL</i>
          </span>
        </span>
      </template>
      <template #cell-detail="{ value }">
        <template v-if="value">{{ value }}</template>
        <span v-else class="ddaudit__muted">—</span>
      </template>
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
import LiBadge from '@lib/components/LiBadge.vue'
import { TABLE_IDS, tableLabel } from '../lib/schema.js'
import { useAuditLog } from '../composables/useAuditLog.js'

const {
  rows, loading, error, total, currentPage, totalPages,
  filterTable, filterAction, filterActor, search, actors,
  load, loadActors, resetFilters, exportCsv,
} = useAuditLog()

const columns = [
  { key: 'ts', label: 'When' },
  { key: 'actor', label: 'Who' },
  { key: 'action', label: 'Action' },
  { key: 'table_id', label: 'Table' },
  { key: 'record_key', label: 'Record' },
  { key: 'column_name', label: 'Column' },
  { key: 'change', label: 'Old → New' },
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

function actionVariant(action) {
  if (action === 'INSERT') return 'success'
  if (action === 'UPDATE') return 'warning'
  if (action === 'DELETE') return 'error'
  return 'neutral'
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

.ddaudit__actions { display: flex; align-items: center; gap: 12px; }
.ddaudit__export {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 8px 16px; border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: var(--radius-pill, 999px); background: transparent;
  font-family: var(--font-body, 'Inter', sans-serif);
  font-size: 13px; font-weight: 600; color: var(--color-gray-700, #666);
  cursor: pointer; transition: all 200ms; white-space: nowrap;
}
.ddaudit__export:hover:not(:disabled) { background: rgba(0, 0, 0, 0.04); }
.ddaudit__export:disabled { opacity: 0.45; cursor: not-allowed; }
.ddaudit__export .material-symbols-outlined { font-size: 17px; }

.ddaudit__col {
  font-family: var(--font-mono, ui-monospace, monospace); font-size: 12px;
  background: rgba(0, 0, 0, 0.04); border-radius: 5px; padding: 1px 6px;
}
.ddaudit__muted { color: var(--color-gray-400, #aaa); }
.ddaudit__change { display: inline-flex; align-items: center; gap: 6px; flex-wrap: wrap; font-size: 13px; }
/* Struck through so a removed value reads as removed at a glance. */
.ddaudit__old { text-decoration: line-through; color: var(--color-gray-500, #8e8ea0); }
.ddaudit__new { font-weight: 600; }
.ddaudit__arrow { color: var(--color-gray-400, #aaa); }
/* A NULL must not look like an empty string — the difference matters here. */
.ddaudit__null {
  font-style: normal; font-size: 11px; letter-spacing: 0.4px;
  color: var(--color-gray-400, #aaa);
}
</style>
