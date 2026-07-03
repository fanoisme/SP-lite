<template>
  <div class="import-tab">
    <!-- Full name guard -->
    <LiBanner v-if="importCtx.fullNameMissing.value" variant="warning" icon="warning" class="import-tab__banner">
      Please set your full name in <router-link to="/profile">Profile</router-link> before importing.
    </LiBanner>

    <!-- Drop zone -->
    <LiUpload
      v-model="files"
      accept=".xlsx,.xls"
      hint=".xlsx or .xls files only"
      @change="onFileSelected"
    />

    <!-- Loading state -->
    <div v-if="parsing" class="import-tab__loading">
      <span class="material-symbols-outlined import-tab__spinner">progress_activity</span>
      Parsing file...
    </div>

    <!-- No data -->
    <LiEmptyState
      v-else-if="sheets && sheets.length === 0"
      icon="description"
      title="No data found"
      description="The file doesn't contain any recognized sheets (discount_bu_accounts, merchant_whitelist, promo_rule)."
    />

    <!-- Sheet Preview Cards -->
    <template v-else-if="sheets && sheets.length > 0">
      <div class="import-tab__cards">
        <div
          v-for="sheet in sheets"
          :key="sheet.name"
          class="import-tab__card"
          :class="{ 'import-tab__card--expanded': expandedSheet === sheet.name, 'import-tab__card--has-errors': sheet.errors.length > 0 }"
          @click="expandedSheet = expandedSheet === sheet.name ? null : sheet.name"
        >
          <div class="import-tab__card-header">
            <span class="import-tab__card-icon">
              <span class="material-symbols-outlined">
                {{ sheet.config.table === 'bu' ? 'account_balance' : sheet.config.table === 'mw' ? 'store' : 'percent' }}
              </span>
            </span>
            <div class="import-tab__card-info">
              <div class="import-tab__card-title">{{ sheetNameLabel(sheet.name) }}</div>
              <div class="import-tab__card-count">{{ sheet.rows.length }} rows</div>
            </div>
            <div class="import-tab__card-stats">
              <span v-if="sheet.summary.newCount != null" class="import-tab__stat import-tab__stat--new" title="New">&#10003; {{ sheet.summary.newCount }}</span>
              <span v-if="sheet.summary.updateCount != null && sheet.summary.updateCount > 0" class="import-tab__stat import-tab__stat--update" title="Update">&#8635; {{ sheet.summary.updateCount }}</span>
              <span v-if="sheet.errors.length > 0" class="import-tab__stat import-tab__stat--error" title="Errors">&#10007; {{ sheet.errors.length }}</span>
            </div>
            <span class="material-symbols-outlined import-tab__chevron">{{ expandedSheet === sheet.name ? 'expand_less' : 'expand_more' }}</span>
          </div>

          <!-- Expanded preview -->
          <div v-if="expandedSheet === sheet.name" class="import-tab__card-body">
            <!-- Error list -->
            <div v-if="sheet.errors.length > 0" class="import-tab__error-list">
              <div v-for="(err, i) in sheet.errors.slice(0, 50)" :key="i" class="import-tab__error-item">
                <span class="material-symbols-outlined import-tab__error-icon">error</span>
                Row {{ err.row }}: {{ err.error }}
              </div>
              <div v-if="sheet.errors.length > 50" class="import-tab__error-more">
                ...and {{ sheet.errors.length - 50 }} more errors
              </div>
            </div>
            <!-- Preview table (first 5 rows) -->
            <div class="import-tab__preview-wrap">
              <table class="import-tab__preview-table">
                <thead>
                  <tr>
                    <th v-for="h in sheet.config.headers" :key="h">{{ h }}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(row, ri) in sheet.rows.slice(0, 5)" :key="ri">
                    <td v-for="h in sheet.config.headers" :key="h">{{ row[h] ?? '—' }}</td>
                  </tr>
                </tbody>
              </table>
              <div v-if="sheet.rows.length > 5" class="import-tab__preview-more">
                ...and {{ sheet.rows.length - 5 }} more rows
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Import button + progress -->
      <div class="import-tab__actions">
        <button
          class="import-tab__import-btn"
          :disabled="!canImport || importing"
          @click="onImport"
        >
          <span v-if="importing" class="import-tab__btn-spinner"></span>
          {{ importing ? 'Importing...' : 'Import All' }}
        </button>
      </div>

      <LiProgress
        v-if="importing"
        :value="importCtx.progress.value"
        :max="importCtx.progressTotal.value"
        class="import-tab__progress"
      />
    </template>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useImport } from '../composables/useImport.js'
