<template>
  <section class="ddaudit">
    <header class="ddaudit__head">
      <div>
        <h1 class="ddaudit__title">Audit Log</h1>
        <p class="ddaudit__sub">Who changed what, and when.</p>
      </div>
      <p class="ddaudit__count">{{ total }} {{ total === 1 ? 'entry' : 'entries' }}</p>
    </header>

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
import { onMounted } from 'vue'
import LiTable from '@lib/components/LiTable.vue'
import LiPagination from '@lib/components/LiPagination.vue'
import { tableLabel } from '../lib/schema.js'
import { useAuditLog } from '../composables/useAuditLog.js'

const { rows, loading, error, total, currentPage, totalPages, load } = useAuditLog()

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

function formatTs(v) {
  if (!v) return '—'
  return new Date(v).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

onMounted(load)
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
</style>
