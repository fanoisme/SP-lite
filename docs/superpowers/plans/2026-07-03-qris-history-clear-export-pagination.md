# QRIS History: Clear, Export, Pagination + Reader Global Paste — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add clear-all, export (CSV/HTML, simple/full), pagination (10/page, 14-day retention only) to QRIS history panel; make clipboard paste work globally on Reader tab without clicking the dropzone.

**Architecture:** Drop the 50-row cap from the backend `insert_qris_history` RPC (keep only 14-day prune). Replace fixed-limit `loadHistory()` with Supabase range-based pagination. Add `clearAllHistory()` (delete user rows via RLS), `exportHistory(format, mode)` (re-query all rows, build CSV/HTML string, download via file-saver). Wire new toolbar (clear button + export dropdown + LiModal confirm), expiry countdown labels, and LiPagination footer into QrisHistory. Move Reader paste listener from element to window.

**Tech Stack:** Vue 3 (Composition API), Supabase JS client, file-saver (already dependency), LiModal/LiPagination/LiToast (existing lib components)

## Global Constraints

- 14-day retention only — no row-count cap, enforced server-side in `insert_qris_history()` + migration
- Page size: 10 items, paginated client-server via Supabase `.range()`
- Export: always re-query DB for all rows; CSV MIME `text/csv`, HTML MIME `text/html`; filename `qris-history-<ISO-date>.<ext>`
- Delete: RLS `qris_history_own_delete` policy already allows delete on own rows
- Toast on success/error via `useToast()` from `@lib/composables/useToast`
- No new npm dependencies
- Commit per task, co-authored-by Claude

---

### Task 1: Migration — Drop 50-Row Cap from RPC

**Files:**
- Create: `supabase/migrations/20260703_drop_qris_history_row_cap.sql`
- Modify: `supabase/schema.sql:374-415`

**Interfaces:**
- Produces: `insert_qris_history` RPC now only prunes rows older than 14 days; no row-count cap

- [ ] **Step 1: Create migration file**

```sql
-- Drop the 50-row cap from insert_qris_history. Now only prunes rows older
-- than 14 days. The row-count cap was removed per user requirement — history
-- can grow arbitrarily within the 14-day window.
create or replace function public.insert_qris_history(
  p_type          text,
  p_qr_value      text,
  p_qr_data_url   text,
  p_merchant_name text,
  p_mpan          text,
  p_merchant_id   text,
  p_amount        text
) returns public.qris_history
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row  public.qris_history;
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'not authenticated';
  end if;

  insert into public.qris_history
    (user_id, type, qr_value, qr_data_url, merchant_name, mpan, merchant_id, amount)
  values
    (v_user, p_type, p_qr_value, p_qr_data_url, p_merchant_name, p_mpan, p_merchant_id, p_amount)
  returning * into v_row;

  -- Only prune by age — no row-count cap.
  delete from public.qris_history
   where user_id = v_user
     and created_at < now() - interval '14 days';

  return v_row;
end;
$$;

revoke all on function public.insert_qris_history(text, text, text, text, text, text, text) from public, anon;
grant  execute on function public.insert_qris_history(text, text, text, text, text, text, text) to authenticated;
```

- [ ] **Step 2: Apply migration to Supabase**

Run: use the Supabase MCP `apply_migration` tool with name `20260703_drop_qris_history_row_cap` and the query from Step 1.

- [ ] **Step 3: Update schema.sql (source-of-truth)**

In `supabase/schema.sql:401-411`, replace the `delete from public.qris_history` block:

Old (lines 401-411):
```sql
  delete from public.qris_history
   where user_id = v_user
     and (
       created_at < now() - interval '14 days'
       or id not in (
         select id from public.qris_history
          where user_id = v_user
          order by created_at desc
          limit 50
       )
     );
```

New:
```sql
  delete from public.qris_history
   where user_id = v_user
     and created_at < now() - interval '14 days';
```

Also update the comment on line 372: `-- than 14 days OR outside the latest 50. Pruning after... cap exactly 50` → `-- than 14 days.`

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260703_drop_qris_history_row_cap.sql supabase/schema.sql
git commit -m "feat(db): remove 50-row cap from insert_qris_history, keep 14-day retention only

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: useQris — Pagination + Clear All + Export

