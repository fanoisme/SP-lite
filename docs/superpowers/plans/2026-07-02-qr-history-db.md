# QR History → DB Persistence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move QRIS history from localStorage into a per-user Supabase table with 14-day retention + 50-entry cap, enforced server-side.

**Architecture:** New `public.qris_history` table (RLS own-row) + a `security definer` RPC `insert_qris_history(...)` that inserts a row then prunes expired/overflow rows in one transaction (insert-then-prune so the cap is exactly 50). Client composable `useQris.js` swaps its localStorage read/write helpers for `supabase` calls; entry shape is unchanged so UI components are untouched.

**Tech Stack:** Supabase (Postgres + PostgREST RLS/RPC), Vue 3 composable, `@supabase/supabase-js` v2 (already installed), Vite.

## Global Constraints

- **Retention window:** 14 days exactly (`interval '14 days'`).
- **Per-user cap:** latest 50 entries (`limit 50`).
- **Existing localStorage data:** discarded — one-time `localStorage.removeItem('sp_lite_qris_history')` on module load, no migration.
- **QR image:** stored inline as base64 text in `qr_data_url` (no Storage bucket).
- **Idempotent SQL:** everything appended to `supabase/schema.sql` must be safe to re-run (`create table if not exists`, `drop policy if exists` before create, `create or replace function`).
- **SQL style:** match the existing `ensure_profile()` pattern — `security definer`, `set search_path = public`, `revoke ... from public, anon`, `grant ... to authenticated`.
- **Testing approach (deviation from TDD — user constraint):** this repo ships no JS test runner and the lazy-dev rule forbids adding one for thin wiring. The non-trivial logic (RPC retention/cap pruning) is verified by a runnable SQL self-check run in the Supabase SQL Editor. Client changes are verified by `npm run build` (catches import/syntax errors) and a manual end-to-end run against the live project. Trivial one-liners get no test.
- **Insert path is RPC-only:** the client never inserts directly, so the table gets `select, delete` grants only — no `insert` grant, no insert RLS policy. The `security definer` RPC bypasses RLS/grants as owner; it reads `auth.uid()` and sets `user_id` itself.

---

## File Structure

| File | Responsibility | Change |
|---|---|---|
| `supabase/schema.sql` | Idempotent DDL for the whole DB. Append a new section `10. QR history` defining the table, index, RLS policies, and the `insert_qris_history` RPC. | Append only — touch nothing above. |
| `src/modules/qris/composables/useQris.js` | QRIS state composable — generate/parse/load/delete history. Replace the localStorage storage layer with Supabase calls; keep all exported shapes and function names identical so `QrisView.vue` / `QrisHistory.vue` / `QrisHistoryDetail.vue` are untouched. | Rewrite the 4 storage helpers + one-time cleanup; `id` becomes a uuid string (was epoch-ms number). |

No other files change. The spec's mention of an insert RLS policy is dropped here (insert is RPC-only — see Global Constraints).

---

## Task 1: Schema — `qris_history` table + retention RPC

**Files:**
- Modify: `supabase/schema.sql` (append new section `10` after the existing section `9` bootstrap comment, i.e. after line 333 / end of file).

**Interfaces:**
- Produces (SQL): table `public.qris_history`, index `idx_qris_history_user_created`, policies `qris_history_own_select` / `qris_history_own_delete`, function `public.insert_qris_history(p_type text, p_qr_value text, p_qr_data_url text, p_merchant_name text, p_mpan text, p_merchant_id text, p_amount text) returns public.qris_history`.
- Produces (for Task 2): the RPC name `insert_qris_history` and exact param names `p_type, p_qr_value, p_qr_data_url, p_merchant_name, p_mpan, p_merchant_id, p_amount` (Task 2 calls `supabase.rpc('insert_qris_history', { ... })` with these keys). The table columns are all `snake_case`, matching the existing client entry shape exactly.

- [ ] **Step 1: Append section 10 to `supabase/schema.sql`**

Append exactly this block at the end of the file:

