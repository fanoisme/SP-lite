<template>
  <section class="dddash">
    <header class="dddash__head">
      <h1 class="dddash__title">Dashboard</h1>
      <p class="dddash__sub">Discount data across {{ dbCount }} database(s).</p>
    </header>

    <div class="dddash__grid">
      <article v-for="t in tables" :key="t.id" class="dddash__card">
        <p class="dddash__card-label">{{ t.label }}</p>
        <p class="dddash__card-value">
          <template v-if="counts[t.id] != null">{{ counts[t.id] }}</template>
          <span v-else class="dddash__dash">—</span>
        </p>
        <p class="dddash__card-meta">{{ t.targetDb }}.{{ t.targetTable }}</p>
      </article>
    </div>

    <p class="dddash__note">
      Reminders, expiring promos, rows needing attention and per-BU coverage
      arrive in Phase 3.
    </p>
  </section>
</template>

<script setup>
import { computed, onMounted } from 'vue'
import { useDdAccess } from '../composables/useDdAccess.js'
import { useDdTableCounts } from '../composables/useDdTableCounts.js'
import { DD_TABLES } from '../lib/schema.js'

const { canTable, visibleDatabases } = useDdAccess()
const { counts, load } = useDdTableCounts()

// Only count what this person may read, on either axis.
const tables = computed(() =>
  Object.values(DD_TABLES).filter(t => canTable(t.id)),
)
const dbCount = computed(() =>
  new Set(tables.value.map(t => t.targetDb)).size || visibleDatabases.value.length,
)

onMounted(() => {
  if (tables.value.length) load(tables.value.map(t => t.id))
})
</script>

<style scoped>
.dddash { display: flex; flex-direction: column; gap: var(--space-lg, 24px); }
.dddash__title { font-size: 24px; font-weight: 800; margin: 0; letter-spacing: -0.4px; }
.dddash__sub { font-size: 14px; color: var(--color-gray-500, #8e8ea0); margin: 2px 0 0; }
.dddash__grid {
  display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: var(--space-md, 16px);
}
.dddash__card {
  background: rgba(255, 255, 255, 0.6);
  border: 1px solid rgba(0, 0, 0, 0.06);
  border-radius: var(--radius-md, 16px);
  padding: 18px 20px;
}
.dddash__card-label { font-size: 12px; font-weight: 600; color: var(--color-gray-500, #8e8ea0); margin: 0; }
.dddash__card-value {
  font-size: 30px; font-weight: 800; margin: 6px 0 0;
  font-variant-numeric: tabular-nums; letter-spacing: -1px;
}
.dddash__dash { color: var(--color-gray-400, #aaa); font-weight: 400; }
.dddash__card-meta {
  font-family: var(--font-mono, ui-monospace, monospace);
  font-size: 11px; color: var(--color-gray-400, #aaa); margin: 4px 0 0;
}
.dddash__note { font-size: 13px; color: var(--color-gray-400, #aaa); margin: 0; }
</style>
