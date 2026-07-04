<template>
  <div class="qrdd">
    <!-- Header -->
    <header class="qrdd__header">
      <div class="qrdd__header-content">
        <div class="qrdd__title-group">
          <div class="qrdd__icon-badge">
            <span class="material-symbols-outlined">database</span>
          </div>
          <div>
            <h1 class="qrdd__title">QR DD</h1>
            <p class="qrdd__subtitle">Manage BU accounts, merchant whitelist, and promo rules</p>
          </div>
        </div>
      </div>
    </header>

    <!-- Pill Tabs -->
    <nav class="qrdd__tabs-wrapper">
      <div class="qrdd__tabs">
        <button
          v-for="(tab, index) in visibleTabs"
          :key="tab.id"
          class="qrdd__tab"
          :class="{ 'qrdd__tab--active': activeTab === tab.id }"
          @click="switchTab(tab.id, index)"
        >
          <span class="material-symbols-outlined qrdd__tab-icon">{{ tab.icon }}</span>
          <span class="qrdd__tab-label">{{ tab.label }}</span>
          <span class="qrdd__tab-desc">{{ tab.desc }}</span>
        </button>
        <div class="qrdd__tab-indicator" :style="indicatorStyle" />
      </div>
    </nav>

    <!-- Tab Content -->
    <Transition name="panel-slide" mode="out-in">
      <div :key="activeTab" class="qrdd__panel-wrap">
        <BuAccountsTab
          v-if="activeTab === 'bu-accounts' && can('bu-accounts.read')"
          key="bu"
          :items="buAccounts.paginatedItems.value"
          :loading="buAccounts.loading.value"
          :searchQuery="buAccounts.searchQuery.value"
          :currentPage="buAccounts.currentPage.value"
          :totalPages="buAccounts.totalPages.value"
          :dateFrom="buAccounts.dateFrom.value"
          :dateTo="buAccounts.dateTo.value"
          :canCreate="can('bu-accounts.create')"
          :canUpdate="can('bu-accounts.update')"
          :canDelete="can('bu-accounts.delete')"
          @update:searchQuery="buAccounts.searchQuery.value = $event"
          @update:currentPage="buAccounts.currentPage.value = $event"
          @update:dateFrom="buAccounts.dateFrom.value = $event"
          @update:dateTo="buAccounts.dateTo.value = $event"
          @add="onAddBuAccount"
          @edit="onEditBuAccount"
          @delete="onDeleteBuAccount"
          @export="buAccounts.exportFiltered()"
        />

        <MerchantWhitelistTab
          v-else-if="activeTab === 'merchant-whitelist' && can('merchant-whitelist.read')"
          key="mw"
          :items="mw.paginatedItems.value"
          :loading="mw.loading.value"
          :searchQuery="mw.searchQuery.value"
          :currentPage="mw.currentPage.value"
          :totalPages="mw.totalPages.value"
          :buNameOptions="buAccounts.nameOptions.value"
          :dateFrom="mw.dateFrom.value"
          :dateTo="mw.dateTo.value"
          :canCreate="can('merchant-whitelist.create')"
          :canUpdate="can('merchant-whitelist.update')"
          :canDelete="can('merchant-whitelist.delete')"
          @update:searchQuery="mw.searchQuery.value = $event"
          @update:currentPage="mw.currentPage.value = $event"
          @update:dateFrom="mw.dateFrom.value = $event"
          @update:dateTo="mw.dateTo.value = $event"
          @add="onAddMerchant"
          @edit="onEditMerchant"
          @delete="onDeleteMerchant"
          @export="mw.exportFiltered()"
        />

        <PromoRuleTab
          v-else-if="activeTab === 'promo-rule' && can('promo-rule.read')"
          key="pr"
          :items="pr.paginatedItems.value"
          :loading="pr.loading.value"
          :searchQuery="pr.searchQuery.value"
          :searchColumn="pr.searchColumn.value"
          :currentPage="pr.currentPage.value"
          :totalPages="pr.totalPages.value"
          :merchantOptions="merchantOptions"
          :buNameOptions="buAccounts.nameOptions.value"
          :dateFrom="pr.dateFrom.value"
          :dateTo="pr.dateTo.value"
          :canCreate="can('promo-rule.create')"
          :canUpdate="can('promo-rule.update')"
          :canDelete="can('promo-rule.delete')"
          @update:searchQuery="pr.searchQuery.value = $event"
          @update:searchColumn="pr.searchColumn.value = $event"
          @update:currentPage="pr.currentPage.value = $event"
          @update:dateFrom="pr.dateFrom.value = $event"
          @update:dateTo="pr.dateTo.value = $event"
          @add="onAddPromo"
          @edit="onEditPromo"
          @delete="onDeletePromo"
          @export="pr.exportFiltered()"
        />

        <ImportTab v-else-if="activeTab === 'import' && can('bu-accounts.read')" key="import" />

        <DashboardTab v-else-if="activeTab === 'dashboard'" key="dash" />
      </div>
    </Transition>

    <!-- BU Account Form Modal -->
    <BuAccountForm
      v-if="showBuForm"
      :editing="editingBu"
      @save="onSaveBuAccount"
      @close="closeBuForm"
    />

    <!-- Merchant Form Modal -->
    <MerchantForm
      v-if="showMwForm"
      :editing="editingMw"
      :buNameOptions="buAccounts.nameOptions.value"
      @save="onSaveMerchant"
      @close="closeMwForm"
    />

    <!-- Promo Rule Form Modal -->
    <PromoRuleForm
      v-if="showPrForm"
      :editing="editingPr"
      :merchantOptions="merchantOptions"
      :buNameOptions="buAccounts.nameOptions.value"
      @save="onSavePromo"
      @close="closePrForm"
    />

    <!-- Delete Confirm Modal -->
    <LiModal
      v-if="deleteTarget"
      :modelValue="true"
      title="Confirm Delete"
      size="sm"
      @update:modelValue="deleteTarget = null"
    >
      <p class="qrdd__delete-text">
        Are you sure you want to delete <strong>{{ deleteTarget.label }}</strong>?
        This action cannot be undone.
      </p>
      <template #footer>
        <button class="qrdd__btn qrdd__btn--cancel" @click="deleteTarget = null">Cancel</button>
        <button class="qrdd__btn qrdd__btn--danger" @click="confirmDelete">
          <span class="material-symbols-outlined">delete</span>
          Delete
        </button>
      </template>
    </LiModal>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { useAccess } from '@/composables/useAccess.js'