**Files:**
- Modify: `src/modules/qris/composables/useQris.js` (entire file, ~217 lines)

**Interfaces:**
- Consumes: `supabase` from `@lib/supabase.js` (existing); `saveAs` from `file-saver` (existing dep)
- Produces:
  - `currentPage` (ref<Number>, default 1), `pageSize` (const 10), `totalCount` (ref<Number>, default 0), `totalPages` (computed<Number>)
  - `loadHistory(page?: number)` — paginated, sets `currentPage`, `totalCount`, `history`
  - `clearAllHistory()` — async, deletes all own rows, resets state; shows toast on success/error
  - `exportHistory(format: 'csv'|'html', mode: 'simple'|'full')` — async, re-queries all rows, builds + downloads file; shows toast on error
  - Removes: `HISTORY_LIMIT` constant (line 14)
  - Updates: `saveToHistory` no longer slices to `HISTORY_LIMIT` after prepend

- [ ] **Step 1: Replace the `HISTORY_LIMIT` constant + add pagination state**

Remove line 14 (`const HISTORY_LIMIT = 50`).

After `const history = ref([])` (line 23), add:

```js
// Pagination
const currentPage = ref(1)
const pageSize = 10
const totalCount = ref(0)

const totalPages = computed(() => Math.max(1, Math.ceil(totalCount.value / pageSize)))
```

Add `computed` to the Vue import on line 5: change `import { ref } from 'vue'` to `import { ref, computed } from 'vue'`.

- [ ] **Step 2: Replace `loadHistory` with paginated version**

Replace lines 132-149 (the entire `loadHistory` function) with:

```js
// Load history — paginated (10 per page). Always fetches from the server
// so the list correctly reflects recent scans without full-page refresh.
async function loadHistory(page = 1) {
  historyLoading.value = true
  const start = (page - 1) * pageSize
  const end = start + pageSize - 1
  try {
    const { data, error, count } = await supabase
      .from('qris_history')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(start, end)
    if (error) throw error
    history.value = data || []
    totalCount.value = count ?? data?.length ?? 0
    currentPage.value = page
  } catch (e) {
    console.warn('[qris] failed to load history', e)
    history.value = []
    totalCount.value = 0
    currentPage.value = 1
  } finally {
    historyLoading.value = false
  }
}
```

- [ ] **Step 3: Update `saveToHistory` — remove HISTORY_LIMIT slice**

Line 39: change `.slice(0, HISTORY_LIMIT)` to just the prepend:

```js
if (data) history.value = [data, ...history.value]
```

And in the comment block on lines 1-3, update to remove "50-entry cap". Change line 3:

```
// retention + 50-entry cap enforced server-side by insert_qris_history().
```

to:

```
// retention enforced server-side by insert_qris_history() (no row-count cap).
```

- [ ] **Step 4: Add `clearAllHistory`**

After `deleteHistory` (line 160), add:

```js
// Delete all history entries for the current user. RLS policy
// "qris_history_own_delete" enforces ownership server-side.
async function clearAllHistory() {
  const { data: { session } } = await supabase.auth.getSession()
  const uid = session?.user?.id
  if (!uid) throw new Error('Not authenticated')

  const { error } = await supabase
    .from('qris_history')
    .delete()
    .eq('user_id', uid)
  if (error) throw error

  history.value = []
  totalCount.value = 0
  currentPage.value = 1
}
```

- [ ] **Step 5: Add CSV/HTML builders and `exportHistory`**

After `clearAllHistory`, add:

