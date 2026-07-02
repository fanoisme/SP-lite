<template>
  <div class="li-table-container">
    <table class="li-table">
      <thead>
        <tr>
          <th v-if="selectable" class="li-table-select-col">
            <input type="checkbox" :checked="allSelected" :indeterminate="someSelected" @change="toggleAll" />
          </th>
          <th 
            v-for="col in columns" 
            :key="col.key"
            :class="[col.align ? `text-${col.align}` : 'text-left', { 'is-sortable': col.sortable }]"
            @click="col.sortable ? handleSort(col.key) : null"
          >
            <div class="li-table-th-content">
              {{ col.label }}
              <span v-if="col.sortable" class="li-table-sort-icon">
                <svg v-if="sortKey !== col.key" width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M4 10L8 14L12 10M4 6L8 2L12 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                <svg v-else-if="sortOrder === 'asc'" width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M4 6L8 2L12 6M8 14V2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                <svg v-else width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M4 10L8 14L12 10M8 2V14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </span>
            </div>
          </th>
        </tr>
      </thead>
      <tbody>
        <template v-if="!loading && data.length > 0">
          <tr v-for="(row, index) in data" :key="index">
            <td v-if="selectable" class="li-table-select-col">
              <input type="checkbox" :value="row[rowKey]" v-model="selectedRows" />
            </td>
            <td 
              v-for="col in columns" 
              :key="col.key"
              :class="[col.align ? `text-${col.align}` : 'text-left']"
            >
              <slot :name="`cell-${col.key}`" :row="row" :value="row[col.key]">
                {{ row[col.key] }}
              </slot>
            </td>
          </tr>
        </template>
        
        <tr v-if="loading">
          <td :colspan="selectable ? columns.length + 1 : columns.length" class="li-table-loading">
            Loading data...
          </td>
        </tr>
        
        <tr v-if="!loading && data.length === 0">
          <td :colspan="selectable ? columns.length + 1 : columns.length" class="li-table-empty">
            No data available.
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';

const props = defineProps({
  data: {
    type: Array,
    default: () => []
  },
  columns: {
    type: Array,
    required: true,
    // [{ key: 'id', label: 'ID', sortable: true, align: 'left' }]
  },
  rowKey: {
    type: String,
    default: 'id'
  },
  selectable: Boolean,
  loading: Boolean,
});

const emit = defineEmits(['sort', 'selection-change']);

const sortKey = ref(null);
const sortOrder = ref('asc');
const selectedRows = ref([]);

const handleSort = (key) => {
  if (sortKey.value === key) {
    sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc';
  } else {
    sortKey.value = key;
    sortOrder.value = 'asc';
  }
  emit('sort', { key: sortKey.value, order: sortOrder.value });
};

const allSelected = computed(() => {
  return props.data.length > 0 && selectedRows.value.length === props.data.length;
});

const someSelected = computed(() => {
  return selectedRows.value.length > 0 && selectedRows.value.length < props.data.length;
});

const toggleAll = (e) => {
  if (e.target.checked) {
    selectedRows.value = props.data.map(row => row[props.rowKey]);
  } else {
    selectedRows.value = [];
  }
};

watch(selectedRows, (newVal) => {
  emit('selection-change', newVal);
}, { deep: true });
</script>

<style scoped>
.li-table-container {
  width: 100%;
  overflow-x: auto;
  border-radius: var(--radius-md, 8px);
  border: 1px solid var(--color-gray-200, #E6E6E6);
  font-family: var(--font-family, 'Inter', sans-serif);
  background: var(--color-gray-0, #FFFFFF);
}

.li-table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
}

.li-table th, .li-table td {
  padding: 16px;
  border-bottom: 1px solid var(--color-gray-200, #E6E6E6);
  font-size: var(--text-sm, 16px);
}

.li-table th {
  background-color: var(--color-gray-50, #F9F9F9);
  color: var(--color-gray-600, #808080);
  font-weight: 600;
  font-size: var(--text-xs, 14px);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.li-table th.is-sortable {
  cursor: pointer;
  user-select: none;
}

.li-table th.is-sortable:hover {
  background-color: var(--color-gray-100, #F2F2F2);
  color: var(--color-gray-900, #333333);
}

.li-table tbody tr {
  transition: background-color var(--dur-short, 200ms);
}

.li-table tbody tr:hover {
  background-color: var(--color-gray-50, #F9F9F9);
}

.li-table tbody tr:last-child td {
  border-bottom: none;
}

.li-table-th-content {
  display: flex;
  align-items: center;
  gap: 8px;
}

.li-table-sort-icon {
  display: flex;
  align-items: center;
  color: var(--color-gray-400, #B3B3B3);
}

.li-table th.is-sortable:hover .li-table-sort-icon {
  color: var(--color-gray-600, #808080);
}

.li-table-select-col {
  width: 48px;
  text-align: center;
}

.text-left { text-align: left; justify-content: flex-start; }
.text-center { text-align: center; justify-content: center; }
.text-right { text-align: right; justify-content: flex-end; }

.li-table-loading, .li-table-empty {
  text-align: center;
  padding: 32px 16px;
  color: var(--color-gray-500, #999999);
  font-style: italic;
}
</style>
