<template>
  <nav class="ddnav">
    <header class="ddnav__brand">
      <div class="ddnav__mark">
        <span class="material-symbols-outlined">inventory</span>
      </div>
      <div class="ddnav__id">
        <span class="ddnav__name">DD MPM</span>
        <span class="ddnav__sub">Discount data management</span>
      </div>
    </header>

    <div class="ddnav__scroll">
      <template v-if="canDashboard()">
        <p class="ddnav__label">Overview</p>
        <RouterLink :to="{ name: 'dd' }" custom v-slot="{ isActive, navigate }">
          <button class="ddnav__item" :class="{ 'ddnav__item--active': isActive }" @click="navigate">
            <span class="material-symbols-outlined">dashboard</span>
            <span class="ddnav__text">Dashboard</span>
          </button>
        </RouterLink>
      </template>

      <template v-if="visibleManage.length">
        <p class="ddnav__label">Manage</p>
        <RouterLink
          v-for="item in visibleManage" :key="item.name"
          :to="{ name: item.name }" custom v-slot="{ isActive, navigate }"
        >
          <button class="ddnav__item" :class="{ 'ddnav__item--active': isActive }" @click="navigate">
            <span class="material-symbols-outlined">{{ item.icon }}</span>
            <span class="ddnav__text">{{ item.label }}</span>
          </button>
        </RouterLink>
      </template>

      <template v-if="visibleDatabases.length">
        <div class="ddnav__labelrow">
          <p class="ddnav__label">Databases</p>
          <button
            class="ddnav__icobtn" :class="{ 'ddnav__icobtn--spin': reloading }"
            aria-label="Reload row counts" @click="reload"
          >
            <span class="material-symbols-outlined">refresh</span>
          </button>
        </div>
        <div v-for="db in visibleDatabases" :key="db" class="ddnav__dbgroup">
          <p class="ddnav__dbname">
            <span class="material-symbols-outlined">dns</span>
            {{ db }}
          </p>
          <RouterLink
            v-for="t in tablesOf(db)" :key="t.id"
            :to="{ name: 'dd-table', params: { name: t.targetTable } }"
            custom v-slot="{ isActive, navigate }"
          >
            <button
              class="ddnav__item ddnav__item--nested"
              :class="{ 'ddnav__item--active': isActive }" @click="navigate"
            >
              <span class="material-symbols-outlined">table_rows</span>
              <span class="ddnav__text ddnav__text--mono">{{ t.targetTable }}</span>
              <span v-if="counts[t.id] != null" class="ddnav__count">{{ counts[t.id] }}</span>
            </button>
          </RouterLink>
        </div>
      </template>

      <template v-if="visibleTools.length">
        <p class="ddnav__label">Tools</p>
        <RouterLink
          v-for="item in visibleTools" :key="item.name"
          :to="{ name: item.name }" custom v-slot="{ isActive, navigate }"
        >
          <button class="ddnav__item" :class="{ 'ddnav__item--active': isActive }" @click="navigate">
            <span class="material-symbols-outlined">{{ item.icon }}</span>
            <span class="ddnav__text">{{ item.label }}</span>
          </button>
        </RouterLink>
      </template>
    </div>

    <footer class="ddnav__foot">
      <span v-if="role" class="ddnav__role">{{ role }}</span>
      <span v-if="isReadOnly" class="ddnav__ro">read only</span>
    </footer>
  </nav>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import { useAuth } from '@/composables/useAuth.js'
import { useDdAccess } from '../composables/useDdAccess.js'
import { useDdTableCounts } from '../composables/useDdTableCounts.js'
import { DD_TABLES } from '../lib/schema.js'

const { profile } = useAuth()
const { canMenu, canDashboard, visibleDatabases, isReadOnly } = useDdAccess()
const { counts, load } = useDdTableCounts()

const role = computed(() => profile.value?.role || '')
const reloading = ref(false)

// Group order matches the DD app's sidebar.
const manageNav = [
  { name: 'dd-business-units', label: 'Business Units', icon: 'account_balance', menu: 'bu-accounts' },
  { name: 'dd-merchants',      label: 'Merchants',      icon: 'storefront',      menu: 'merchants' },
  { name: 'dd-promos',         label: 'Promos',         icon: 'sell',            menu: 'promos' },
]

const toolsNav = [
  { name: 'dd-export', label: 'Export',     icon: 'ios_share', menu: 'export' },
  { name: 'dd-audit',  label: 'Audit Log',  icon: 'history',   menu: 'audit' },
  { name: 'dd-sql',    label: 'SQL Editor', icon: 'terminal',  menu: 'sql' },
]

const visibleManage = computed(() => manageNav.filter(i => canMenu(i.menu)))
const visibleTools = computed(() => toolsNav.filter(i => canMenu(i.menu)))

// Tables shown under a database use their downstream name — the sidebar is a
// view of the target schema, which is what the reader is reasoning about.
function tablesOf(db) {
  return Object.values(DD_TABLES).filter(t => t.targetDb === db)
}

