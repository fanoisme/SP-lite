# QRIS History: Clear, Export, Pagination + Reader Global Paste

2026-07-03

## Scope

Two independent changes in the QRIS module:

1. **History panel** — clear all, export (CSV/HTML, simple/full), pagination (10/page, 14-day retention only, no row cap)
2. **Reader tab** — paste image from clipboard without clicking the dropzone first

---

## 1. Backend — Remove 50-Row Cap

### Problem
`insert_qris_history()` RPC currently prunes beyond 50 newest rows per user AND beyond 14 days. User wants only 14-day retention, no row cap.

### Change
New migration to alter the RPC: remove the `-- 2. Keep only newest N entries per user` prune block, keeping only `-- 1. Delete entries older than 14 days`.

### Migration file
`supabase/migrations/<timestamp>_drop_qris_history_row_cap.sql`

### Affected source-of-truth
Update `supabase/schema.sql` `insert_qris_history()` body to match.

---

## 2. Data Layer — `useQris.js`

File: `src/modules/qris/composables/useQris.js`

### 2a. Paginated fetch
- `HISTORY_LIMIT = 50` constant removed.
- New state: `currentPage` (ref, default 1), `pageSize` (const 10), `totalCount` (ref, default 0), `totalPages` (computed).
- `loadHistory()` → `loadHistory(page = 1)`:
  - Calls `supabase.from('qris_history').select('*', { count: 'exact' }).order('created_at', { ascending: false }).range(start, end)` where `start = (page-1)*10, end = start+9`.
  - Sets `history`, `totalCount`, `currentPage`.

### 2b. Clear all
- New `clearAllHistory()`:
  - `await supabase.from('qris_history').delete().eq('user_id', session.user.id)`
  - `history.value = []`, `totalCount.value = 0`, `currentPage.value = 1`
  - Returns void; error thrown for caller to catch.

### 2c. Export
- New `exportHistory(format: 'csv' | 'html', mode: 'simple' | 'full')`:
  - **Always re-queries**: `supabase.from('qris_history').select('*').order('created_at', { ascending: false })` — no range limit, fetches all rows still in DB (up to 14-day retention).
  - `simple` columns: `merchant_id`, `merchant_name`
  - `full` columns: `created_at`, `type`, `merchant_name`, `mpan`, `merchant_id`, `amount`
  - CSV: manual string builder (no dependency needed). Escape: wrap in `"..."`, double any internal `"`. Header row then data rows. MIME `text/csv`, filename `qris-history-<date>.<ext>`.
  - HTML: build a `<table>` string with `<thead>`/`<tbody>`, minimal inline styles for readability. MIME `text/html`, filename `qris-history-<date>.<ext>`.
  - Download via `Blob` + `saveAs` (file-saver, already a dependency) — same pattern as `OutputActions.vue`.

### 2d. Return additions
Composable now returns: `currentPage, pageSize, totalCount, totalPages, clearAllHistory, exportHistory`.

---

## 3. UI — `QrisHistory.vue`

File: `src/modules/qris/components/QrisHistory.vue`

### 3a. New props
- `currentPage` (Number, default 1)
- `totalPages` (Number, default 1)

### 3b. New emits
- `clear` — user clicked "Clear History" and confirmed
- `export` — `{ format: 'csv'|'html', mode: 'simple'|'full' }`
- `update:currentPage` — pagination page change

### 3c. Toolbar
New header `<div>` above `.hist__list`:
- **Left**: "Clear History" button (outline/danger style). On click, opens a `LiModal` confirm dialog:
  > "Clear all QRIS history?"
  > "This will permanently delete all your QR scan history. This action cannot be undone."
  > [Cancel] [Clear All]
  - On confirm, emits `clear`.
- **Right**: "Export" dropdown button. First level: "CSV" / "HTML". Each reveals sub-menu: "Simple" / "Full". On leaf click, emits `export` with `{format, mode}`.

### 3d. "Expires in N days" label
Each `.hist__item` gets a small label below the relative date:
- Compute `expiresAt = new Date(created_at).getTime() + 14 * 86400000`
- `daysLeft = Math.ceil((expiresAt - Date.now()) / 86400000)`
- Show: `"Expires in {N}d"` or `"Expires tomorrow"` or `"Expires today"` (colored warn when ≤2 days). Use native JS only.

### 3e. Pagination footer
Below `.hist__list` (or below empty state): `<LiPagination v-model="currentPage" :totalPages="totalPages" />`, only rendered when `totalPages > 1`. Emits `update:currentPage`.

### 3f. No breaking changes
Existing `history`, `loading` props, `detail`, `delete` emits unchanged.

---

## 4. Wiring — `QrisView.vue`

File: `src/modules/qris/views/QrisView.vue`

### 4a. Composables
Destructure new: `currentPage, totalPages, clearAllHistory, exportHistory`.

### 4b. Bindings
```vue
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

### 4c. Handlers
- `onClearHistory()` — await `clearAllHistory()`, show toast/notification on success/error.
- `onExportHistory({ format, mode })` — await `exportHistory(format, mode)`, show toast on error.
- `onPageChange(page)` — await `loadHistory(page)`.

---

## 5. Reader Global Paste — `QrisReader.vue`

File: `src/modules/qris/components/QrisReader.vue`

### Problem
`@paste` is bound to the dropzone `<div>` (line 10). The div must have focus before paste works — user must click the box first.

### Fix
- Remove `@paste="handlePaste"` from the dropzone div template (line 10).
- In `<script setup>`, add:
  ```js
  onMounted(() => window.addEventListener('paste', handlePaste))
  onUnmounted(() => window.removeEventListener('paste', handlePaste))
  ```
- `handlePaste` logic stays the same — it already filters `e.clipboardData.items` for `image/*` items only, so text pastes still reach the raw-value textarea naturally.
- Remove `tabindex="0"` from the dropzone div only if it was solely for paste focus (verify: the dropzone also handles drag-drop via `@drop`/`@dragover`, which don't need focus). If `tabindex` is needed for a11y/focus-visible styling, keep it.

### Scope
`QrisReader.vue` is conditionally rendered (`v-if`) in `QrisView.vue` — it only mounts while the Reader tab is active. Window listener auto-cleaned on tab switch or unmount. Paste only works on Reader tab, as requested.

---

## 6. Files Changed Summary

| File | Change |
|------|--------|
| `supabase/migrations/..._drop_qris_history_row_cap.sql` | New migration: remove 50-row cap from RPC |
| `supabase/schema.sql` | Sync RPC body |
| `src/modules/qris/composables/useQris.js` | Pagination, clearAll, export, remove HISTORY_LIMIT |
| `src/modules/qris/components/QrisHistory.vue` | Toolbar (clear + export), expiry label, pagination |
| `src/modules/qris/views/QrisView.vue` | Wire new composable exports & events |
| `src/modules/qris/components/QrisReader.vue` | Window-level paste listener |

## 7. Not in Scope
- No change to delete individual history item (existing per-row delete stays)
- No change to QrisHistoryDetail modal
- No new npm dependencies