```js
// ── Export helpers ──

const SIMPLE_COLS = [
  { key: 'merchant_id', label: 'Merchant ID' },
  { key: 'merchant_name', label: 'Merchant Name' },
]

const FULL_COLS = [
  { key: 'created_at', label: 'Date' },
  { key: 'type', label: 'Type' },
  { key: 'merchant_name', label: 'Merchant Name' },
  { key: 'mpan', label: 'MPAN' },
  { key: 'merchant_id', label: 'Merchant ID' },
  { key: 'amount', label: 'Amount' },
]

function csvEscape(val) {
  if (val == null) return ''
  const s = String(val)
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

function formatExportDate(dateStr) {
  if (!dateStr) return ''
  return new Date(dateStr).toISOString()
}

function buildCsv(rows, mode) {
  const cols = mode === 'simple' ? SIMPLE_COLS : FULL_COLS
  const header = cols.map(c => csvEscape(c.label)).join(',')
  const body = rows.map(row =>
    cols.map(c => csvEscape(
      c.key === 'created_at' ? formatExportDate(row[c.key]) : row[c.key]
    )).join(',')
  ).join('\n')
  return `${header}\n${body}`
}

function buildHtml(rows, mode) {
  const cols = mode === 'simple' ? SIMPLE_COLS : FULL_COLS
  const thead = `<thead><tr>${cols.map(c => `<th>${c.label}</th>`).join('')}</tr></thead>`
  const tbody = `<tbody>${rows.map(row =>
    `<tr>${cols.map(c => {
      const val = c.key === 'created_at' ? formatExportDate(row[c.key]) : (row[c.key] ?? '')
      return `<td>${val}</td>`
    }).join('')}</tr>`
  ).join('\n')}</tbody>`
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>QRIS History</title>
<style>
  body { font-family: system-ui, sans-serif; padding: 24px; }
  table { border-collapse: collapse; width: 100%; }
  th, td { border: 1px solid #ddd; padding: 8px 12px; text-align: left; font-size: 13px; }
  th { background: #f5f5f5; font-weight: 600; }
  tr:nth-child(even) { background: #fafafa; }
</style></head>
<body><h2>QRIS History</h2><table>${thead}${tbody}</table></body></html>`
}

// Export history to CSV or HTML file. Always re-queries the DB for all rows
// (within the 14-day retention window) — not limited to the current page.
async function exportHistory(format, mode) {
  const cols = mode === 'simple'
    ? 'merchant_id,merchant_name'
    : 'created_at,type,merchant_name,mpan,merchant_id,amount'

  // Fetch all rows in batches (Supabase max 1000 per range call)
  const allRows = []
  let rangeStart = 0
  const batchSize = 1000

  try {
    while (true) {
      const { data, error } = await supabase
        .from('qris_history')
        .select(cols)
        .order('created_at', { ascending: false })
        .range(rangeStart, rangeStart + batchSize - 1)
      if (error) throw error
      if (!data || data.length === 0) break
      allRows.push(...data)
      if (data.length < batchSize) break
      rangeStart += batchSize
    }

    const ext = format === 'csv' ? 'csv' : 'html'
    const mime = format === 'csv' ? 'text/csv' : 'text/html'
    const filename = `qris-history-${new Date().toISOString().slice(0, 10)}.${ext}`

    const content = format === 'csv'
      ? buildCsv(allRows, mode)
      : buildHtml(allRows, mode)

    const blob = new Blob([content], { type: `${mime};charset=utf-8` })
    saveAs(blob, filename)
  } catch (e) {
    console.warn('[qris] export failed', e)
    throw e
  }
}
```

Add `saveAs` import at the top of the file. Change line 8 from:
```js
import { supabase } from '@lib/supabase.js'
```
to:
```js
import { saveAs } from 'file-saver'
import { supabase } from '@lib/supabase.js'
```

- [ ] **Step 6: Update the return object**

Replace lines 201-215 (the return statement) with:

```js
return {
  generating,
  parsing,
  historyLoading,
  result,
  error,
  history,
  currentPage,
  pageSize,
  totalCount,
  totalPages,
  generate,
  parse,
  loadHistory,
  deleteHistory,
  clearAllHistory,
  exportHistory,
  loadFromHistory,
  loadHistoryDetail,
  clearResult,
}
```

- [ ] **Step 7: Verify the file**

Read the full file to confirm: no `HISTORY_LIMIT` references remain; `computed` is imported; `saveAs` is imported; pagination state follows `history`; `loadHistory`, `clearAllHistory`, `exportHistory` are all present; return includes new exports.

- [ ] **Step 8: Commit**

```bash
git add src/modules/qris/composables/useQris.js
git commit -m "feat(qris): add pagination, clear-all, and export to useQris composable

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: QrisHistory UI — Toolbar, Expiry Labels, Pagination

**Files:**
- Modify: `src/modules/qris/components/QrisHistory.vue` (entire file, ~240 lines)