```sql

-- ── 10. QR history (per-user, 14-day retention, cap 50) ──────────────────
-- QRIS generate/parse history. Written through insert_qris_history() (below),
-- which inserts a row then prunes entries older than 14 days or beyond the
-- latest 50 per user. Reads/deletes go direct through RLS (own-row only).
create table if not exists public.qris_history (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles (id) on delete cascade,
  type          text not null check (type in ('emvco','proprietary')),
  qr_value      text not null,
  qr_data_url   text,
  merchant_name text,
  mpan          text,
  merchant_id   text,
  amount        text,
  created_at    timestamptz not null default now()
);

create index if not exists idx_qris_history_user_created
  on public.qris_history (user_id, created_at desc);

alter table public.qris_history enable row level security;

-- Client reads/deletes its own rows. Insert is RPC-only (security definer),
-- so no insert grant or insert policy is needed here.
grant select, delete on public.qris_history to authenticated;

drop policy if exists "qris_history_own_select" on public.qris_history;
create policy "qris_history_own_select" on public.qris_history
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "qris_history_own_delete" on public.qris_history;
create policy "qris_history_own_delete" on public.qris_history
  for delete to authenticated using (auth.uid() = user_id);

-- insert_qris_history(): insert-then-prune in one transaction. Reads auth.uid()
-- itself (RPC is security definer, so RLS is bypassed; we enforce ownership
-- manually). Inserts the new row first, then deletes this user's rows older
-- than 14 days OR outside the latest 50. Pruning AFTER the insert is what makes
-- the cap exactly 50 — prune-before-insert left 51 (off-by-one, caught by the
-- Step 4 self-check). The row just inserted is newest, so it is always retained.
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

  return v_row;
end;
$$;

revoke all on function public.insert_qris_history(text, text, text, text, text, text, text) from public, anon;
grant  execute on function public.insert_qris_history(text, text, text, text, text, text, text) to authenticated;
```

- [ ] **Step 2: Apply the schema to the live Supabase project**

Open Supabase Dashboard → SQL Editor → New query → paste the **entire** `supabase/schema.sql` file → Run. (Re-running the whole file is safe — everything above is already idempotent, and the new section is too.)

Expected: query succeeds with no errors. If you see `function ... does not exist` on the `revoke` line, that means the `create or replace function` above it failed — fix the cause before continuing.

- [ ] **Step 3: Verify the schema objects exist**

In SQL Editor, run:

```sql
select count(*) from information_schema.tables where table_schema='public' and table_name='qris_history';
select count(*) from pg_policies where schemaname='public' and tablename='qris_history';
select count(*) from pg_proc where proname='insert_qris_history';
```

Expected: `1`, `2`, `1`.

- [ ] **Step 4: Run the retention self-check (the runnable check for the non-trivial logic)**

This is the one check the plan leaves behind for the prune/cap logic — pure SQL, no JS framework. Replace `<YOUR_USER_UUID>` with your real `profiles.id` (run `select id from public.profiles where username='<you>';` to get it). Run in SQL Editor:

```sql
set request.jwt.claim.sub = '<YOUR_USER_UUID>';   -- makes auth.uid() return this user in this session

-- cap check: insert 52 rows via the RPC, expect table to hold exactly 50 for this user
do $$
declare i int;
begin
  for i in 1..52 loop
    perform public.insert_qris_history('emvco','test '||i,null,null,null,null,null);
  end loop;
end $$;

select count(*) as after_cap from public.qris_history where user_id='<YOUR_USER_UUID>';
-- expected: 50

-- retention check: backdate the oldest row to 20 days ago, insert one more, expect it pruned
update public.qris_history
   set created_at = now() - interval '20 days'
 where id = (select id from public.qris_history where user_id='<YOUR_USER_UUID' order by created_at asc limit 1);

select public.insert_qris_history('emvco','fresh',null,null,null,null,null);

select count(*) as after_retention,
       count(*) filter (where created_at < now() - interval '14 days') as stale_remaining
  from public.qris_history where user_id='<YOUR_USER_UUID>';
-- expected: after_retention = 50, stale_remaining = 0

-- cleanup the test rows
delete from public.qris_history where user_id='<YOUR_USER_UUID>' and qr_value like 'test%';
delete from public.qris_history where user_id='<YOUR_USER_UUID>' and qr_value='fresh';

reset request.jwt.claim.sub;
```

Expected: `after_cap = 50`, `after_retention = 50`, `stale_remaining = 0`. If any differ, the prune logic is wrong — stop and fix before Task 2.

- [ ] **Step 5: Commit**

