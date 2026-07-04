<template>
  <div class="tab">
    <div class="tab__toolbar">
      <LiTextField v-model="searchQueryProxy" placeholder="Search BU accounts..." iconLeft="search" class="tab__search" />
      <div class="tab__toolbar-actions">
        <button v-if="canExport" class="tab__export-btn" @click="showDateFilter = !showDateFilter" :class="{ 'tab__export-btn--active': showDateFilter }">
          <span class="material-symbols-outlined">filter_alt</span>
          Filter
        </button>
        <button v-if="canExport" class="tab__export-btn" @click="$emit('export')">
          <span class="material-symbols-outlined">file_save</span>
          Export
        </button>
        <button v-if="canCreate" class="tab__add-btn" @click="$emit('add')">
          <span class="material-symbols-outlined">add</span>
          Add BU Account
        </button>
      </div>
    </div>

    <div v-if="showDateFilter" class="tab__date-filter">
      <LiTextField v-model="dateFromProxy" label="Updated from" type="date" />
      <LiTextField v-model="dateToProxy" label="Updated to" type="date" />
    </div>

    <LiGlassCard variant="light" size="md" :hoverable="false" class="tab__card">
      <LiTable :data="items" :columns="columns" :loading="loading" rowKey="id">
        <template #cell-sof="{ value }">
          <span class="tab__sof-badge" :class="'tab__sof--' + (value || '').toLowerCase()">{{ value }}</span>
        </template>
        <template #cell-percentage1="{ row }">
          <span class="tab__pct">{{ formatPct(row.percentage1) }}%</span>
          <small class="tab__acct-name">{{ row.acctname1 }}</small>
          <small class="tab__acct-num">{{ row.account1 }}</small>
        </template>
        <template #cell-percentage2="{ row }">
          <span class="tab__pct">{{ formatPct(row.percentage2) }}%</span>
          <small class="tab__acct-name">{{ row.acctname2 }}</small>
          <small class="tab__acct-num">{{ row.account2 }}</small>
        </template>
        <template #cell-updated_at="{ value }">
          <span class="tab__date">{{ formatDate(value) }}</span>
        </template>
        <template #cell-actions="{ row }">
          <div class="tab__actions">
            <button v-if="canUpdate" class="tab__edit-btn" @click="$emit('edit', row)" title="Edit"><span class="material-symbols-outlined">edit</span></button>
            <button v-if="canDelete" class="tab__del-btn" @click="$emit('delete', row)" title="Delete"><span class="material-symbols-outlined">delete</span></button>
          </div>
        </template>
      </LiTable>

      <LiEmptyState v-if="!loading && items.length === 0" icon="account_balance" title="No BU accounts"
        :description="searchQueryProxy ? 'Try a different search' : 'Add your first BU account.'" />

      <div v-if="totalPages > 1" class="tab__pagination">
        <LiPagination v-model="currentPageProxy" :totalPages="totalPages" />
      </div>
    </LiGlassCard>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import LiGlassCard from '@lib/components/LiGlassCard.vue'
import LiTable from '@lib/components/LiTable.vue'
import LiTextField from '@lib/components/LiTextField.vue'
import LiPagination from '@lib/components/LiPagination.vue'
import LiEmptyState from '@lib/components/LiEmptyState.vue'

const props = defineProps({
  items: Array, loading: Boolean,
  searchQuery: String, currentPage: Number, totalPages: Number,
  dateFrom: String, dateTo: String,
  canCreate: Boolean, canUpdate: Boolean, canDelete: Boolean,
  canExport: { type: Boolean, default: true },
})
const emit = defineEmits(['update:searchQuery', 'update:currentPage', 'update:dateFrom', 'update:dateTo', 'add', 'edit', 'delete', 'export'])

const searchQueryProxy = computed({ get: () => props.searchQuery, set: v => emit('update:searchQuery', v) })
const currentPageProxy = computed({ get: () => props.currentPage, set: v => emit('update:currentPage', v) })
const dateFromProxy = computed({ get: () => props.dateFrom, set: v => emit('update:dateFrom', v) })
const dateToProxy = computed({ get: () => props.dateTo, set: v => emit('update:dateTo', v) })
const showDateFilter = computed({
  get: () => !!(props.dateFrom || props.dateTo),
  set: v => { if (!v) { emit('update:dateFrom', ''); emit('update:dateTo', '') } },
})