**Interfaces:**
- Consumes: `LiModal` from `@lib/components/LiModal.vue`, `LiPagination` from `@lib/components/LiPagination.vue`, `useToast` from `@lib/composables/useToast`
- Produces (new props): `currentPage` (Number, default 1), `totalPages` (Number, default 1)
- Produces (new emits): `clear`, `export` (payload `{ format: 'csv'|'html', mode: 'simple'|'full' }`), `update:currentPage`

- [ ] **Step 1: Rewrite template — add toolbar above list**

Replace the entire `<template>` block (lines 1-44) with:

```html
<template>
  <div class="hist">
    <!-- Toolbar -->
    <div v-if="history.length > 0 || !loading" class="hist__toolbar">
      <button class="hist__btn hist__btn--clear" @click="showClearConfirm = true">
        <span class="material-symbols-outlined">delete_sweep</span>
        Clear History
      </button>

      <div class="hist__export-wrap" ref="exportWrap">
        <button class="hist__btn hist__btn--export" @click.stop="toggleExportMenu">
          <span class="material-symbols-outlined">download</span>
          Export
        </button>
        <div v-if="exportOpen" class="hist__export-menu">
          <div class="hist__export-section-label">CSV</div>
          <button class="hist__export-item" @click="doExport('csv', 'simple')">Simple</button>
          <button class="hist__export-item" @click="doExport('csv', 'full')">Full</button>
          <div class="hist__export-divider"></div>
          <div class="hist__export-section-label">HTML</div>
          <button class="hist__export-item" @click="doExport('html', 'simple')">Simple</button>
          <button class="hist__export-item" @click="doExport('html', 'full')">Full</button>
        </div>
      </div>
    </div>

    <!-- Loading skeletons -->
    <div v-if="loading" class="hist__list">
      <div v-for="i in 5" :key="'skel-' + i" class="hist__item hist__item--skeleton">
        <div class="hist__qr-skel"></div>
        <div class="hist__info">
          <div class="hist__skel-line hist__skel-line--name"></div>
          <div class="hist__skel-line hist__skel-line--meta"></div>
          <div class="hist__skel-line hist__skel-line--date"></div>
        </div>
      </div>
    </div>

    <div v-else-if="history.length === 0" class="hist__empty">
      <span class="material-symbols-outlined">history</span>
      <p>No history yet. Generate or parse a QRIS to see it here.</p>
    </div>

    <div v-else class="hist__list">
      <div
        v-for="entry in history"
        :key="entry.id"
        class="hist__item"
        @click="$emit('detail', entry)"
      >
        <img v-if="entry.qr_data_url" :src="entry.qr_data_url" alt="QR" class="hist__qr" />
        <div class="hist__info">
          <span class="hist__name">{{ entry.merchant_name || 'Unknown' }}</span>
          <span class="hist__meta">
            <span v-if="entry.amount" class="hist__amount">Rp {{ Number(entry.amount).toLocaleString('id-ID') }}</span>
            <span v-if="entry.merchant_id" class="hist__mid">{{ entry.merchant_id }}</span>
            <span class="hist__type-badge" :class="'hist__type-badge--' + (entry.type || 'emvco')">
              {{ (entry.type || 'emvco').toUpperCase() }}
            </span>
          </span>
          <span class="hist__date-row">
            <span class="hist__date">{{ formatDate(entry.created_at) }}</span>
            <span class="hist__expiry" :class="expiryClass(entry.created_at)">
              &middot; {{ expiryLabel(entry.created_at) }}
            </span>
          </span>
        </div>
        <button class="hist__delete" @click.stop="$emit('delete', entry.id)" title="Delete">
          <span class="material-symbols-outlined">delete</span>
        </button>
      </div>
    </div>

    <!-- Pagination -->
    <div v-if="totalPages > 1" class="hist__pagination">
      <LiPagination v-model="localPage" :totalPages="totalPages" />
    </div>

    <!-- Clear Confirm Modal -->
    <LiModal v-if="showClearConfirm" :modelValue="true" title="Clear All History" size="sm"
             @update:modelValue="showClearConfirm = false">
      <p class="hist__confirm-text">
        This will permanently delete all your QR scan history.
        This action cannot be undone.
      </p>
      <template #footer>
        <button class="hist__btn hist__btn--cancel" @click="showClearConfirm = false">Cancel</button>
        <button class="hist__btn hist__btn--confirm-clear" @click="confirmClear">Clear All</button>
      </template>
    </LiModal>
  </div>
</template>
```

