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

    <!-- Tabs -->
    <LiTabs v-model="activeTab" :tabs="visibleTabs" />

    <!-- Tab Content -->
    <Transition name="panel-slide" mode="out-in">
      <BuAccountsTab
        v-if="activeTab === tabIndex('bu-accounts.read') && can('bu-accounts.read')"
        key="bu"
        :items="buAccounts.paginatedItems.value"
        :loading="buAccounts.loading.value"
        :searchQuery="buAccounts.searchQuery.value"
        :currentPage="buAccounts.currentPage.value"
        :totalPages="buAccounts.totalPages.value"
        :canCreate="can('bu-accounts.create')"
        :canUpdate="can('bu-accounts.update')"
        :canDelete="can('bu-accounts.delete')"
        @update:searchQuery="buAccounts.searchQuery.value = $event"
        @update:currentPage="buAccounts.currentPage.value = $event"
        @add="onAddBuAccount"
        @edit="onEditBuAccount"
        @delete="onDeleteBuAccount"
      />

      <MerchantWhitelistTab
        v-else-if="activeTab === tabIndex('merchant-whitelist.read') && can('merchant-whitelist.read')"
        key="mw"
        :items="mw.paginatedItems.value"
        :loading="mw.loading.value"
        :searchQuery="mw.searchQuery.value"
        :currentPage="mw.currentPage.value"
        :totalPages="mw.totalPages.value"
        :buNameOptions="buAccounts.nameOptions.value"
        :canCreate="can('merchant-whitelist.create')"
        :canUpdate="can('merchant-whitelist.update')"
        :canDelete="can('merchant-whitelist.delete')"
        @update:searchQuery="mw.searchQuery.value = $event"
        @update:currentPage="mw.currentPage.value = $event"
        @add="onAddMerchant"
        @edit="onEditMerchant"
        @delete="onDeleteMerchant"
      />

      <PromoRuleTab
        v-else-if="activeTab === tabIndex('promo-rule.read') && can('promo-rule.read')"
        key="pr"
        :items="pr.paginatedItems.value"
        :loading="pr.loading.value"
        :searchQuery="pr.searchQuery.value"
        :searchColumn="pr.searchColumn.value"
        :currentPage="pr.currentPage.value"
        :totalPages="pr.totalPages.value"
        :merchantOptions="merchantOptions"
        :buNameOptions="buAccounts.nameOptions.value"
        :canCreate="can('promo-rule.create')"
        :canUpdate="can('promo-rule.update')"
        :canDelete="can('promo-rule.delete')"
        @update:searchQuery="pr.searchQuery.value = $event"
        @update:searchColumn="pr.searchColumn.value = $event"
        @update:currentPage="pr.currentPage.value = $event"
        @add="onAddPromo"
        @edit="onEditPromo"
        @delete="onDeletePromo"
      />
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
import { ref, computed, onMounted } from 'vue'
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
import LiTabs from '@lib/components/LiTabs.vue'
import LiModal from '@lib/components/LiModal.vue'

const { canFeature } = useAccess()
const buAccounts = useBuAccounts()
const mw = useMerchantWhitelist()
const pr = usePromoRule()

function can(feature) { return canFeature('qrdd', feature) }

// Tabs — LiTabs expects { label, icon? } objects. We build the visible list
// and expose a helper that maps a feature key to its position in visibleTabs.
const allTabDefs = [
  { label: 'BU Accounts' },
  { label: 'Merchant Whitelist' },
  { label: 'Promo Rule' },
]
const tabFeatureKeys = ['bu-accounts.read', 'merchant-whitelist.read', 'promo-rule.read']

const visibleTabs = computed(() =>
  allTabDefs.filter((_, i) => can(tabFeatureKeys[i]))
)

// Build a map: featureKey → index in the filtered visibleTabs
const tabIndexMap = computed(() => {
  const map = {}
  let vi = 0
  for (let i = 0; i < tabFeatureKeys.length; i++) {
    if (can(tabFeatureKeys[i])) {
      map[tabFeatureKeys[i]] = vi++
    }
  }
  return map
})

function tabIndex(featureKey) {
  return tabIndexMap.value[featureKey] ?? -1
}

const activeTab = ref(0)

// Form modals
const showBuForm = ref(false)
const editingBu = ref(null)
const showMwForm = ref(false)
const editingMw = ref(null)
const showPrForm = ref(false)
const editingPr = ref(null)

// Delete confirm
const deleteTarget = ref(null)

// Merchant dropdown for PromoRule form
const merchantOptions = computed(() =>
  mw.items.value.map(r => ({
    label: `${r.merchant_id} — ${r.merchant_name}`,
    value: r.merchant_id,
  })),
)

// ── Handlers: BU Accounts ──

function onAddBuAccount() {
  editingBu.value = null
  showBuForm.value = true
}

function onEditBuAccount(row) {
  editingBu.value = row
  showBuForm.value = true
}

function onDeleteBuAccount(row) {
  deleteTarget.value = { type: 'bu', id: row.id, label: row.name }
}

// ── Handlers: Merchant Whitelist ──

function onAddMerchant() {
  editingMw.value = null
  showMwForm.value = true
}

function onEditMerchant(row) {
  editingMw.value = row
  showMwForm.value = true
}

function onDeleteMerchant(row) {
  deleteTarget.value = { type: 'mw', id: row.id, label: row.merchant_id }
}

// ── Handlers: Promo Rule ──

function onAddPromo() {
  editingPr.value = null
  showPrForm.value = true
}

function onEditPromo(row) {
  editingPr.value = row
  showPrForm.value = true
}

function onDeletePromo(row) {
  deleteTarget.value = { type: 'pr', id: row.promo_id, label: row.promo_id }
}

// ── Form save/close ──

function closeBuForm() { showBuForm.value = false; editingBu.value = null }
function closeMwForm() { showMwForm.value = false; editingMw.value = null }
function closePrForm() { showPrForm.value = false; editingPr.value = null }

async function onSaveBuAccount(formData) {
  let ok
  if (editingBu.value) {
    ok = await buAccounts.updateItem(editingBu.value.id, formData)
  } else {
    ok = await buAccounts.createItem(formData)
  }
  if (ok) closeBuForm()
}

async function onSaveMerchant(formData) {
  let ok
  if (editingMw.value) {
    ok = await mw.updateItem(editingMw.value.id, formData)
  } else {
    ok = await mw.createItem(formData)
  }
  if (ok) closeMwForm()
}

async function onSavePromo(formData) {
  let ok
  if (editingPr.value) {
    ok = await pr.updateItem(editingPr.value.promo_id, formData)
  } else {
    ok = await pr.createItem(formData)
  }
  if (ok) closePrForm()
}

// ── Confirm delete ──

async function confirmDelete() {
  const t = deleteTarget.value
  deleteTarget.value = null
  if (!t) return

  if (t.type === 'bu') await buAccounts.deleteItem(t.id, t.label)
  else if (t.type === 'mw') await mw.deleteItem(t.id, t.label)
  else if (t.type === 'pr') await pr.deleteItem(t.id)
}

// ── Init ──

onMounted(() => {
  buAccounts.loadItems()
  mw.loadItems()
  pr.loadItems()
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
</style>