```bash
git add supabase/schema.sql
git commit -m "feat(db): add qris_history table with 14-day retention RPC

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Client — swap `useQris.js` storage layer to Supabase

**Files:**
- Modify: `src/modules/qris/composables/useQris.js` (whole file — rewrite storage helpers, keep exported names + shapes).

**Interfaces:**
- Consumes (from Task 1): RPC `insert_qris_history` with params `{ p_type, p_qr_value, p_qr_data_url, p_merchant_name, p_mpan, p_merchant_id, p_amount }`; table `qris_history` (columns all `snake_case`, selectable/deletable via RLS).
- Consumes (existing): `supabase` client exported from `@lib/supabase.js`.
- Produces (unchanged for consumers): `useQris()` returning `{ generating, parsing, historyLoading, result, error, history, generate, parse, loadHistory, deleteHistory, loadFromHistory, loadHistoryDetail, clearResult }` — same names, same entry shape. `entry.id` is now a uuid **string** instead of an epoch-ms number; it is only used as a `v-for` key and in `deleteHistory`/`loadHistoryDetail` lookups, so no numeric assumptions break.

- [ ] **Step 1: Rewrite the file**

Replace the entire contents of `src/modules/qris/composables/useQris.js` with:

```js
// SP-lite — QRIS state composable.
// History persists per-user in Supabase (public.qris_history), with a 14-day
// retention + 50-entry cap enforced server-side by insert_qris_history().

import { ref } from 'vue'
import QRCode from 'qrcode'
import { parseQris, buildQris, buildProprietaryQris, flattenTags } from '@lib/qris-core.js'
import { supabase } from '@lib/supabase.js'

// One-time cleanup: flush the old localStorage history so stale device-local
// entries don't linger. Fresh start in DB — no migration.
try { localStorage.removeItem('sp_lite_qris_history') } catch { /* ignore */ }

const HISTORY_LIMIT = 50