- [ ] **Step 2: Rewrite `<script setup>`**

Replace lines 47-64 with:

```html
<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import LiModal from '@lib/components/LiModal.vue'
import LiPagination from '@lib/components/LiPagination.vue'
import { useToast } from '@lib/composables/useToast'

const props = defineProps({
  history: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  currentPage: { type: Number, default: 1 },
  totalPages: { type: Number, default: 1 },
})

const emit = defineEmits(['detail', 'delete', 'clear', 'export', 'update:currentPage'])

const toast = useToast()
const showClearConfirm = ref(false)
const exportOpen = ref(false)
const exportWrap = ref(null)

// Two-way page binding for LiPagination (v-model)
const localPage = ref(props.currentPage)

// Sync parent → local when page changes (e.g. on new load)
watch(() => props.currentPage, (v) => { localPage.value = v })

// Sync local → parent on user click
watch(localPage, (v) => {
  if (v !== props.currentPage && v >= 1 && v <= props.totalPages) {
    emit('update:currentPage', v)
  }
})

// ── Export ──

function toggleExportMenu() {
  exportOpen.value = !exportOpen.value
}

function doExport(format, mode) {
  exportOpen.value = false
  emit('export', { format, mode })
}

// Close export menu when clicking outside
function onDocClick(e) {
  if (exportWrap.value && !exportWrap.value.contains(e.target)) {
    exportOpen.value = false
  }
}

onMounted(() => { document.addEventListener('click', onDocClick) })
onUnmounted(() => { document.removeEventListener('click', onDocClick) })

// ── Clear ──

async function confirmClear() {
  showClearConfirm.value = false
  try {
    await emit('clear')
    // Parent (QrisView) will handle the toast — this component is just the UI.
  } catch {
    // Error handling in parent
  }
}

// ── Dates ──

function formatDate(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  const now = new Date()
  const diff = now - d
  if (diff < 60000) return 'Just now'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function expiryDaysLeft(dateStr) {
  if (!dateStr) return 0
  const expiredDate = new Date(new Date(dateStr).getTime() + 14 * 86400000)
  return Math.ceil((expiredDate - Date.now()) / 86400000)
}

function expiryLabel(dateStr) {
  const days = expiryDaysLeft(dateStr)
  if (days <= 0) return 'Expires today'
  if (days === 1) return 'Expires tomorrow'
  return `Expires in ${days}d`
}

function expiryClass(dateStr) {
  const days = expiryDaysLeft(dateStr)
  if (days <= 1) return 'hist__expiry--warn'
  return ''
}
</script>
```

- [ ] **Step 3: Add new CSS blocks**

Append these styles before the final `</style>` (after line 239):

