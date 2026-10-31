<template>
  <nav class="ddnav" :class="{ 'ddnav--collapsed': collapsed }" @click="$emit('navigate')">
    <header class="ddnav__brand">
      <div class="ddnav__mark">
        <LiIcon name="boxes" />
      </div>
      <div class="ddnav__id">
        <span class="ddnav__name">DD MPM</span>
        <span class="ddnav__sub">Discount data management</span>
      </div>
    </header>

    <div class="ddnav__scroll">
      <template v-if="canDashboard()">
        <p class="ddnav__label">Overview</p>
        <!-- isExactActive, not isActive: /dd is an ancestor of every child
             route, so an inclusive match would keep Dashboard highlighted on
             every DD screen. -->
        <RouterLink :to="{ name: 'dd' }" custom v-slot="{ isExactActive, navigate }">
          <button class="ddnav__item" :class="{ 'ddnav__item--active': isExactActive }" :aria-current="isExactActive ? 'page' : undefined" @click="navigate">
            <LiIcon name="layout-dashboard" />
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
          <button class="ddnav__item" :class="{ 'ddnav__item--active': isActive }" :aria-current="isActive ? 'page' : undefined" @click="navigate">
            <LiIcon :name="item.icon" />
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
            <LiIcon name="rotate-cw" />
          </button>
        </div>
        <div v-for="db in visibleDatabases" :key="db" class="ddnav__dbgroup">
          <p class="ddnav__dbname">
            <LiIcon name="server" />
            {{ db }}
          </p>
          <RouterLink
            v-for="t in tablesOf(db)" :key="t.id"
            :to="{ name: 'dd-table', params: { name: t.targetTable } }"
            custom v-slot="{ isActive, navigate }"
          >
            <button
              class="ddnav__item ddnav__item--nested"
              :class="{ 'ddnav__item--active': isActive }"
              :aria-current="isActive ? 'page' : undefined"
              @click="navigate"
            >
              <LiIcon name="rows-3" />
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
          <button class="ddnav__item" :class="{ 'ddnav__item--active': isActive }" :aria-current="isActive ? 'page' : undefined" @click="navigate">
            <LiIcon :name="item.icon" />
            <span class="ddnav__text">{{ item.label }}</span>
          </button>
        </RouterLink>
      </template>

      <template v-if="visibleAdmin.length">
        <p class="ddnav__label">Admin</p>
        <RouterLink
          v-for="item in visibleAdmin" :key="item.name"
          :to="{ name: item.name }" custom v-slot="{ isActive, navigate }"
        >
          <button class="ddnav__item" :class="{ 'ddnav__item--active': isActive }" :aria-current="isActive ? 'page' : undefined" @click="navigate">
            <LiIcon :name="item.icon" />
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

defineProps({
  collapsed: { type: Boolean, default: false },
})
defineEmits(['navigate'])

const { profile } = useAuth()
const { canMenu, canDashboard, visibleDatabases, isReadOnly } = useDdAccess()
const { counts, load } = useDdTableCounts()

const role = computed(() => profile.value?.role || '')
const reloading = ref(false)

// Group order matches the DD app's sidebar.
const manageNav = [
  { name: 'dd-business-units', label: 'Business Units', icon: 'landmark', menu: 'bu-accounts' },
  { name: 'dd-merchants',      label: 'Merchants',      icon: 'store',      menu: 'merchants' },
  { name: 'dd-promos',         label: 'Promos',         icon: 'tag',            menu: 'promos' },
]

const toolsNav = [
  { name: 'dd-export', label: 'Export',     icon: 'share', menu: 'export' },
  { name: 'dd-audit',  label: 'Audit Log',  icon: 'history',   menu: 'audit' },
  { name: 'dd-sql',    label: 'SQL Editor', icon: 'terminal',  menu: 'sql' },
]

const adminNav = [
  { name: 'dd-email', label: 'Email Settings', icon: 'mail', menu: 'email' },
]

const visibleManage = computed(() => manageNav.filter(i => canMenu(i.menu)))
const visibleTools = computed(() => toolsNav.filter(i => canMenu(i.menu)))
const visibleAdmin = computed(() => adminNav.filter(i => canMenu(i.menu)))

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
/* Allo project nav (board.html sidebar): surface fill, selected = warm tint
   + 3px accent bar, 248 expanded / 56 collapsed. */
.ddnav {
  display: flex;
  flex-direction: column;
  width: 248px;
  flex-shrink: 0;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--space-3) var(--space-2) var(--space-2);
  overflow: hidden;
  transition: width var(--dur-short) var(--ease-move);
}

.ddnav--collapsed { width: 56px; }