import { useBuAccounts } from '../composables/useBuAccounts.js'
import { useMerchantWhitelist } from '../composables/useMerchantWhitelist.js'
import { usePromoRule } from '../composables/usePromoRule.js'
import BuAccountsTab from '../components/BuAccountsTab.vue'
import BuAccountForm from '../components/BuAccountForm.vue'
import MerchantWhitelistTab from '../components/MerchantWhitelistTab.vue'
import MerchantForm from '../components/MerchantForm.vue'
import PromoRuleTab from '../components/PromoRuleTab.vue'
import PromoRuleForm from '../components/PromoRuleForm.vue'
import DashboardTab from '../components/DashboardTab.vue'
import ImportTab from '../components/ImportTab.vue'
import LiModal from '@lib/components/LiModal.vue'

const { canFeature } = useAccess()
const buAccounts = useBuAccounts()
const mw = useMerchantWhitelist()
const pr = usePromoRule()

function can(feature) { return canFeature('qrdd', feature) }

// ── Pill Tabs ──

const allTabDefs = [
  { id: 'bu-accounts', label: 'BU Accounts', desc: 'Manage accounts', icon: 'account_balance', gate: 'bu-accounts.read' },
  { id: 'merchant-whitelist', label: 'Merchants', desc: 'Whitelist management', icon: 'store', gate: 'merchant-whitelist.read' },
  { id: 'promo-rule', label: 'Promo Rules', desc: 'Discount rules', icon: 'percent', gate: 'promo-rule.read' },
  { id: 'import', label: 'Import', desc: 'Bulk data import', icon: 'upload', gate: 'bu-accounts.read' },
  { id: 'dashboard', label: 'Dashboard', desc: 'Reports & stats', icon: 'monitoring', gate: null },
]

const visibleTabs = computed(() =>
  allTabDefs.filter(t => !t.gate || can(t.gate))
)

const activeTab = ref(visibleTabs.value[0]?.id)
const indicatorStyle = ref({})

watch(visibleTabs, (list) => {
  if (list.length && !list.find(t => t.id === activeTab.value)) {
    activeTab.value = list[0].id
  }
})

