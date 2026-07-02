<template>
  <div class="tab">
    <div class="tab__toolbar">
      <div class="tab__search-row">
        <LiSelect v-model="searchColumnProxy" :options="searchColumns" class="tab__search-col" />
        <LiTextField v-model="searchQueryProxy" :placeholder="'Search ' + searchColumnLabel + '...'" iconLeft="search" class="tab__search" />
      </div>
      <button v-if="canCreate" class="tab__add-btn" @click="$emit('add')">
        <span class="material-symbols-outlined">add</span>
        Add Promo
      </button>
    </div>

    <LiGlassCard variant="light" size="md" :hoverable="false" class="tab__card">
      <LiTable :data="items" :columns="columns" :loading="loading" rowKey="promo_id">
        <template #cell-promo_id="{ value }">
          <span class="tab__code">{{ value }}</span>
        </template>
        <template #cell-merchant_id="{ value }">
          <span v-if="value" class="tab__code">{{ value }}</span>
          <span v-else class="tab__all">All Merchants</span>
        </template>
        <template #cell-discount="{ row }">
          <span class="tab__discount">
            PRM: {{ row.prm_discount_value }}{{ row.prm_discount_type === 'PERCENTAGE' ? '%' : '' }}
            / PL: {{ row.pl_discount_value }}{{ row.pl_discount_type === 'PERCENTAGE' ? '%' : '' }}
          </span>
        </template>
        <template #cell-dates="{ row }">
          <span class="tab__date">{{ fmt(row.start_date) }} – {{ fmt(row.end_date) }}</span>
        </template>
        <template #cell-status="{ value }">
          <span class="tab__status" :class="'tab__status--' + (value || 'active').toLowerCase()">{{ value }}</span>
        </template>
        <template #cell-actions="{ row }">
          <div class="tab__actions">
            <button v-if="canUpdate" class="tab__edit-btn" @click="$emit('edit', row)" title="Edit"><span class="material-symbols-outlined">edit</span></button>
            <button v-if="canDelete" class="tab__del-btn" @click="$emit('delete', row)" title="Delete"><span class="material-symbols-outlined">delete</span></button>
          </div>
        </template>
      </LiTable>

      <LiEmptyState v-if="!loading && items.length === 0" icon="discount" title="No promo rules"
        :description="searchQueryProxy ? 'Try a different search' : 'Add your first promo rule.'" />

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
import LiSelect from '@lib/components/LiSelect.vue'
import LiPagination from '@lib/components/LiPagination.vue'
import LiEmptyState from '@lib/components/LiEmptyState.vue'

const props = defineProps({
  items: Array, loading: Boolean,
  searchQuery: String, searchColumn: String,
  currentPage: Number, totalPages: Number,
  merchantOptions: Array, buNameOptions: Array,
  canCreate: Boolean, canUpdate: Boolean, canDelete: Boolean,
})
const emit = defineEmits(['update:searchQuery', 'update:searchColumn', 'update:currentPage', 'add', 'edit', 'delete'])

const searchQueryProxy = computed({ get: () => props.searchQuery, set: v => emit('update:searchQuery', v) })
const searchColumnProxy = computed({ get: () => props.searchColumn, set: v => emit('update:searchColumn', v) })
const currentPageProxy = computed({ get: () => props.currentPage, set: v => emit('update:currentPage', v) })

const searchColumns = [
  { label: 'Promo ID', value: 'promo_id' },
  { label: 'Name', value: 'promo_name' },
  { label: 'Merchant ID', value: 'merchant_id' },
  { label: 'BU Name', value: 'bu_name' },
]

const searchColumnLabel = computed(() => {
  const c = searchColumns.find(c => c.value === props.searchColumn)
  return c ? c.label.toLowerCase() : 'promo id'
})

const columns = [
  { key: 'promo_id', label: 'Promo ID' },
  { key: 'promo_name', label: 'Name' },
  { key: 'merchant_id', label: 'Merchant' },
  { key: 'bu_name', label: 'BU' },
  { key: 'discount', label: 'Discounts' },
  { key: 'dates', label: 'Period' },
  { key: 'priority', label: 'Pri' },
  { key: 'status', label: 'Status' },
  { key: 'actions', label: '', width: '100px' },
]

function fmt(d) { return d || '—' }
</script>

<style scoped>
.tab__toolbar { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
.tab__search-row { display: flex; align-items: center; gap: 8px; flex: 1; max-width: 420px; }
.tab__search-col { width: 140px; flex-shrink: 0; }
.tab__search { flex: 1; }
.tab__add-btn {
  display: flex; align-items: center; gap: 6px;
  padding: 10px 20px; background: var(--cta-primary-bg, #FFBC25); color: var(--cta-primary-text, #1E1E1E);
  border: none; border-radius: var(--radius-pill, 999px); font-weight: 600; font-size: 13px;
  font-family: var(--font-body, 'Inter', sans-serif); cursor: pointer; transition: all 200ms; white-space: nowrap;
}
.tab__add-btn:hover { transform: translateY(-2px); }
.tab__card { padding: 0; overflow: hidden; }
.tab__code { font-family: 'SF Mono','Fira Code',monospace; font-size: 12px; color: var(--color-gray-700, #666); }
.tab__all { font-size: 12px; color: var(--color-gray-400, #B3B3B3); font-style: italic; }
.tab__discount { font-size: 12px; }
.tab__date { font-size: 12px; color: var(--color-gray-400, #B3B3B3); }
.tab__status { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 11px; font-weight: 700; }
.tab__status--active { background: #E6F4EA; color: #137333; }
.tab__status--inactive { background: #F1F3F4; color: #5F6368; }
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
</style>