import { useToast } from '@/lib/composables/useToast.js'
import LiUpload from '@lib/components/LiUpload.vue'
import LiBanner from '@lib/components/LiBanner.vue'
import LiEmptyState from '@lib/components/LiEmptyState.vue'
import LiProgress from '@lib/components/LiProgress.vue'

const importCtx = useImport()
const toast = useToast()

const files = ref([])
const sheets = ref(null)
const parsing = ref(false)
const importing = ref(false)
const expandedSheet = ref(null)

const canImport = computed(() => {
  if (importCtx.fullNameMissing.value) return false
  if (!sheets.value) return false
  return sheets.value.some(s => s.rows.length > 0 && s.errors.length === 0)
})

function sheetNameLabel(name) {
  const map = {
    discount_bu_accounts: 'BU Accounts',
    merchant_whitelist: 'Merchant Whitelist',
    promo_rule: 'Promo Rules',
  }
  return map[name] || name
}

async function onFileSelected(newFiles) {
  if (!newFiles.length) return
  sheets.value = null
  expandedSheet.value = null
  parsing.value = true
  try {
    const result = await importCtx.parseFile(newFiles[0])
    sheets.value = result.sheets
  } catch (e) {
    toast.error('Failed to parse file: ' + e.message)
  } finally {
    parsing.value = false
  }
}

async function onImport() {
  if (!canImport.value) return
  importing.value = true
  try {
    await importCtx.runImport(sheets.value)
  } finally {
    importing.value = false
  }
}
</script>

<style scoped>
.import-tab {
  display: flex;
  flex-direction: column;
  gap: var(--space-lg, 24px);
}

.import-tab__banner {
  margin-bottom: 0;
}

.import-tab__loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-s, 8px);
  padding: var(--space-2xl, 32px);
  color: var(--color-gray-500, #999);
  font-size: 14px;
}

.import-tab__spinner {
  animation: spin 800ms linear infinite;
  font-size: 20px;
}

@keyframes spin { to { transform: rotate(360deg); } }

/* Cards grid */
.import-tab__cards {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-md, 16px);
}

.import-tab__card {
  background: rgba(255,255,255,0.7);
  border: 1px solid rgba(0,0,0,0.06);
  border-radius: var(--radius-md, 16px);
  overflow: hidden;
  cursor: pointer;
  transition: border-color 200ms ease-out, box-shadow 200ms ease-out;
}

.import-tab__card:hover {
  border-color: rgba(0,0,0,0.12);
  box-shadow: 0 2px 12px rgba(0,0,0,0.04);
}

.import-tab__card--has-errors {
  border-color: rgba(200,62,59,0.3);
}

.import-tab__card--expanded {
  grid-row: span 2;
}

.import-tab__card-header {
  display: flex;
  align-items: center;
  gap: var(--space-m, 12px);
  padding: var(--space-l, 16px);
}