```css
/* ── Toolbar ── */
.hist__toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.hist__btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border: 1px solid transparent;
  border-radius: var(--radius-pill, 999px);
  font-family: var(--font-body, 'Inter', sans-serif);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 200ms;
  background: transparent;
}

.hist__btn .material-symbols-outlined {
  font-size: 16px;
}

.hist__btn--clear {
  color: var(--color-red-400, #C83E3B);
  border-color: rgba(200, 62, 59, 0.25);
}

.hist__btn--clear:hover {
  background: rgba(200, 62, 59, 0.06);
}

.hist__btn--export {
  color: var(--color-gray-700, #666);
  border-color: rgba(0, 0, 0, 0.1);
}

.hist__btn--export:hover {
  background: rgba(0, 0, 0, 0.04);
}

.hist__btn--cancel {
  color: var(--color-gray-700, #666);
  border-color: rgba(0, 0, 0, 0.1);
}

.hist__btn--cancel:hover {
  background: rgba(0, 0, 0, 0.04);
}

.hist__btn--confirm-clear {
  color: #fff;
  background: var(--color-red-400, #C83E3B);
  border-color: var(--color-red-400, #C83E3B);
}

.hist__btn--confirm-clear:hover {
  opacity: 0.9;
}

/* ── Export Dropdown ── */
.hist__export-wrap {
  position: relative;
}

.hist__export-menu {
  position: absolute;
  right: 0;
  top: calc(100% + 6px);
  min-width: 120px;
  background: #fff;
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: var(--radius-sm, 12px);
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.12);
  padding: 6px;
  z-index: 100;
  display: flex;
  flex-direction: column;
}

.hist__export-section-label {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--color-gray-400, #B3B3B3);
  padding: 4px 8px 2px;
  letter-spacing: 0.5px;
}

.hist__export-item {
  border: none;
  background: transparent;
  padding: 6px 10px;
  font-family: var(--font-body, 'Inter', sans-serif);
  font-size: 13px;
  color: var(--color-gray-900, #333);
  text-align: left;
  border-radius: var(--radius-xs, 8px);
  cursor: pointer;
  transition: background 150ms;
}

.hist__export-item:hover {
  background: var(--color-gray-100, #F2F2F2);
}

.hist__export-divider {
  height: 1px;
  background: rgba(0, 0, 0, 0.06);
  margin: 4px 6px;
}

/* ── Expiry ── */
.hist__date-row {
  display: flex;
  align-items: center;
  gap: 4px;
}

.hist__expiry {
  font-size: 10px;
  color: var(--color-gray-400, #B3B3B3);
}

.hist__expiry--warn {
  color: var(--color-red-400, #C83E3B);
  font-weight: 600;
}

/* ── Pagination ── */
.hist__pagination {
  margin-top: 16px;
  padding-top: 12px;
  border-top: 1px solid rgba(0, 0, 0, 0.06);
}

/* ── Confirm Modal Text ── */
.hist__confirm-text {
  font-size: 14px;
  color: var(--color-gray-700, #666);
  line-height: 1.6;
  margin: 0;
}
```

- [ ] **Step 4: Commit**

```bash
git add src/modules/qris/components/QrisHistory.vue
git commit -m "feat(qris): add toolbar, expiry labels, and pagination to QrisHistory

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: Wire QrisView.vue — Clear + Export + Pagination Events

**Files:**
- Modify: `src/modules/qris/views/QrisView.vue:130-231` (template binding + script)

**Interfaces:**
- Consumes: `currentPage`, `totalPages`, `clearAllHistory`, `exportHistory` from `useQris()`
- Wires: `QrisHistory` new props (`currentPage`, `totalPages`) and new events (`@clear`, `@export`, `@update:currentPage`)

- [ ] **Step 1: Update composable destructuring**

In `QrisView.vue` line 163, replace:
```js
const { result, history, historyLoading, loadHistory, deleteHistory, loadFromHistory, clearResult } = useQris()
```
with:
```js
const { result, history, historyLoading, currentPage, totalPages, loadHistory, deleteHistory, clearAllHistory, exportHistory, loadFromHistory, clearResult } = useQris()
```

- [ ] **Step 2: Update QrisHistory template binding**

Replace lines 131-136:
```html
            <QrisHistory
              :history="history"
              :loading="historyLoading"
              @detail="onHistoryDetail"
              @delete="onDeleteHistory"
            />
```
with:
```html
            <QrisHistory
              :history="history"
              :loading="historyLoading"
              :currentPage="currentPage"
              :totalPages="totalPages"
              @detail="onHistoryDetail"
              @delete="onDeleteHistory"
              @clear="onClearHistory"
              @export="onExportHistory"
              @update:currentPage="onPageChange"
            />
```

- [ ] **Step 3: Add new handler functions + toast import**

After the `import { useAccess }` line (line 154), add:
```js
import { useToast } from '@lib/composables/useToast'
```

In the script section, destructure `useToast` after the access/composable lines (after line 163):
```js
const toast = useToast()
```

After the `onDeleteHistory` function (line 220), add:

```js
async function onClearHistory() {
  try {
    await clearAllHistory()
    toast.success('History cleared')
  } catch (e) {
    console.warn('[qris] clear history failed', e)
    toast.error('Failed to clear history')
  }
}

async function onExportHistory({ format, mode }) {
  try {
    await exportHistory(format, mode)
    toast.success(`Exported as ${format.toUpperCase()}`)
  } catch (e) {
    console.warn('[qris] export failed', e)
    toast.error('Export failed')
  }
}

