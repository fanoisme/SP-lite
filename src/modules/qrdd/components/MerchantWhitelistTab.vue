<template>
  <div class="tab">
    <div class="tab__toolbar">
      <LiTextField v-model="searchQueryProxy" placeholder="Search merchants..." iconLeft="search" class="tab__search" />
      <div class="tab__toolbar-actions">
        <button class="tab__export-btn" @click="$emit('export')">
          <span class="material-symbols-outlined">file_save</span>
          Export
        </button>
        <button v-if="canCreate" class="tab__add-btn" @click="$emit('add')">
          <span class="material-symbols-outlined">add</span>
          Add Merchant
        </button>
      </div>
    </div>

    <LiGlassCard variant="light" size="md" :hoverable="false" class="tab__card">
      <LiTable :data="items" :columns="columns" :loading="loading" rowKey="id">
        <template #cell-merchant_id="{ value }">
          <span class="tab__code">{{ value }}</span>
        </template>
        <template #cell-status="{ value }">
          <span class="tab__status" :class="'tab__status--' + (value || 'active').toLowerCase()">{{ value }}</span>
        </template>
        <template #cell-created_by="{ row }">
          <span class="tab__meta">{{ row.created_by }}<br><small>{{ formatDate(row.created_at) }}</small></span>
        </template>
        <template #cell-updated_at="{ row }">
          <span class="tab__meta">{{ row.updated_by }}<br><small>{{ formatDate(row.updated_at) }}</small></span>
        </template>
        <template #cell-actions="{ row }">
          <div class="tab__actions">
            <button v-if="canUpdate" class="tab__edit-btn" @click="$emit('edit', row)" title="Edit"><span class="material-symbols-outlined">edit</span></button>
            <button v-if="canDelete" class="tab__del-btn" @click="$emit('delete', row)" title="Delete"><span class="material-symbols-outlined">delete</span></button>
          </div>
        </template>
      </LiTable>

      <LiEmptyState v-if="!loading && items.length === 0" icon="store" title="No merchants"
        :description="searchQueryProxy ? 'Try a different search' : 'Add your first merchant.'" />

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
  buNameOptions: Array,
  canCreate: Boolean, canUpdate: Boolean, canDelete: Boolean,
})
const emit = defineEmits(['update:searchQuery', 'update:currentPage', 'add', 'edit', 'delete', 'export'])

const searchQueryProxy = computed({ get: () => props.searchQuery, set: v => emit('update:searchQuery', v) })
const currentPageProxy = computed({ get: () => props.currentPage, set: v => emit('update:currentPage', v) })

const columns = [
  { key: 'merchant_id', label: 'Merchant ID', sortable: true },
  { key: 'merchant_name', label: 'Merchant Name', sortable: true },
  { key: 'bu_name', label: 'BU Name' },
  { key: 'status', label: 'Status' },
  { key: 'created_by', label: 'Created' },
  { key: 'updated_at', label: 'Updated' },
  { key: 'actions', label: '', width: '100px' },
]

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
.tab__code { font-family: 'SF Mono','Fira Code',monospace; font-size: 12px; color: var(--color-gray-700, #666); }
.tab__status { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 11px; font-weight: 700; }
.tab__status--active { background: #E6F4EA; color: #137333; }
.tab__status--inactive { background: #F1F3F4; color: #5F6368; }
.tab__meta { font-size: 12px; }
.tab__meta small { color: var(--color-gray-400, #B3B3B3); display: block; }
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