.import-tab__card-icon {
  width: 40px; height: 40px;
  display: flex; align-items: center; justify-content: center;
  background: linear-gradient(135deg, #6366F1, #8B5CF6);
  border-radius: var(--radius-sm, 12px);
  flex-shrink: 0;
}
.import-tab__card-icon .material-symbols-outlined { font-size: 20px; color: #fff; }

.import-tab__card-info { flex: 1; min-width: 0; }
.import-tab__card-title { font-size: 14px; font-weight: 600; color: var(--color-on-surface, #333); }
.import-tab__card-count { font-size: 12px; color: var(--color-gray-500, #999); }

.import-tab__card-stats {
  display: flex; gap: 4px; flex-shrink: 0;
}

.import-tab__stat {
  display: inline-block; padding: 2px 6px; border-radius: 4px;
  font-size: 10px; font-weight: 700;
}
.import-tab__stat--new { background: #E6F4EA; color: #137333; }
.import-tab__stat--update { background: #E6E6FF; color: #0047B2; }
.import-tab__stat--error { background: #FDECEE; color: #A33129; }

.import-tab__chevron {
  font-size: 20px; color: var(--color-gray-400, #B3B3B3);
  flex-shrink: 0; transition: transform 200ms ease-out;
}

.import-tab__card-body {
  padding: 0 var(--space-l, 16px) var(--space-l, 16px);
  display: flex; flex-direction: column; gap: var(--space-m, 12px);
}

.import-tab__error-list {
  max-height: 200px; overflow-y: auto;
  display: flex; flex-direction: column; gap: 4px;
}

.import-tab__error-item {
  display: flex; align-items: flex-start; gap: 4px;
  font-size: 12px; color: #A33129; line-height: 1.5;
}

.import-tab__error-icon { font-size: 16px; flex-shrink: 0; margin-top: 1px; }

.import-tab__error-more {
  font-size: 12px; color: var(--color-gray-500, #999); font-style: italic;
}

.import-tab__preview-wrap { overflow-x: auto; }

.import-tab__preview-table {
  width: 100%; border-collapse: collapse;
  font-size: 11px;
}

.import-tab__preview-table th {
  text-align: left; padding: 6px 8px;
  background: var(--color-gray-100, #F2F2F2);
  color: var(--color-gray-700, #666);
  font-weight: 600; white-space: nowrap;
  border-bottom: 1px solid rgba(0,0,0,0.08);
}

.import-tab__preview-table td {
  padding: 4px 8px; white-space: nowrap;
  overflow: hidden; text-overflow: ellipsis; max-width: 160px;
  color: var(--color-gray-800, #4D4D4D);
}

.import-tab__preview-more {
  text-align: center; font-size: 12px; color: var(--color-gray-500, #999);
  padding: var(--space-s, 8px);
}

.import-tab__actions {
  display: flex; justify-content: center;
}

.import-tab__import-btn {
  display: flex; align-items: center; gap: 8px;
  padding: 12px 32px;
  background: linear-gradient(135deg, #6366F1, #8B5CF6);
  color: #fff; border: none;
  border-radius: var(--radius-pill, 999px);
  font-family: var(--font-body, 'Inter', sans-serif);
  font-weight: 700; font-size: 15px;
  cursor: pointer; transition: all 200ms ease-out;
  box-shadow: 0 4px 16px rgba(99, 102, 241, 0.3);
}

.import-tab__import-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 6px 24px rgba(99, 102, 241, 0.4);
}

.import-tab__import-btn:disabled {
  opacity: 0.5; cursor: not-allowed;
}

.import-tab__btn-spinner {
  display: inline-block; width: 16px; height: 16px;
  border: 2px solid rgba(255,255,255,0.3);
  border-top-color: #fff; border-radius: 50%;
  animation: spin 800ms linear infinite;
}

.import-tab__progress {
  width: 100%;
}

/* ── Responsive ── */
@media (max-width: 768px) {
  .import-tab__cards {
    grid-template-columns: 1fr;
  }

  .import-tab__card--expanded {
    grid-row: auto;
  }
}

@media (max-width: 480px) {
  .import-tab {
    gap: var(--space-md, 16px);
  }

  .import-tab__import-btn {
    width: 100%;
    justify-content: center;
  }
}
</style>