const columns = [
  { key: 'name', label: 'Name', sortable: true },
  { key: 'sof', label: 'SOF' },
  { key: 'percentage1', label: 'Allo Expense' },
  { key: 'percentage2', label: 'Receivable' },
  { key: 'updated_at', label: 'Updated' },
  { key: 'actions', label: '', width: '100px' },
]

function formatPct(val) { return val != null ? Math.round(Number(val) * 100) : '0' }
function formatDate(d) { return d ? new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '—' }
</script>

<style scoped>
.tab__toolbar { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
.tab__search { flex: 1; max-width: 320px; }
.tab__add-btn {
  display: flex; align-items: center; gap: 6px;
  padding: 10px 20px; background: var(--cta-primary-bg, #FFBC25); color: var(--cta-primary-text, #1E1E1E);
  border: none; border-radius: var(--radius-pill, 999px); font-weight: 600; font-size: 13px;
  font-family: var(--font-body, 'Inter', sans-serif); cursor: pointer; transition: all 200ms; white-space: nowrap;
}
.tab__add-btn:hover { transform: translateY(-2px); }
.tab__card { padding: 0; overflow: hidden; }
.tab__sof-badge { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 11px; font-weight: 700; }
.tab__sof--prime { background: #E6E6FF; color: #0047B2; }
.tab__sof--paylater { background: #FFF3D6; color: #CC7000; }
.tab__pct { display: block; font-weight: 600; font-size: 13px; }
.tab__acct-name { font-size: 12px; color: var(--color-gray-500, #8e8ea0); display: block; }
.tab__acct-num { font-family: 'SF Mono','Fira Code',monospace; font-size: 10px; color: var(--color-gray-400, #B3B3B3); display: block; }
.tab__date { font-size: 12px; color: var(--color-gray-400, #B3B3B3); font-variant-numeric: tabular-nums; }
.tab__actions { display: inline-flex; align-items: center; gap: 2px; }
.tab__edit-btn, .tab__del-btn {
  background: none; border: none; cursor: pointer; padding: 6px; border-radius: var(--radius-sm, 12px);
  display: inline-flex; align-items: center; justify-content: center; color: var(--color-gray-400, #B3B3B3);
  transition: all 200ms;
}
.tab__edit-btn:hover { color: var(--cta-primary-bg, #FFBC25); background: rgba(255,188,37,0.12); }
.tab__del-btn:hover { color: var(--color-red-400, #C83E3B); background: rgba(200,62,59,0.08); }
.tab__edit-btn .material-symbols-outlined, .tab__del-btn .material-symbols-outlined { font-size: 18px; }
.tab__pagination { display: flex; justify-content: center; padding: 16px; border-top: 1px solid rgba(0,0,0,0.04); }
.tab__toolbar-actions { display: flex; align-items: center; gap: 8px; }
.tab__export-btn {
  display: flex; align-items: center; gap: 6px;
  padding: 10px 16px;
  background: transparent;
  color: var(--color-gray-600, #666);
  border: 1px solid rgba(0,0,0,0.1);
  border-radius: var(--radius-pill, 999px);
  font-weight: 600; font-size: 13px;
  font-family: var(--font-body, 'Inter', sans-serif);
  cursor: pointer; transition: all 200ms; white-space: nowrap;
}
.tab__export-btn:hover { background: rgba(0,0,0,0.04); border-color: rgba(0,0,0,0.2); }
.tab__export-btn .material-symbols-outlined { font-size: 18px; }
.tab__export-btn--active { background: rgba(99,102,241,0.08); border-color: rgba(99,102,241,0.3); color: #6366F1; }
.tab__date-filter { display: flex; gap: 12px; margin-bottom: 16px; }
.tab__date-filter > * { flex: 1; max-width: 220px; }

/* ── Responsive ── */
@media (max-width: 768px) {
  .tab__toolbar {
    flex-direction: column;
    gap: 8px;
  }

  .tab__search {
    max-width: 100%;
  }

  .tab__toolbar-actions {
    width: 100%;
    justify-content: flex-end;
  }
}

@media (max-width: 480px) {
  .tab__toolbar-actions {
    flex-wrap: wrap;
    gap: 6px;
  }

  .tab__add-btn,
  .tab__export-btn {
    padding: 8px 14px;
    font-size: 12px;
  }
}
</style>