function switchTab(id, index) {
  activeTab.value = id
  nextTick(() => updateIndicator(index))
}

function updateIndicator(targetIndex) {
  const idx = targetIndex ?? visibleTabs.value.findIndex(t => t.id === activeTab.value)
  const tabEl = document.querySelectorAll('.qrdd__tab')[idx]
  if (tabEl) {
    indicatorStyle.value = {
      left: `${tabEl.offsetLeft}px`,
      width: `${tabEl.offsetWidth}px`,
    }
  }
}

// ── Form modals ──

const showBuForm = ref(false)
const editingBu = ref(null)
const showMwForm = ref(false)
const editingMw = ref(null)
const showPrForm = ref(false)
const editingPr = ref(null)

const deleteTarget = ref(null)

const merchantOptions = computed(() =>
  mw.items.value.map(r => ({
    label: `${r.merchant_id} — ${r.merchant_name}`,
    value: r.merchant_id,
  })),
)

// ── Handlers ──

function onAddBuAccount() { editingBu.value = null; showBuForm.value = true }
function onEditBuAccount(row) { editingBu.value = row; showBuForm.value = true }
function onDeleteBuAccount(row) { deleteTarget.value = { type: 'bu', id: row.id, label: row.name } }

function onAddMerchant() { editingMw.value = null; showMwForm.value = true }
function onEditMerchant(row) { editingMw.value = row; showMwForm.value = true }
function onDeleteMerchant(row) { deleteTarget.value = { type: 'mw', id: row.id, label: row.merchant_id } }

function onAddPromo() { editingPr.value = null; showPrForm.value = true }
function onEditPromo(row) { editingPr.value = row; showPrForm.value = true }
function onDeletePromo(row) { deleteTarget.value = { type: 'pr', id: row.promo_id, label: row.promo_id } }

function closeBuForm() { showBuForm.value = false; editingBu.value = null }
function closeMwForm() { showMwForm.value = false; editingMw.value = null }
function closePrForm() { showPrForm.value = false; editingPr.value = null }

async function onSaveBuAccount(formData) {
  const ok = editingBu.value
    ? await buAccounts.updateItem(editingBu.value.id, formData)
    : await buAccounts.createItem(formData)
  if (ok) closeBuForm()
}

async function onSaveMerchant(formData) {
  const ok = editingMw.value
    ? await mw.updateItem(editingMw.value.id, formData)
    : await mw.createItem(formData)
  if (ok) closeMwForm()
}

async function onSavePromo(formData) {
  const ok = editingPr.value
    ? await pr.updateItem(editingPr.value.promo_id, formData)
    : await pr.createItem(formData)
  if (ok) closePrForm()
}

async function confirmDelete() {
  const t = deleteTarget.value
  deleteTarget.value = null
  if (!t) return
  if (t.type === 'bu') await buAccounts.deleteItem(t.id, t.label)
  else if (t.type === 'mw') await mw.deleteItem(t.id, t.label)
  else if (t.type === 'pr') await pr.deleteItem(t.id)
}

// ── Init ──

function onResize() { nextTick(() => updateIndicator()) }

onMounted(() => {
  buAccounts.loadItems()
  mw.loadItems()
  pr.loadItems()
  nextTick(() => updateIndicator())
  window.addEventListener('resize', onResize)
})

onUnmounted(() => {
  window.removeEventListener('resize', onResize)
})
</script>

<style scoped>
.qrdd {
  max-width: 1280px;
  margin: 0 auto;
  padding: var(--space-lg, 24px) var(--space-xl, 32px);
  display: flex;
  flex-direction: column;
  gap: var(--space-lg, 24px);
}