export function useQris() {
  // State
  const generating = ref(false)
  const parsing = ref(false)
  const historyLoading = ref(false)
  const result = ref(null)
  const error = ref(null)
  const history = ref([])

  // Persist a generated/parsed QR to DB. Fire-and-forget from generate()/parse()
  // — must not block the QR already shown, and must not throw to the caller.
  async function saveToHistory({ type, qrValue, dataUrl, highlights }) {
    try {
      const { data, error } = await supabase.rpc('insert_qris_history', {
        p_type: type,
        p_qr_value: qrValue,
        p_qr_data_url: dataUrl,
        p_merchant_name: highlights?.merchantName || null,
        p_mpan: highlights?.mpan || null,
        p_merchant_id: highlights?.merchantId || null,
        p_amount: highlights?.amount || null,
      })
      if (error) throw error
      if (data) history.value = [data, ...history.value].slice(0, HISTORY_LIMIT)
    } catch (e) {
      console.warn('[qris] failed to persist history', e)
    }
  }

  // Generate QRIS from form fields
  async function generate(fields) {
    generating.value = true
    error.value = null
    result.value = null

    try {
      const qrType = fields.type || 'emvco'
      const built = qrType === 'proprietary'
        ? buildProprietaryQris(fields)
        : buildQris(fields)

      const dataUrl = await QRCode.toDataURL(built.qrValue, {
        width: 300,
        errorCorrectionLevel: 'M',
        margin: 2,
      })

      const data = {
        qrValue: built.qrValue,
        dataUrl,
        valid: built.valid,
        type: qrType,
        highlights: built.highlights,
        tags: qrType === 'proprietary' ? built.tags : flattenTags(built.tags),
      }

      // Show the result first, then persist to DB without blocking the UI.
      result.value = data
      saveToHistory({ type: qrType, qrValue: built.qrValue, dataUrl, highlights: built.highlights })

      return data
    } catch (e) {
      error.value = e.message || 'Generation failed'
      return null
    } finally {
      generating.value = false
    }
  }

  // Parse raw QRIS string
  async function parse(qrValue) {
    parsing.value = true
    error.value = null
    result.value = null

    try {
      if (!qrValue) {
        error.value = 'qrValue is required'
        return null
      }

      const parsed = parseQris(qrValue)
      if (!parsed.valid && parsed.error) {
        error.value = parsed.error
        return null
      }

      const dataUrl = await QRCode.toDataURL(qrValue, {
        width: 300,
        errorCorrectionLevel: 'M',
        margin: 2,
      })

      const data = {
        qrValue,
        dataUrl,
        valid: parsed.valid,
        crcValid: parsed.crcValid,
        crcProvided: parsed.crcProvided,
        crcComputed: parsed.crcComputed,
        highlights: parsed.highlights,
        tags: flattenTags(parsed.tags),
      }

      result.value = data
      saveToHistory({ type: 'emvco', qrValue, dataUrl, highlights: parsed.highlights })

      return data
    } catch (e) {
      error.value = e.message || 'Parse failed'
      return null
    } finally {
      parsing.value = false
    }
  }

  // Load history (own rows, newest first, capped at 50)
  async function loadHistory() {
    historyLoading.value = true
    try {
      const { data, error } = await supabase
        .from('qris_history')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50)
      if (error) throw error
      history.value = data || []
    } catch (e) {
      console.warn('[qris] failed to load history', e)
      history.value = []
    } finally {
      historyLoading.value = false
    }
  }

  // Delete history entry
  async function deleteHistory(id) {
    try {
      const { error } = await supabase.from('qris_history').delete().eq('id', id)
      if (error) throw error
      history.value = history.value.filter(h => h.id !== id)
    } catch (e) {
      console.warn('[qris] failed to delete history entry', e)
    }
  }

  // Load history detail with full parsed tags
  async function loadHistoryDetail(id) {
    const entry = history.value.find(h => h.id === id)
    if (!entry) throw new Error('Failed to load detail')
    const parsed = parseQris(entry.qr_value)
    return {
      ...entry,
      valid: parsed.valid,
      crcValid: parsed.crcValid,
      crcProvided: parsed.crcProvided,
      crcComputed: parsed.crcComputed,
      highlights: parsed.highlights,
      tags: parsed.tags ? flattenTags(parsed.tags) : null,
    }
  }

  // Load result from history
  function loadFromHistory(entry) {
    result.value = {
      qrValue: entry.qr_value,
      dataUrl: entry.qr_data_url,
      valid: true,
      highlights: {
        merchantName: entry.merchant_name,
        mpan: entry.mpan,
        merchantId: entry.merchant_id,
        amount: entry.amount,
        mpanForMpc: entry.mpan?.slice(0, 8),
      },
      tags: null, // Will need to re-parse if needed
    }
  }

  // Clear result
  function clearResult() {
    result.value = null
    error.value = null
  }

  return {
    generating,
    parsing,
    historyLoading,
    result,
    error,
    history,
    generate,
    parse,
    loadHistory,
    deleteHistory,
    loadFromHistory,
    loadHistoryDetail,
    clearResult,
  }
}
```

`saveToHistory` lives inside `useQris()` (not module-level) so it closes over the `history` ref — the old file could keep its helpers module-level only because they hit localStorage, not the ref.

- [ ] **Step 2: Build to verify imports/syntax**

Run: `npm run build`
Expected: build succeeds, no errors. (Catches a bad `@lib/supabase.js` import path or syntax slip.)

- [ ] **Step 3: Manual end-to-end verification against the live project**

Run `npm run dev`, log in, then:

1. Open QRIS → Generator → generate a QR. Switch to the History tab → entry appears (merchant name, amount, thumbnail, relative date all render).
2. In SQL Editor: `select id, user_id, type, merchant_name, created_at from public.qris_history order by created_at desc limit 5;` → the row you just made is there, `user_id` is your `profiles.id`.
3. Back in the app → Reader → paste a QRIS string → parse. History tab shows the new parse entry.
4. Click an entry → detail modal opens, tags table populated (re-parsed from `qr_value`), CRC status shown.
5. Click delete on an entry → it disappears from the list; SQL Editor `select count(*) ...` confirms the row is gone.
6. Open the app in a **different browser / incognito**, log in as the same user → History tab loads the same entries from DB (proves it is no longer device-local).
7. (Optional, cross-user RLS) log in as a second user → their History tab is empty; they cannot see user #1's rows.

If step 6 fails, history is still being read from somewhere local — re-check `loadHistory`.

- [ ] **Step 4: Commit**

```bash
git add src/modules/qris/composables/useQris.js
git commit -m "feat(qris): persist history to Supabase instead of localStorage

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```
