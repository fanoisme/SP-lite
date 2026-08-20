import { ref, computed, watch, onUnmounted } from 'vue'
import { supabase } from '@/lib/supabase.js'
import { useAuth } from '@/composables/useAuth.js'
import { useToast } from '@lib/composables/useToast.js'
import { DD_TABLES } from '../lib/schema.js'
import { columns, primaryKey, searchableColumns, coerce, editableColumns } from '../lib/columns.js'
import { validateRow } from '../lib/validate.js'
import { nowWib } from '../lib/format.js'

const SEARCH_DEBOUNCE_MS = 250
const DEFAULT_PAGE_SIZE = 25

// Rows per insert batch during a bulk upload. PostgREST accepts far more, but a
// smaller batch means a constraint violation reports a narrower set of rows and
// the progress bar actually moves.
const BULK_BATCH = 50

/**
 * One server-side paged, server-side filtered CRUD surface over any of the
 * three DD-managed tables.
 *
 * The qrdd composables it replaces pulled every row into the browser and paged
 * in a computed. That is fine at 24 rows and wrong at 24,000, and it also meant
 * the row count on screen was whatever had been fetched rather than what exists.
 * Everything here — search, sort, filter, count — is done by Postgres.
 *
 * @param {'bu_accounts'|'merchants'|'promos'} tableId
 */