const grantedTableIds = computed(() =>
  visibleDatabases.value.flatMap(db => tablesOf(db).map(t => t.id)),
)

async function reload() {
  reloading.value = true
  try {
    await load(grantedTableIds.value)
  } finally {
    setTimeout(() => { reloading.value = false }, 600)
  }
}

onMounted(() => {
  if (grantedTableIds.value.length) load(grantedTableIds.value)
})
</script>

<style scoped>
.ddnav {
  display: flex; flex-direction: column;
  width: 240px; flex-shrink: 0;
  background: rgba(255, 255, 255, 0.55);
  backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(0, 0, 0, 0.06);
  border-radius: var(--radius-md, 16px);
  padding: 14px 10px 10px;
  align-self: flex-start;
  max-height: calc(100vh - 96px);
}

.ddnav__brand { display: flex; align-items: center; gap: 10px; padding: 0 6px 12px; }
.ddnav__mark {
  width: 34px; height: 34px; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  background: linear-gradient(135deg, #6366F1, #8B5CF6);
  border-radius: var(--radius-sm, 10px);
}
.ddnav__mark .material-symbols-outlined { font-size: 19px; color: #fff; }
.ddnav__id { display: flex; flex-direction: column; min-width: 0; }
.ddnav__name { font-size: 14px; font-weight: 800; letter-spacing: -0.2px; }
.ddnav__sub { font-size: 11px; color: var(--color-gray-400, #aaa); }

.ddnav__scroll { overflow-y: auto; flex: 1; min-height: 0; }

.ddnav__label {
  font-size: 10px; font-weight: 700; letter-spacing: 0.7px; text-transform: uppercase;
  color: var(--color-gray-400, #aaa); margin: 14px 0 5px; padding: 0 6px;
}
.ddnav__labelrow { display: flex; align-items: center; justify-content: space-between; }
.ddnav__labelrow .ddnav__label { margin-bottom: 5px; }
.ddnav__icobtn {
  border: none; background: transparent; cursor: pointer; padding: 2px 6px;
  color: var(--color-gray-400, #aaa); display: flex; align-items: center;
}
.ddnav__icobtn .material-symbols-outlined { font-size: 16px; }
.ddnav__icobtn:hover { color: var(--color-gray-700, #555); }
.ddnav__icobtn--spin .material-symbols-outlined { animation: ddspin 600ms linear infinite; }
@keyframes ddspin { to { transform: rotate(360deg); } }

.ddnav__item {
  width: 100%; display: flex; align-items: center; gap: 9px;
  padding: 8px 8px; border: none; background: transparent;
  border-radius: var(--radius-sm, 10px); cursor: pointer;
  font-family: var(--font-body, 'Inter', sans-serif); text-align: left;
  color: var(--color-gray-700, #555); transition: background 160ms, color 160ms;
}
.ddnav__item .material-symbols-outlined { font-size: 18px; flex-shrink: 0; }
.ddnav__item:hover { background: rgba(0, 0, 0, 0.04); }
.ddnav__item--active { background: #fff; color: var(--color-on-surface, #1a1a2e); font-weight: 600; }
.ddnav__item--active .material-symbols-outlined { color: #6366F1; }
.ddnav__item--nested { padding-left: 16px; }

.ddnav__text {
  font-size: 13px; flex: 1; min-width: 0;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.ddnav__text--mono { font-family: var(--font-mono, ui-monospace, monospace); font-size: 12px; }
.ddnav__count {
  font-size: 10px; font-variant-numeric: tabular-nums;
  background: rgba(0, 0, 0, 0.06); color: var(--color-gray-700, #555);
  border-radius: 999px; padding: 1px 6px; flex-shrink: 0;
}

.ddnav__dbgroup { margin-bottom: 6px; }
.ddnav__dbname {
  display: flex; align-items: center; gap: 6px; margin: 4px 0 2px; padding: 0 6px;
  font-family: var(--font-mono, ui-monospace, monospace);
  font-size: 11px; color: var(--color-gray-500, #8e8ea0);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.ddnav__dbname .material-symbols-outlined { font-size: 14px; }

.ddnav__foot {
  display: flex; align-items: center; gap: 6px;
  padding: 10px 6px 0; margin-top: 6px;
  border-top: 1px solid rgba(0, 0, 0, 0.06);
}
.ddnav__role, .ddnav__ro {
  font-size: 10px; letter-spacing: 0.3px; border-radius: 999px; padding: 2px 8px;
}
.ddnav__role { background: rgba(99, 102, 241, 0.1); color: #6366F1; font-weight: 600; }
.ddnav__ro { background: rgba(0, 0, 0, 0.05); color: var(--color-gray-500, #8e8ea0); }

@media (max-width: 900px) {
  .ddnav { width: 100%; max-height: none; align-self: stretch; }
  .ddnav__scroll { max-height: 320px; }
}
</style>