.ddnav__brand { display: flex; align-items: center; gap: var(--space-2); padding: 0 var(--space-1) var(--space-3); }
.ddnav__mark {
  width: 32px; height: 32px; flex-shrink: 0;
  display: grid; place-items: center;
  background: var(--color-accent);
  color: var(--color-on-accent);
  border-radius: var(--radius-sm);
}
.ddnav__mark :deep(.li-icon) { font-size: 16px; }
.ddnav__id { display: flex; flex-direction: column; min-width: 0; }
.ddnav__name { font-size: var(--text-sm); font-weight: 700; color: var(--color-text-strong); }
.ddnav__sub { font-size: var(--text-xs); color: var(--color-text-muted); }

.ddnav--collapsed .ddnav__id,
.ddnav--collapsed .ddnav__label,
.ddnav--collapsed .ddnav__text,
.ddnav--collapsed .ddnav__count,
.ddnav--collapsed .ddnav__dbname,
.ddnav--collapsed .ddnav__foot,
.ddnav--collapsed .ddnav__labelrow { display: none; }

.ddnav__scroll { overflow-y: auto; overflow-x: hidden; flex: 1; min-height: 0; }

.ddnav__label {
  font-size: var(--text-micro); font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase;
  color: var(--color-text-muted); margin: var(--space-3) 0 var(--space-1); padding: 0 var(--space-2);
  white-space: nowrap;
}
.ddnav__labelrow { display: flex; align-items: center; justify-content: space-between; }
.ddnav__labelrow .ddnav__label { margin-bottom: var(--space-1); }
.ddnav__icobtn {
  border: none; background: transparent; cursor: pointer; padding: 2px var(--space-2);
  color: var(--color-text-muted); display: flex; align-items: center;
  border-radius: var(--radius-xs);
}
.ddnav__icobtn :deep(.li-icon) { font-size: 14px; }
.ddnav__icobtn:hover { color: var(--color-text-strong); background: var(--color-hover); }
.ddnav__icobtn:focus-visible { outline: 2px solid var(--color-focus); outline-offset: 1px; }
.ddnav__icobtn--spin :deep(.li-icon) { animation: ddspin 600ms linear infinite; }
@keyframes ddspin { to { transform: rotate(360deg); } }

.ddnav__item {
  position: relative;
  width: 100%; display: flex; align-items: center; gap: var(--space-2);
  height: 32px; padding: 0 var(--space-2); border: none; background: transparent;
  border-radius: var(--radius-sm); cursor: pointer;
  font: inherit; text-align: left;
  color: var(--color-text-muted);
  transition: background var(--dur-quick), color var(--dur-quick);
}
.ddnav__item :deep(.li-icon) { font-size: 16px; flex-shrink: 0; }
.ddnav__item:hover { background: var(--color-hover); color: var(--color-text); }
.ddnav__item:focus-visible { outline: 2px solid var(--color-focus); outline-offset: -2px; }

/* Selected: warm tint + 3px accent bar, never colour alone (APP.md rule 3) */
.ddnav__item--active {
  background: var(--color-selected);
  color: var(--color-text-strong);
  font-weight: 700;
  box-shadow: inset 3px 0 0 var(--color-accent-strong);
}
.ddnav__item--active :deep(.li-icon) { color: var(--color-accent-text); }
.ddnav__item--nested { padding-left: var(--space-4); }

.ddnav__text {
  font-size: var(--text-sm); flex: 1; min-width: 0;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.ddnav__text--mono { font-family: var(--font-mono); font-size: var(--text-xs); }
.ddnav__count {
  font-size: var(--text-micro); font-variant-numeric: tabular-nums;
  background: var(--color-neutral-soft); color: var(--color-text);
  border-radius: var(--radius-pill); padding: 1px 6px; flex-shrink: 0;
}

.ddnav__dbgroup { margin-bottom: var(--space-1); }
.ddnav__dbname {
  display: flex; align-items: center; gap: 6px; margin: var(--space-1) 0 2px; padding: 0 var(--space-2);
  font-family: var(--font-mono);
  font-size: var(--text-xs); color: var(--color-text-muted);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.ddnav__dbname :deep(.li-icon) { font-size: 14px; }

.ddnav__foot {
  display: flex; align-items: center; gap: var(--space-1);
  padding: var(--space-2) var(--space-1) 0; margin-top: var(--space-2);
  border-top: 1px solid var(--color-border);
}
.ddnav__role, .ddnav__ro {
  font-size: var(--text-micro); letter-spacing: 0.03em; border-radius: var(--radius-pill); padding: 2px var(--space-2);
}
.ddnav__role { background: var(--color-accent-soft); color: var(--color-accent-text); font-weight: 600; }
.ddnav__ro { background: var(--color-neutral-soft); color: var(--color-text-muted); }

@media (max-width: 900px) {
  .ddnav { width: 100%; }
  .ddnav__scroll { max-height: 60vh; }
}
</style>