export function useDdTable(tableId, options = {}) {
  const meta = DD_TABLES[tableId]
  if (!meta) throw new Error(`useDdTable: unknown table "${tableId}"`)

  const localTable = meta.local
  const pk = primaryKey(tableId)
  const cols = columns(tableId)
  const { session, profile } = useAuth()
  const toast = useToast()

  const rows = ref([])
  const loading = ref(true)
  const error = ref(null)
  const total = ref(0)
  const saving = ref(false)

  const currentPage = ref(1)
  const pageSize = ref(options.pageSize ?? DEFAULT_PAGE_SIZE)

  const search = ref('')
  // '' searches every text and enum column at once.
  const searchColumn = ref('')
  // { column: value } equality filters, e.g. { status: 'ACTIVE' }.
  const filters = ref({})

  // { column: { gte, lte, gt, lt } } range filters, e.g. an expiring-soon
  // window as { end_date: { gte: today, lte: today30 } }. Separate from
  // `filters` because equality and range cannot share one value shape, and
  // folding a range into the client would make `total` and the pager lie about
  // a set Postgres never narrowed.
  const rangeFilters = ref({})

  const sortKey = ref(options.sortKey ?? (cols.some(c => c.name === 'updated_at') ? 'updated_at' : pk))
  const sortAsc = ref(options.sortAsc ?? false)

  const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)))

  // The person doing the writing. The audit trigger derives its own actor
  // server-side from auth.uid(); these two columns are the tables' own
  // pre-existing convention and are kept for continuity, not for trust.
  const actor = computed(() =>
    profile.value?.full_name || session.value?.user?.email || 'SYSTEM',
  )

  // Discards out-of-order responses. Fast typing must never leave an older
  // result rendered after a newer request has already answered.
  let seq = 0
  let searchTimer = null

  watch(currentPage, () => load())
  watch([sortKey, sortAsc, filters, rangeFilters, searchColumn, pageSize], () => {
    if (currentPage.value !== 1) currentPage.value = 1
    else load()
  }, { deep: true })

  watch(search, () => {
    clearTimeout(searchTimer)
    searchTimer = setTimeout(() => {
      if (currentPage.value !== 1) currentPage.value = 1
      else load()
    }, SEARCH_DEBOUNCE_MS)
  })

  function applyFilters(q) {
    Object.entries(filters.value).forEach(([col, value]) => {
      if (value === '' || value == null) return
      q = q.eq(col, value)
    })

    Object.entries(rangeFilters.value).forEach(([col, bounds]) => {
      if (!bounds) return
      ;['gte', 'lte', 'gt', 'lt'].forEach((op) => {
        const v = bounds[op]
        if (v === '' || v == null) return
        q = q[op](col, v)
      })
    })

    const term = search.value.trim()
    if (term) {
      // Commas and parentheses are PostgREST `or` syntax; a literal one typed
      // into the box would otherwise break the whole filter expression.
      const safe = term.replace(/[,()]/g, ' ')
      const targets = searchColumn.value ? [searchColumn.value] : searchableColumns(tableId)
      q = q.or(targets.map(c => `${c}.ilike.%${safe}%`).join(','))
    }
    return q
  }

  async function load() {
    const mySeq = ++seq
    loading.value = true
    error.value = null
    const from = (currentPage.value - 1) * pageSize.value
    const to = from + pageSize.value - 1
    try {
      let q = supabase.from(localTable).select('*', { count: 'exact' })
      q = applyFilters(q)
      // A stable tiebreak on the primary key: without it two rows sharing an
      // updated_at can swap places between pages and one of them is never seen.
      q = q.order(sortKey.value, { ascending: sortAsc.value, nullsFirst: false })
      if (sortKey.value !== pk) q = q.order(pk, { ascending: true })

      const { data, error: e, count } = await q.range(from, to)
      if (mySeq !== seq) return
      if (e) throw e
      rows.value = data || []
      total.value = count ?? 0
      stale.value = false
      staleCount.value = 0
    } catch (e) {
      if (mySeq !== seq) return
      error.value = e.message
      rows.value = []
      total.value = 0
    } finally {
      if (mySeq === seq) loading.value = false
    }
  }

  /** Every row matching the current filters, unpaged. For export and for the
   *  bulk-upload duplicate check — never for rendering. */
  async function fetchAll() {
    let q = supabase.from(localTable).select('*')
    q = applyFilters(q)
    const { data, error: e } = await q.order(sortKey.value, { ascending: sortAsc.value })
    if (e) throw e
    return data || []
  }

  function setSort(key) {
    if (sortKey.value === key) sortAsc.value = !sortAsc.value
    else { sortKey.value = key; sortAsc.value = true }
  }

  function resetFilters() {
    search.value = ''
    searchColumn.value = ''
    filters.value = {}
    rangeFilters.value = {}
  }

  // ── Writes ───────────────────────────────────────────────────────────────

  /**
   * Form values -> a row Postgres will accept, dropping auto columns.
   *
   * `keepKey` exists because the two write shapes disagree about the primary
   * key. An UPDATE carries it in the WHERE clause, so repeating it in the SET
   * is at best redundant; an upsert has no WHERE and the key has to be in the
   * payload or the row arrives with it null. Dropping it unconditionally is how
   * a bulk upload of existing merchants produced "null value in column
   * merchant_id violates not-null constraint" for rows that plainly had one.
   */
  function toRow(values, { isNew, keepKey = false }) {
    const out = {}
    editableColumns(tableId).forEach(({ name }) => {
      if (!(name in values)) return
      if (!isNew && !keepKey && name === pk) return
      out[name] = coerce(tableId, name, values[name])
    })
    out.updated_by = actor.value
    // These columns are `timestamp` without a zone and mean WIB, so an ISO
    // string in UTC would land every edit seven hours in the past. See
    // 20260821_dd_timestamps_are_wib.sql.
    out.updated_at = nowWib()
    if (isNew) out.created_by = actor.value
    return out
  }

  // The row's identity in *business* terms, which is not its primary key. A BU
  // account has no single identifying column downstream — it is name AND sof —
  // so every place that has to decide "is this the same record?" reads
  // DD_TABLES[id].keyColumns rather than assuming one column.
  const keyOf = (row) => meta.keyColumns.map(c => String(row?.[c] ?? '').trim()).join('|')

  /** Turns a Postgres error into something a person can act on. */
  function explain(e, values) {
    if (e.code === '23505') {
      const key = keyOf(values) || 'That record'
      return `"${key}" already exists`
    }
    if (e.code === '23503') {
      if (tableId === 'promos') return 'That BU or merchant does not exist yet — add it first'
      if (tableId === 'merchants') return 'That BU does not exist yet — add it first'
      return 'A referenced record does not exist yet'
    }
    if (e.code === '23514') return 'A value is outside what this column allows'
    return e.message
  }

  async function createRow(values) {
    const problems = validateRow(tableId, values)
    if (problems.length) { toast.error(problems[0]); return { ok: false, problems } }

    saving.value = true
    try {
      const { error: e } = await supabase.from(localTable).insert(toRow(values, { isNew: true }))
      if (e) { toast.error(explain(e, values)); return { ok: false, problems: [explain(e, values)] } }
      toast.success(`${meta.label.replace(/s$/, '')} created`)
      await load()
      return { ok: true }
    } finally {
      saving.value = false
    }
  }

  async function updateRow(keyValue, values) {
    const problems = validateRow(tableId, { ...values, [pk]: keyValue })
    if (problems.length) { toast.error(problems[0]); return { ok: false, problems } }

    saving.value = true
    try {
      const { error: e } = await supabase
        .from(localTable)
        .update(toRow(values, { isNew: false }))
        .eq(pk, keyValue)
      if (e) { toast.error(explain(e, values)); return { ok: false, problems: [explain(e, values)] } }
      toast.success(`${meta.label.replace(/s$/, '')} updated`)
      await load()
      return { ok: true }
    } finally {
      saving.value = false
    }
  }

  async function deleteRow(keyValue) {
    saving.value = true
    try {
      const { error: e } = await supabase.from(localTable).delete().eq(pk, keyValue)
      if (e) {
        // A promo still pointing at this merchant, or a merchant at this BU.
        toast.error(e.code === '23503'
          ? 'Something still references this record — remove it first'
          : e.message)
        return { ok: false }
      }
      toast.success('Deleted')
      // Deleting the last row of the last page would otherwise strand the view
      // on a page that no longer exists.
      if (rows.value.length === 1 && currentPage.value > 1) currentPage.value -= 1
      else await load()
      return { ok: true }
    } finally {
      saving.value = false
    }
  }

  /**
   * Bulk insert-or-update, keyed on the table's business key. Rows are
   * validated first and an invalid row is reported rather than sent, so a
   * single bad line in a spreadsheet does not abort the batch it sits in.
   *
   * @param {object[]} incoming column-keyed rows
   * @param {(done:number,ofTotal:number)=>void} [onProgress]
   */
  /**
   * @param {object[]} incoming column-keyed rows
   * @param {(done:number,ofTotal:number)=>void} [onProgress]
   * @param {{ allowUpdate?: boolean }} [opts] when false (the default) a row
   *   whose key already exists is refused rather than overwritten. Bulk upload
   *   is how records are *added*; quietly rewriting a merchant someone else
   *   registered is not something a file drop should be able to do by accident.
   */
  async function bulkUpsert(incoming, onProgress, opts = {}) {
    const allowUpdate = opts.allowUpdate === true
    const keyCols = meta.keyColumns
    const results = { inserted: 0, updated: 0, skipped: 0, errors: [] }

    // The caller's index is carried alongside every row for the whole run, so
    // an error raised in the third insert batch can still name the line of the
    // file it came from. Recovering it afterwards from the key is guesswork.
    let valid = []
    incoming.forEach((row, i) => {
      const line = i + 1
      const problems = validateRow(tableId, row)
      if (problems.length) {
        results.skipped++
        results.errors.push({ line, key: keyOf(row), problems })
      } else {
        valid.push({ row, line })
      }
    })

    if (!valid.length) return results

    // Which keys already exist, read in pages. PostgREST caps an unbounded
    // response at 1000 rows, and an unpaged read here silently reported every
    // row past the first thousand as new — which is how a merchant that plainly
    // existed ended up on the insert path and came back as "already exists".
    // These counts are for the report only; correctness no longer rests on them,
    // because the write below is a real upsert.
    const taken = new Set()
    const PAGE = 1000
    for (let from = 0; ; from += PAGE) {
      const { data, error: e } = await supabase
        .from(localTable)
        .select(keyCols.join(','))
        .range(from, from + PAGE - 1)
      if (e) break
      ;(data || []).forEach(r => taken.add(keyOf(r)))
      if (!data || data.length < PAGE) break
    }

    if (!allowUpdate) {
      const refused = valid.filter(({ row }) => taken.has(keyOf(row)))
      refused.forEach(({ row, line }) => {
        results.skipped++
        results.errors.push({
          line, key: keyOf(row),
          problems: [`"${keyOf(row)}" is already registered — edit it on the screen, or tick "update rows that already exist"`],
        })
      })
      valid = valid.filter(({ row }) => !taken.has(keyOf(row)))
      if (!valid.length) return results
    }

    let done = 0
    const tick = () => onProgress?.(++done, valid.length)

    // `on conflict (business key) do update` in one statement, so a row that
    // already exists updates instead of raising 23505. The previous version
    // split the set itself and sent plain inserts, which meant one pre-existing
    // row failed the whole batch — and, worse, the batch error was then attached
    // to all fifty rows in it, naming forty-nine that were never at fault.
    const conflict = keyCols.join(',')
    for (let i = 0; i < valid.length; i += BULK_BATCH) {
      const slice = valid.slice(i, i + BULK_BATCH)
      const payload = slice.map(({ row }) => toRow(row, { isNew: !taken.has(keyOf(row)), keepKey: true }))
      const { error: e } = await supabase
        .from(localTable)
        .upsert(payload, { onConflict: conflict })

      if (e) {
        // Something in this batch is genuinely wrong — a bad foreign key, a
        // failed CHECK. Retry row by row so the report blames the row that
        // actually failed instead of everything sharing its batch.
        for (const { row, line } of slice) {
          const { error: rowErr } = await supabase
            .from(localTable)
            .upsert([toRow(row, { isNew: !taken.has(keyOf(row)), keepKey: true })], { onConflict: conflict })
          if (rowErr) results.errors.push({ line, key: keyOf(row), problems: [explain(rowErr, row)] })
          else if (taken.has(keyOf(row))) results.updated++
          else results.inserted++
          tick()
        }
        continue
      }

      slice.forEach(({ row }) => {
        if (taken.has(keyOf(row))) results.updated++
        else results.inserted++
      })
      slice.forEach(tick)
    }

    if (results.inserted || results.updated) await load()
    return results
  }

  // ── Live change awareness ────────────────────────────────────────────────
  //
  // dd_audit_log is in the supabase_realtime publication, and every write to
  // the three managed tables writes to it through a trigger. Subscribing to the
  // log rather than to the tables means one channel shape serves all three and
  // the payload already says who did it.

  const stale = ref(false)
  const staleCount = ref(0)
  const staleBy = ref('')
  let channel = null

  function subscribe() {
    if (channel) return
    const myId = session.value?.user?.id
    channel = supabase
      .channel(`dd-changes-${tableId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'dd_audit_log',
        filter: `table_id=eq.${tableId}`,
      }, ({ new: entry }) => {
        // Our own writes already reloaded this view. The same person in a
        // second tab is therefore not flagged — an accepted miss, since the
        // banner exists to warn about *other* people's edits.
        if (entry.actor_id && entry.actor_id === myId) return
        stale.value = true
        staleCount.value++
        staleBy.value = entry.actor || ''
      })
      .subscribe()
  }

  function unsubscribe() {
    if (!channel) return
    supabase.removeChannel(channel)
    channel = null
  }

  async function refresh() {
    stale.value = false
    staleCount.value = 0
    staleBy.value = ''
    await load()
  }

  onUnmounted(() => {
    clearTimeout(searchTimer)
    unsubscribe()
  })

  return {
    meta, tableId, pk, columns: cols, actor,
    rows, loading, saving, error, total,
    currentPage, pageSize, totalPages,
    search, searchColumn, filters, rangeFilters, sortKey, sortAsc,
    stale, staleCount, staleBy,
    load, refresh, fetchAll, setSort, resetFilters,
    createRow, updateRow, deleteRow, bulkUpsert,
    subscribe, unsubscribe,
  }
}
