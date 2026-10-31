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
                <LiIcon v-if="sortKey !== col.key" name="unfold-vertical" size="sm" />
                <LiIcon v-else-if="sortOrder === 'asc'" name="arrow-up" size="sm" />
                <LiIcon v-else name="arrow-down" size="sm" />
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
/* Allo table (app.css .table-wrap / table.t): 36px header, 40px rows, sticky header. */
.li-table-container {
  position: relative;
  width: 100%;
  overflow-x: auto;
  border-radius: 10px;
  border: 1px solid var(--color-border);
  background: var(--color-bg);
}

.li-table {
  width: 100%;
  min-width: 680px;
  border-collapse: collapse;
  text-align: left;
}

.li-table th {
  position: sticky;
  top: 0;
  height: 36px;
  padding: 0 12px;
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
  color: var(--color-text-muted);
  font-size: var(--text-xs);
  font-weight: 600;
}

.li-table td {
  height: 40px;
  padding: 0 12px;
  border-bottom: 1px solid var(--color-border);
  font-size: var(--text-sm);
  color: var(--color-text);
}

.li-table th.is-sortable {
  cursor: pointer;
  user-select: none;
}

.li-table th.is-sortable:hover {
  color: var(--color-text);
}

.li-table tbody tr {
  transition: background var(--dur-quick);
}

.li-table tbody tr:hover {
  background: var(--color-hover);
}

.li-table tbody tr:last-child td {
  border-bottom: none;
}

.li-table-th-content {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.li-table-sort-icon {
  display: inline-flex;
  align-items: center;
  color: var(--color-text-muted);
}

.li-table-sort-icon :deep(.li-icon) {
  transition: transform var(--dur-short) var(--ease-spring);
}

.li-table th.is-sortable:hover .li-table-sort-icon {
  color: var(--color-text);
}

.li-table-select-col {
  width: 40px;
  text-align: center;
}

.text-left { text-align: left; }
.text-center { text-align: center; }
.text-right { text-align: right; }

.li-table-loading, .li-table-empty {
  text-align: center;
  padding: 32px 12px;
  color: var(--color-text-muted);
}
</style>