async function onPageChange(page) {
  await loadHistory(page)
}
```

- [ ] **Step 4: Remove onMounted `loadHistory()` call since it's already called on history tab**

The `onMounted` at line 222-223 already calls `loadHistory()`. Keep it — it handles the default tab (generator) case where user lands on the page. No change needed.

However, note that `switchTab` (line 187-189) also calls `loadHistory()` when switching to history tab. Since `loadHistory` now takes an optional page (defaults to 1), this is correct.

- [ ] **Step 5: Commit**

```bash
git add src/modules/qris/views/QrisView.vue
git commit -m "feat(qris): wire clear, export, and pagination events in QrisView

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: QrisReader — Global Paste Listener

**Files:**
- Modify: `src/modules/qris/components/QrisReader.vue` (template line 10, script lines 54-61 + new onMounted/onUnmounted)

**Interfaces:**
- No new imports, exports, or props. Internal change only.

- [ ] **Step 1: Move paste handler from element to window**

In the template (line 10), remove `@paste="handlePaste"` from the dropzone div. The opening tag changes from:

```html
    <div
      class="reader__dropzone"
      :class="{ 'reader__dropzone--active': dragging }"
      @dragover.prevent="dragging = true"
      @dragleave="dragging = false"
      @drop.prevent="handleDrop"
      @paste="handlePaste"
      tabindex="0"
    >
```

to:

```html
    <div
      class="reader__dropzone"
      :class="{ 'reader__dropzone--active': dragging }"
      @dragover.prevent="dragging = true"
      @dragleave="dragging = false"
      @drop.prevent="handleDrop"
      tabindex="0"
    >
```

(Keep `tabindex="0"` — it's needed for keyboard a11y on the dropzone, even if not for paste.)

- [ ] **Step 2: Add onMounted/onUnmounted window listener**

In the `<script setup>`, line 55: change `import { ref } from 'vue'` to `import { ref, onMounted, onUnmounted } from 'vue'`.

After line 65 (`const decodedImage = ref(null)`), add:

```js
// Global paste listener — active only while Reader tab is mounted.
// Removes the "must click dropzone first" pain point.
onMounted(() => window.addEventListener('paste', handlePaste))
onUnmounted(() => window.removeEventListener('paste', handlePaste))
```

- [ ] **Step 3: Commit**

```bash
git add src/modules/qris/components/QrisReader.vue
git commit -m "fix(qris): listen for paste on window instead of dropzone element

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 6: Integration Check — Run App + Verify

**No files changed.** Manual verification checklist.

- [ ] **Step 1: Start dev server**

```bash
npm run dev
```

- [ ] **Step 2: Verify Reader paste**

1. Copy any QR code image to clipboard
2. Navigate to QRIS Tools → Reader tab
3. Press Ctrl+V anywhere on the page (do NOT click the dropzone)
4. Expected: image decodes, QR data appears in the Analysis panel

- [ ] **Step 3: Verify History pagination**

1. Navigate to History tab (must have >10 entries)
2. Expected: shows only 10 items, pagination controls visible at bottom
3. Click page 2 → shows next page
4. Expected: page 1 button is now clickable (prev/next work)

- [ ] **Step 4: Verify expiry labels**

1. On History tab, each item shows "Expires in Nd" or "Expires tomorrow" or "Expires today"
2. Items with ≤1 day show in red

- [ ] **Step 5: Verify Clear History**

1. Click "Clear History" button
2. Expected: confirmation modal appears
3. Click "Cancel" → modal closes, history unchanged
4. Click "Clear History" again → click "Clear All"
5. Expected: history list empties, toast "History cleared" shown

- [ ] **Step 6: Verify Export**

1. Add some history entries (generate/parse a few QR codes)
2. Click "Export" → dropdown appears with CSV Simple/Full, HTML Simple/Full
3. Click "CSV → Simple"
4. Expected: downloads `qris-history-<date>.csv` with columns `Merchant ID, Merchant Name`
5. Click "CSV → Full"
6. Expected: downloads CSV with all 6 columns
7. Click "HTML → Full"
8. Expected: downloads styled HTML file, opens correctly in browser with table

- [ ] **Step 7: Verify individual delete still works**

1. Click delete icon on any history item
2. Expected: item removed from list, pagination adjusts

- [ ] **Step 8: Run existing linters/tests if any**

```bash
npm run lint 2>/dev/null || echo "no linter configured"
```

No changes expected — all existing functionality preserved.
