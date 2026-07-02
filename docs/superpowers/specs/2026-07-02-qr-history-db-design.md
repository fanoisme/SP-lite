# QR History → DB Persistence (with 14-day retention)

**Date:** 2026-07-02
**Status:** Approved (approach A)
**Scope:** Persist QRIS history server-side in Supabase, replacing localStorage. Per-user, 14-day retention + cap of 50 entries enforced server-side.

## Context

QR history today is 100% client-side: `src/modules/qris/composables/useQris.js` stores up to 50 entries under localStorage key `sp_lite_qris_history`. Entries are not scoped to a user and vanish on device/browser change. The Supabase client (`src/lib/supabase.js`), `profiles` table, and an RLS own-row pattern already exist app-wide, but the QR module has no Supabase integration.

## Goal

Move QR history into Postgres so it follows the user across devices, with automatic cleanup of rows older than 14 days. Existing localStorage entries are discarded (fresh start).

## Non-goals

- Migrating existing localStorage entries into DB.
- Storing QR images in Supabase Storage (the base64 PNG is kept inline in a `text` column).
- Tags / favorites / search over history (tags remain re-parsed client-side from `qr_value` on detail open, unchanged).
- Scheduled job / pg_cron infrastructure.

## Decisions

| Decision | Choice | Why |
|---|---|---|
| Retention window | 14 days | Balances usefulness vs storage; daily-use sufficient. |
| Existing localStorage data | Discard | No valuable data lost (QRIS payloads are regenerable); avoids migration races. |
| QR image storage | Inline `text` column (`qr_data_url`, base64 PNG) | Mirrors current shape; list thumbnails load without regeneration. Rows ~3–5 KB. |
| Retention enforcement | Server-side RPC on insert | Enforced regardless of client; no scheduler needed; matches existing `ensure_profile` RPC pattern. |
| Per-user cap | Keep latest 50 | Preserves current `HISTORY_LIMIT = 50` behaviour. |

## Schema (append to `supabase/schema.sql`, idempotent)

```sql
create table if not exists public.qris_history (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
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

drop policy if exists "qris_history_own_select" on public.qris_history;
create policy "qris_history_own_select" on public.qris_history
  for select using (user_id = auth.uid());

drop policy if exists "qris_history_own_insert" on public.qris_history;
create policy "qris_history_own_insert" on public.qris_history
  for insert with check (user_id = auth.uid());

drop policy if exists "qris_history_own_delete" on public.qris_history;
create policy "qris_history_own_delete" on public.qris_history
  for delete using (user_id = auth.uid());
```

### Retention RPC

`security definer` so the prune step runs as owner; we read `auth.uid()` explicitly and fail if absent. Revoke from `anon`, grant execute to `authenticated` only.

```sql
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

  -- prune: older than 14 days OR not in this user's latest 50
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

  insert into public.qris_history
    (user_id, type, qr_value, qr_data_url, merchant_name, mpan, merchant_id, amount)
  values
    (v_user, p_type, p_qr_value, p_qr_data_url, p_merchant_name, p_mpan, p_merchant_id, p_amount)
  returning * into v_row;

  return v_row;
end;
$$;

revoke execute on function public.insert_qris_history(...) from anon;
grant  execute on function public.insert_qris_history(...) to authenticated;
```

## Client changes — `src/modules/qris/composables/useQris.js`

- Remove `HISTORY_KEY`, `HISTORY_LIMIT`, `readHistory()`, `writeHistory()`.
- Add one-time cleanup: `localStorage.removeItem('sp_lite_qris_history')` on module init.
- Import `supabase` from `@/lib/supabase.js`.
- `saveToHistory({ type, qrValue, dataUrl, highlights })` → call `supabase.rpc('insert_qris_history', { p_type:type, p_qr_value:qrValue, p_qr_data_url:dataUrl, p_merchant_name:highlights.merchantName ?? null, p_mpan:highlights.mpan ?? null, p_merchant_id:highlights.merchantId ?? null, p_amount:highlights.amount ?? null })`. On success, unshift returned row into the `history` ref. Wrap in try/catch; on failure `console.warn` and do not block the QR result already shown to the user.
- `loadHistory()` → `supabase.from('qris_history').select('*').order('created_at', { ascending:false }).limit(50)`. Assign rows into `history` ref.
- `deleteHistory(id)` → `supabase.from('qris_history').delete().eq('id', id)`, then remove from local ref on success.
- `loadHistoryDetail(id)` / `loadFromHistory(entry)` — unchanged logic; source is now DB rows.

### `id` type change

`id` moves from epoch-ms `number` to `uuid` string. Used only as `v-for` key and delete-filter equality — no numeric assumptions in UI code. Verify `QrisHistory.vue` / `QrisHistoryDetail.vue` do not coerce `id` to number (none found in exploration, but re-check during implementation).

## Files touched

| File | Change |
|---|---|
| `supabase/schema.sql` | Append `qris_history` table, index, RLS policies, `insert_qris_history` RPC. |
| `src/modules/qris/composables/useQris.js` | Replace localStorage with Supabase calls; one-time `removeItem`. |

No changes to `QrisView.vue`, `QrisHistory.vue`, `QrisHistoryDetail.vue`, `qris-core.js` — entry shape and emitted events unchanged.

## Error handling

- `saveToHistory` failure must not block QR display — the QR is already generated client-side and shown before the RPC fires. Failure is logged, not surfaced as a hard error (optional: non-blocking toast).
- `loadHistory` failure → leave `history` ref empty, log.
- Unauthenticated `saveToHistory` (no session) → RPC raises; caught by the same try/catch, logged. History write is skipped, QR still shown.

## Verification

1. Apply `schema.sql` changes; confirm table + RPC created (`\dt qris_history`, `\df insert_qris_history`).
2. Login, generate a QR → row appears in `qris_history` for that `auth.uid()`.
3. Refresh / new device login → history loads from DB.
4. Delete an entry → row removed, list updates.
5. Insert 51 rows → oldest trimmed to 50 (cap enforced).
6. Backdate a row > 14 days, insert a new one → stale row pruned.
7. Confirm a different user cannot select/insert/delete another user's rows (RLS).

## Out of scope / future

- Soft-delete / restore, export, search/filter UI.
- Move images to Supabase Storage if row growth ever matters (not expected at this scale).
- Shared/team history across roles.