.qrdd__header-content { display: flex; justify-content: space-between; align-items: center; }
.qrdd__title-group { display: flex; align-items: center; gap: var(--space-l, 16px); }
.qrdd__icon-badge {
  width: 48px; height: 48px;
  display: flex; align-items: center; justify-content: center;
  background: linear-gradient(135deg, #6366F1, #8B5CF6);
  border-radius: var(--radius-sm, 12px);
  box-shadow: 0 4px 16px rgba(99, 102, 241, 0.3);
}
.qrdd__icon-badge .material-symbols-outlined { font-size: 26px; color: #fff; }
.qrdd__title { font-size: 26px; font-weight: 800; margin: 0; letter-spacing: -0.5px; }
.qrdd__subtitle { font-size: 14px; color: var(--color-gray-500, #8e8ea0); margin: 2px 0 0; }

/* Pill Tabs */
.qrdd__tabs-wrapper { }
.qrdd__tabs {
  display: flex; position: relative;
  background: rgba(255,255,255,0.5); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(0,0,0,0.06); border-radius: var(--radius-md, 16px);
  padding: 5px; gap: 2px;
}
.qrdd__tab {
  flex: 1; display: flex; flex-direction: column; align-items: center; gap: 2px;
  padding: 14px 12px; border: none; border-radius: var(--radius-sm, 12px);
  background: transparent; cursor: pointer;
  font-family: var(--font-body, 'Inter', sans-serif);
  transition: all 300ms ease-out;
  position: relative; z-index: 1;
}
.qrdd__tab:hover { background: rgba(255,255,255,0.5); }
.qrdd__tab--active { color: var(--color-on-surface, #1a1a2e); }
.qrdd__tab-icon { font-size: 22px; color: var(--color-gray-500, #8e8ea0); transition: color 300ms ease-out, transform 300ms cubic-bezier(0.34, 1.56, 0.64, 1); }
.qrdd__tab--active .qrdd__tab-icon { color: #6366F1; transform: scale(1.1); }
.qrdd__tab-label { font-size: 13px; font-weight: 600; color: var(--color-gray-700, #555); transition: color 300ms ease-out; }
.qrdd__tab--active .qrdd__tab-label { color: var(--color-on-surface, #1a1a2e); }
.qrdd__tab-desc { font-size: 11px; color: var(--color-gray-400, #aaa); font-weight: 400; transition: color 300ms ease-out; }
.qrdd__tab--active .qrdd__tab-desc { color: var(--color-gray-500, #8e8ea0); }
.qrdd__tab-indicator {
  position: absolute; top: 5px; height: calc(100% - 10px);
  background: #fff; border-radius: var(--radius-sm, 12px);
  box-shadow: 0 2px 8px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.02);
  transition: all 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
  z-index: 0;
}

/* Delete */
.qrdd__delete-text { font-size: 14px; color: var(--color-gray-700, #666); line-height: 1.6; margin: 0; }
.qrdd__btn {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 8px 18px; border: 1px solid transparent;
  border-radius: var(--radius-pill, 999px);
  font-family: var(--font-body, 'Inter', sans-serif);
  font-size: 13px; font-weight: 600; cursor: pointer; transition: all 200ms;
}
.qrdd__btn--cancel { color: var(--color-gray-700, #666); border-color: rgba(0,0,0,0.1); background: transparent; }
.qrdd__btn--cancel:hover { background: rgba(0,0,0,0.04); }
.qrdd__btn--danger { color: #fff; background: var(--color-red-400, #C83E3B); border-color: var(--color-red-400, #C83E3B); }
.qrdd__btn--danger:hover { opacity: 0.9; }

.panel-slide-enter-active { transition: all 0.35s cubic-bezier(0.16, 1, 0.3, 1); }
.panel-slide-leave-active { transition: all 0.2s ease-in; }
.panel-slide-enter-from { opacity: 0; transform: translateY(12px); }
.panel-slide-leave-to { opacity: 0; transform: translateY(-8px); }

@media (max-width: 768px) {
  .qrdd { padding: var(--space-md, 16px); gap: var(--space-md, 16px); }
  .qrdd__title { font-size: 20px; }
  .qrdd__icon-badge { width: 40px; height: 40px; }
  .qrdd__icon-badge .material-symbols-outlined { font-size: 22px; }
  .qrdd__tab { padding: 10px 8px; min-width: 0; flex-shrink: 0; }
  .qrdd__tab-desc { display: none; }

  .qrdd__tabs {
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
  }

  .qrdd__tabs::-webkit-scrollbar { display: none; }
}
@media (max-width: 480px) {
  .qrdd__icon-badge { display: none; }
  .qrdd__tab-label { font-size: 12px; }
  .qrdd__tab-icon { font-size: 18px; }
}
@media (prefers-reduced-motion: reduce) {
  .qrdd__tab-indicator { transition: none; }
  .qrdd__tab-icon { transition: none; }
  .panel-slide-enter-active, .panel-slide-leave-active { transition-duration: 0.01ms; }
}
</style>
