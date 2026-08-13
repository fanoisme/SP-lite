<template>
  <DdPlaceholder
    :title="label"
    phase="Phase 5"
    icon="table_rows"
    note="The raw table browser with inline editing arrives with the SQL editor."
  />
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import DdPlaceholder from '../components/DdPlaceholder.vue'
import { byTargetTable } from '../lib/schema.js'

const route = useRoute()
// The route carries the downstream table name, so show that rather than the
// local qrdd_* name — it is what the sidebar listed and what the person clicked.
const label = computed(() => {
  const name = String(route.params.name || '')
  return byTargetTable(name)?.targetTable ?? name
})
</script>
