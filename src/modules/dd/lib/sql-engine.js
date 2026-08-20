// DD module — a hand-written SQL engine that runs entirely in the browser.
//
// DD ran this screen on AlaSQL over an in-memory copy of every sheet. SP-lite
// keeps the *model* and drops the library. Two reasons, and the second is the
// important one:
//
//  1. AlaSQL is a new dependency for one screen.
//  2. The alternative people reach for — proxying SQL to Postgres — must never
//     exist here. A passthrough runs outside RLS and outside the
//     dd_audit_row() trigger, so every guarantee the rest of the module rests
//     on would evaporate the moment someone typed a statement. Queries are
//     answered from arrays the caller already had permission to fetch, and
//     writes come back out as a list of row changes for the caller to apply
//     through ordinary PostgREST calls.
//
// Nothing in this file imports Vue or Supabase, on purpose: the whole thing is
// exercisable with plain objects.
//
// ── Deliberate divergences from MySQL ───────────────────────────────────────
//
//  - String comparison is case-insensitive for =, !=, <, >, IN and LIKE. That
//    is MySQL's default collation behaviour (utf8mb4_general_ci) and it is what
//    someone typing `WHERE status = 'active'` expects. It is NOT Postgres
//    behaviour, so a query that works here may need lowering downstream.
//  - A number compared against a numeric string compares numerically, so
//    `WHERE merchant_id = 12345` matches the varchar '12345'. Two strings
//    always compare as strings; values that are genuinely numeric arrive from
//    Supabase as JS numbers, so this only ever bites hand-typed literals.
//  - Dates and timestamps are compared as the ISO strings Supabase returns.
//    ISO-8601 sorts chronologically as text, so range predicates on
//    start_date/end_date/created_at are correct without any date parsing. A
//    non-ISO date literal ('01/03/2026') will silently not match — say ISO.
//  - '' and NULL stay distinct. lib/columns.js coerce() writes '' into
//    non-nullable text columns and null into nullable ones, so conflating them
//    would hide a real difference in the data.
//  - NULL propagation is MySQL's three-valued logic: WHERE keeps a row only
//    when the predicate is exactly true, so `WHERE col != 'X'` drops NULL rows.
//  - GROUP BY is strict (MySQL's ONLY_FULL_GROUP_BY): a non-aggregate select
//    item must be a column named in GROUP BY. Loose grouping picks an arbitrary
//    row and the person never finds out which.
//  - UPDATE and DELETE without a WHERE clause are refused outright. DD allowed
//    them because AlaSQL did; a whole-table wipe from a missing predicate is
//    not worth porting.
//  - JOIN is not implemented. AlaSQL supported it; writing a join planner for
//    three tables that are never queried together is not a good trade. The
//    parser says so by name rather than failing on a stray token.

export class SqlError extends Error {
  /**
   * @param {string} message
   * @param {number} position character offset into the statement, for the caret
   * @param {string} near     the token that tripped it, for the message
   */
  constructor(message, position = 0, near = '') {
    super(message)
    this.name = 'SqlError'
    this.position = position
    this.near = near
  }
}

// DD's exact wording. This is the load-bearing sentence of the two-axis access
// model: an ungranted table is never mounted, so naming it cannot read it, and
// the refusal has to read as "you cannot see this" rather than as a bug.
export const notAvailable = (names) =>
  `Not available in this connection: ${names.join(', ')}. `
  + 'Ask an admin for access to the database it belongs to.'

// ── Statement splitting ─────────────────────────────────────────────────────

/** Splits on semicolons while respecting quoted strings and backtick idents. */
export function splitStatements(text) {
  const out = []
  let cur = ''
  let quote = null
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (quote) {
      cur += ch
      if (ch === quote && text[i - 1] !== '\\') quote = null
    } else if (ch === "'" || ch === '"' || ch === '`') {
      quote = ch
      cur += ch
    } else if (ch === ';') {
      if (cur.trim()) out.push(cur.trim())
      cur = ''
    } else cur += ch
  }
  if (cur.trim()) out.push(cur.trim())
  return out
}

// ── Formatter ───────────────────────────────────────────────────────────────

const BREAK_KEYWORDS = [
  'SELECT', 'FROM', 'WHERE', 'GROUP BY', 'ORDER BY', 'HAVING', 'LIMIT', 'OFFSET',
  'INSERT INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE FROM', 'AND', 'OR',
]
const UPPER_KEYWORDS = BREAK_KEYWORDS.concat([
  'AS', 'ASC', 'DESC', 'DISTINCT', 'COUNT', 'SUM', 'AVG', 'MIN', 'MAX',
  'NULL', 'NOT', 'IN', 'LIKE', 'BETWEEN', 'IS',
])
const INDENTED = new Set(['AND', 'OR'])

/**
 * Cosmetic only — it never reparses, so it cannot change what a statement
 * means. DD's version also guarded plain JOIN against splitting LEFT JOIN;
 * that guard is gone with JOIN support.
 */
export function formatSql(text) {
  return splitStatements(text).map((stmt) => {
    let s = stmt.replace(/\s+/g, ' ').trim()
    UPPER_KEYWORDS.forEach((kw) => {
      const re = new RegExp('(^|[\\s(,])' + kw.replace(/ /g, '\\s+') + '(?=[\\s(,;]|$)', 'gi')
      s = s.replace(re, (m, pre) => pre + kw)
    })
    BREAK_KEYWORDS.forEach((kw) => {
      const re = new RegExp('(^|\\s)' + kw.replace(/ /g, '\\s+') + '(?=\\s|$)', 'g')
      s = s.replace(re, (m, pre) => (pre === '' ? '' : (INDENTED.has(kw) ? '\n  ' : '\n')) + kw)
    })
    return s.replace(/\n\s*\n/g, '\n').trim().replace(/;?$/, ';')
  }).join('\n\n')
}

// ── Tokeniser ───────────────────────────────────────────────────────────────

const PUNCT2 = ['<=', '>=', '!=', '<>']
const PUNCT1 = ['=', '<', '>', '(', ')', ',', '.', '*', '+', '-', '/', '%', ';']

function tokenize(sql) {
  const toks = []
  const n = sql.length
  let i = 0
  while (i < n) {
    const ch = sql[i]
    if (/\s/.test(ch)) { i++; continue }

    // Comments. `--` needs a following space or EOL in strict MySQL; nobody
    // types `5--3` here, so the looser rule is fine and less surprising.
    if ((ch === '-' && sql[i + 1] === '-') || ch === '#') {
      while (i < n && sql[i] !== '\n') i++
      continue
    }
    if (ch === '/' && sql[i + 1] === '*') {
      const end = sql.indexOf('*/', i + 2)
      if (end < 0) throw new SqlError('Unterminated /* comment', i, '/*')
      i = end + 2
      continue
    }

    // Strings. Both quote styles are string literals, as MySQL does by default;
    // a quoted *identifier* uses backticks.
    if (ch === "'" || ch === '"') {
      const start = i
      const q = ch
      let v = ''
      i++
      while (i < n) {
        if (sql[i] === '\\' && i + 1 < n) { v += sql[i + 1]; i += 2; continue }
        if (sql[i] === q) {
          if (sql[i + 1] === q) { v += q; i += 2; continue }
          i++
          toks.push({ type: 'str', value: v, pos: start, end: i })
          break
        }
        v += sql[i]
        i++
      }
      if (toks[toks.length - 1]?.pos !== start) {
        throw new SqlError('Unterminated string literal', start, q)
      }
      continue
    }

    if (ch === '`') {
      const start = i
      const end = sql.indexOf('`', i + 1)
      if (end < 0) throw new SqlError('Unterminated `identifier`', start, '`')
      const v = sql.slice(i + 1, end)
      i = end + 1
      toks.push({ type: 'ident', value: v, upper: v.toUpperCase(), quoted: true, pos: start, end: i })
      continue
    }

    if (/[0-9]/.test(ch) || (ch === '.' && /[0-9]/.test(sql[i + 1] || ''))) {
      const start = i
      while (i < n && /[0-9]/.test(sql[i])) i++
      if (sql[i] === '.') { i++; while (i < n && /[0-9]/.test(sql[i])) i++ }
      if (/[eE]/.test(sql[i] || '')) {
        i++
        if (/[+-]/.test(sql[i] || '')) i++
        while (i < n && /[0-9]/.test(sql[i])) i++
      }
      const raw = sql.slice(start, i)
      toks.push({ type: 'num', value: raw, num: Number(raw), pos: start, end: i })
      continue
    }

    if (/[A-Za-z_$]/.test(ch)) {
      const start = i
      while (i < n && /[A-Za-z0-9_$]/.test(sql[i])) i++
      const v = sql.slice(start, i)
      toks.push({ type: 'ident', value: v, upper: v.toUpperCase(), quoted: false, pos: start, end: i })
      continue
    }

    const two = sql.slice(i, i + 2)
    if (PUNCT2.includes(two)) {
      toks.push({ type: 'punct', value: two, pos: i, end: i + 2 })
      i += 2
      continue
    }
    if (PUNCT1.includes(ch)) {
      toks.push({ type: 'punct', value: ch, pos: i, end: i + 1 })
      i++
      continue
    }
    throw new SqlError(`Unexpected character "${ch}"`, i, ch)
  }
  toks.push({ type: 'eof', value: '', upper: '', pos: n, end: n })
  return toks
}

// Words that can never be a bare alias, because seeing one means the select
// list or the SET list has ended.
const CLAUSE_WORDS = new Set([
  'FROM', 'WHERE', 'GROUP', 'ORDER', 'HAVING', 'LIMIT', 'OFFSET', 'AND', 'OR',
  'ASC', 'DESC', 'ON', 'JOIN', 'INNER', 'LEFT', 'RIGHT', 'CROSS', 'FULL', 'OUTER',
  'SET', 'VALUES', 'INTO', 'NOT', 'IN', 'IS', 'LIKE', 'BETWEEN', 'AS', 'DISTINCT',
  'NULL', 'SELECT', 'INSERT', 'UPDATE', 'DELETE', 'BY',
])

const AGGREGATES = new Set(['COUNT', 'SUM', 'AVG', 'MIN', 'MAX'])
const COMPARISONS = new Set(['=', '!=', '<>', '<', '<=', '>', '>='])

// ── Parser ──────────────────────────────────────────────────────────────────

class Parser {
  constructor(sql) {
    this.sql = sql
    this.toks = tokenize(sql)
    this.i = 0
    this.aggSeq = 0
  }

  peek(k = 0) { return this.toks[Math.min(this.i + k, this.toks.length - 1)] }
  advance() { return this.toks[this.i++] }

  at(kw) {
    const t = this.peek()
    return t.type === 'ident' && !t.quoted && t.upper === kw
  }

  atPunct(p) {
    const t = this.peek()
    return t.type === 'punct' && t.value === p
  }

  eatKw(kw) { if (this.at(kw)) { this.i++; return true } return false }
  eatPunct(p) { if (this.atPunct(p)) { this.i++; return true } return false }

  expectKw(kw) { if (!this.eatKw(kw)) this.fail(`Expected ${kw}`) }
  expectPunct(p) { if (!this.eatPunct(p)) this.fail(`Expected "${p}"`) }

  fail(msg, tok = this.peek()) {
    const near = tok.type === 'eof' ? 'the end of the statement' : `"${tok.value}"`
    throw new SqlError(`${msg}, found ${near}`, tok.pos, tok.value)
  }

  /** Source text between two offsets — used to name unaliased output columns. */
  src(from, to) { return this.sql.slice(from, to).replace(/\s+/g, ' ').trim() }

  identifier(what = 'a name') {
    const t = this.peek()
    if (t.type !== 'ident') this.fail(`Expected ${what}`)
    this.i++
    return t
  }

  // ── statements ──

  parseStatement() {
    let ast
    if (this.at('SELECT')) ast = this.parseSelect()
    else if (this.at('INSERT')) ast = this.parseInsert()
    else if (this.at('UPDATE')) ast = this.parseUpdate()
    else if (this.at('DELETE')) ast = this.parseDelete()
    else if (this.at('SHOW')) ast = this.parseShow()
    else if (this.at('DESCRIBE') || this.at('DESC')) ast = this.parseDescribe()
    else this.fail('Expected SELECT, INSERT, UPDATE, DELETE, SHOW or DESCRIBE')

    this.eatPunct(';')
    if (this.peek().type !== 'eof') {
      this.fail('Expected the end of the statement')
    }
    ast.sql = this.sql
    return ast
  }

  parseShow() {
    const start = this.peek().pos
    this.expectKw('SHOW')
    this.expectKw('TABLES')
    return { action: 'SHOW', pos: start }
  }

  parseDescribe() {
    const start = this.peek().pos
    this.i++ // DESCRIBE | DESC
    return { action: 'DESCRIBE', from: this.parseTableRef(), pos: start }
  }

  /** `table`, `db.table`, backticked in either position. */
  parseTableRef() {
    const first = this.identifier('a table name')
    let db = null
    let name = first
    if (this.atPunct('.')) {
      this.i++
      db = first
      name = this.identifier('a table name')
    }
    return { name: name.value, db: db ? db.value : null, pos: first.pos }
  }

  parseSelect() {
    const start = this.peek().pos
    this.expectKw('SELECT')
    const distinct = this.eatKw('DISTINCT')
    const items = []
    do { items.push(this.parseSelectItem()) } while (this.eatPunct(','))

    let from = null
    let alias = null
    if (this.eatKw('FROM')) {
      from = this.parseTableRef()
      // `AS x` or a bare alias — anything that is not a clause keyword.
      if (this.eatKw('AS')) alias = this.identifier('a table alias').value
      else if (this.peek().type === 'ident' && !CLAUSE_WORDS.has(this.peek().upper)) {
        alias = this.advance().value
      }
      if (this.atPunct(',') || ['JOIN', 'INNER', 'LEFT', 'RIGHT', 'CROSS', 'FULL'].some(k => this.at(k))) {
        const t = this.peek()
        throw new SqlError('JOIN is not supported by this editor — query one table at a time', t.pos, t.value)
      }
    }

    const where = this.eatKw('WHERE') ? this.parseExpr() : null

    let groupBy = []
    if (this.at('GROUP')) {
      this.i++
      this.expectKw('BY')
      do { groupBy.push(this.parseExpr()) } while (this.eatPunct(','))
    }

    const having = this.eatKw('HAVING') ? this.parseExpr() : null

    const orderBy = []
    if (this.at('ORDER')) {
      this.i++
      this.expectKw('BY')
      do {
        const expr = this.parseExpr()
        let dir = 'ASC'
        if (this.eatKw('DESC')) dir = 'DESC'
        else this.eatKw('ASC')
        orderBy.push({ expr, dir })
      } while (this.eatPunct(','))
    }

    let limit = null
    let offset = null
    if (this.eatKw('LIMIT')) {
      const a = this.expectInteger('a row count after LIMIT')
      if (this.eatPunct(',')) {
        // MySQL's `LIMIT offset, count`.
        offset = a
        limit = this.expectInteger('a row count after LIMIT')
      } else {
        limit = a
      }
    }
    if (this.eatKw('OFFSET')) offset = this.expectInteger('a row count after OFFSET')

    return {
      action: 'SELECT', distinct, items, from, alias,
      where, groupBy, having, orderBy, limit, offset, pos: start,
    }
  }

  expectInteger(what) {
    const t = this.peek()
    if (t.type !== 'num' || !Number.isInteger(t.num) || t.num < 0) this.fail(`Expected ${what}`)
    this.i++
    return t.num
  }

  parseSelectItem() {
    // `*`
    if (this.atPunct('*')) { this.i++; return { kind: 'star', table: null } }
    // `t.*`
    if (this.peek().type === 'ident' && this.peek(1).type === 'punct' && this.peek(1).value === '.'
        && this.peek(2).type === 'punct' && this.peek(2).value === '*') {
      const t = this.advance().value
      this.i += 2
      return { kind: 'star', table: t }
    }
    const from = this.peek().pos
    const expr = this.parseExpr()
    const to = this.toks[this.i - 1].end
    let alias = null
    if (this.eatKw('AS')) {
      const t = this.peek()
      if (t.type !== 'ident' && t.type !== 'str') this.fail('Expected an alias after AS')
      this.i++
      alias = t.value
    } else if (this.peek().type === 'ident' && !CLAUSE_WORDS.has(this.peek().upper)) {
      alias = this.advance().value
    }
    return { kind: 'expr', expr, alias, src: this.src(from, to) }
  }

  parseInsert() {
    const start = this.peek().pos
    this.expectKw('INSERT')
    this.expectKw('INTO')
    const from = this.parseTableRef()

    let columns = null
    if (this.atPunct('(')) {
      this.i++
      columns = []
      do { columns.push(this.identifier('a column name').value) } while (this.eatPunct(','))
      this.expectPunct(')')
    }

    this.expectKw('VALUES')
    const tuples = []
    do {
      this.expectPunct('(')
      const row = []
      do { row.push(this.parseExpr()) } while (this.eatPunct(','))
      this.expectPunct(')')
      tuples.push(row)
    } while (this.eatPunct(','))

    return { action: 'INSERT', from, columns, tuples, pos: start }
  }

  parseUpdate() {
    const start = this.peek().pos
    this.expectKw('UPDATE')
    const from = this.parseTableRef()
    this.expectKw('SET')
    const set = []
    do {
      const col = this.identifier('a column name')
      this.expectPunct('=')
      set.push({ column: col.value, pos: col.pos, expr: this.parseExpr() })
    } while (this.eatPunct(','))
    const where = this.eatKw('WHERE') ? this.parseExpr() : null
    return { action: 'UPDATE', from, set, where, pos: start }
  }

  parseDelete() {
    const start = this.peek().pos
    this.expectKw('DELETE')
    this.expectKw('FROM')
    const from = this.parseTableRef()
    const where = this.eatKw('WHERE') ? this.parseExpr() : null
    return { action: 'DELETE', from, where, pos: start }
  }

  // ── expressions, lowest precedence first ──

  parseExpr() { return this.parseOr() }

  parseOr() {
    let l = this.parseAnd()
    while (this.at('OR')) { const op = this.advance(); l = { t: 'bin', op: 'OR', l, r: this.parseAnd(), pos: op.pos } }
    return l
  }

  parseAnd() {
    let l = this.parseNot()
    while (this.at('AND')) { const op = this.advance(); l = { t: 'bin', op: 'AND', l, r: this.parseNot(), pos: op.pos } }
    return l
  }

  parseNot() {
    if (this.at('NOT')) { const op = this.advance(); return { t: 'not', e: this.parseNot(), pos: op.pos } }
    return this.parsePredicate()
  }

  parsePredicate() {
    let l = this.parseAdditive()

    // IS [NOT] NULL
    if (this.at('IS')) {
      const op = this.advance()
      const negate = this.eatKw('NOT')
      this.expectKw('NULL')
      return { t: 'isnull', e: l, negate, pos: op.pos }
    }

    const negate = this.at('NOT') && (this.peek(1).upper === 'IN' || this.peek(1).upper === 'LIKE' || this.peek(1).upper === 'BETWEEN')
    if (negate) this.i++

    if (this.at('IN')) {
      const op = this.advance()
      this.expectPunct('(')
      const list = []
      do { list.push(this.parseExpr()) } while (this.eatPunct(','))
      this.expectPunct(')')
      return { t: 'in', e: l, list, negate, pos: op.pos }
    }
    if (this.at('LIKE')) {
      const op = this.advance()
      return { t: 'like', e: l, pattern: this.parseAdditive(), negate, pos: op.pos }
    }
    if (this.at('BETWEEN')) {
      const op = this.advance()
      const lo = this.parseAdditive()
      this.expectKw('AND')
      const hi = this.parseAdditive()
      return { t: 'between', e: l, lo, hi, negate, pos: op.pos }
    }
    if (negate) this.fail('Expected IN, LIKE or BETWEEN after NOT')

    const t = this.peek()
    if (t.type === 'punct' && COMPARISONS.has(t.value)) {
      this.i++
      l = { t: 'bin', op: t.value === '<>' ? '!=' : t.value, l, r: this.parseAdditive(), pos: t.pos }
    }
    return l
  }

  parseAdditive() {
    let l = this.parseMultiplicative()
    while (this.atPunct('+') || this.atPunct('-')) {
      const op = this.advance()
      l = { t: 'bin', op: op.value, l, r: this.parseMultiplicative(), pos: op.pos }
    }
    return l
  }

  parseMultiplicative() {
    let l = this.parseUnary()
    while (this.atPunct('*') || this.atPunct('/') || this.atPunct('%')) {
      const op = this.advance()
      l = { t: 'bin', op: op.value, l, r: this.parseUnary(), pos: op.pos }
    }
    return l
  }

  parseUnary() {
    if (this.atPunct('-')) { const op = this.advance(); return { t: 'neg', e: this.parseUnary(), pos: op.pos } }
    if (this.atPunct('+')) { this.i++; return this.parseUnary() }
    return this.parsePrimary()
  }

  parsePrimary() {
    const t = this.peek()

    if (t.type === 'punct' && t.value === '(') {
      this.i++
      const e = this.parseExpr()
      this.expectPunct(')')
      return e
    }
    if (t.type === 'num') { this.i++; return { t: 'lit', v: t.num, pos: t.pos } }
    if (t.type === 'str') { this.i++; return { t: 'lit', v: t.value, pos: t.pos } }

    if (t.type === 'ident') {
      // A clause keyword where a value belongs means the previous clause ended
      // early. Treating it as a column name would report "Unknown column FROM",
      // which sends the reader looking in the wrong place.
      if (!t.quoted && CLAUSE_WORDS.has(t.upper) && !['NULL', 'NOT', 'DISTINCT'].includes(t.upper)) {
        this.fail('Expected a value, a column or "("')
      }
      if (!t.quoted && t.upper === 'NULL') { this.i++; return { t: 'lit', v: null, pos: t.pos } }
      if (!t.quoted && t.upper === 'TRUE') { this.i++; return { t: 'lit', v: true, pos: t.pos } }
      if (!t.quoted && t.upper === 'FALSE') { this.i++; return { t: 'lit', v: false, pos: t.pos } }

      // Function call.
      if (this.peek(1).type === 'punct' && this.peek(1).value === '(') {
        const start = t.pos
        this.i += 2
        if (!AGGREGATES.has(t.upper)) {
          throw new SqlError(
            `"${t.value}" is not a function this editor knows. Supported: COUNT, SUM, AVG, MIN, MAX`,
            t.pos, t.value,
          )
        }
        const distinct = this.eatKw('DISTINCT')
        let arg = null
        if (this.atPunct('*')) {
          this.i++
          if (t.upper !== 'COUNT') this.fail(`${t.upper}(*) is not valid — ${t.upper} needs a column`)
        } else {
          arg = this.parseExpr()
        }
        this.expectPunct(')')
        return {
          t: 'agg', fn: t.upper, arg, distinct,
          key: `agg#${this.aggSeq++}`, pos: start, src: this.src(start, this.toks[this.i - 1].end),
        }
      }

      // Column reference, optionally qualified.
      this.i++
      if (this.atPunct('.')) {
        this.i++
        const col = this.identifier('a column name')
        return { t: 'col', qualifier: t.value, name: col.value, pos: t.pos }
      }
      return { t: 'col', qualifier: null, name: t.value, pos: t.pos }
    }

    this.fail('Expected a value, a column or "("')
  }
}

/**
 * Parses one statement. Throws SqlError with `.position` (a character offset)
 * so the editor can point at the problem instead of saying "syntax error".
 */
export function parse(sql) {
  return new Parser(String(sql ?? '')).parseStatement()
}

// ── Expression walking ──────────────────────────────────────────────────────

function walk(node, fn) {
  if (!node) return
  fn(node)
  switch (node.t) {
    case 'bin': walk(node.l, fn); walk(node.r, fn); break
    case 'not': case 'neg': case 'isnull': walk(node.e, fn); break
    case 'in': walk(node.e, fn); node.list.forEach(x => walk(x, fn)); break
    case 'like': walk(node.e, fn); walk(node.pattern, fn); break
    case 'between': walk(node.e, fn); walk(node.lo, fn); walk(node.hi, fn); break
    case 'agg': walk(node.arg, fn); break
    default: break
  }
}

/**
 * Rebuilds an expression tree, letting `fn` swap any node for another. Used
 * only to resolve output aliases; aggregate nodes are reused by reference so a
 * `COUNT(*)` named in both the select list and ORDER BY stays one aggregate.
 */
function mapExpr(node, fn) {
  if (!node) return node
  const swapped = fn(node)
  if (swapped !== node) return swapped
  switch (node.t) {
    case 'bin': return { ...node, l: mapExpr(node.l, fn), r: mapExpr(node.r, fn) }
    case 'not': case 'neg': case 'isnull': return { ...node, e: mapExpr(node.e, fn) }
    case 'in': return { ...node, e: mapExpr(node.e, fn), list: node.list.map(x => mapExpr(x, fn)) }
    case 'like': return { ...node, e: mapExpr(node.e, fn), pattern: mapExpr(node.pattern, fn) }
    case 'between': return { ...node, e: mapExpr(node.e, fn), lo: mapExpr(node.lo, fn), hi: mapExpr(node.hi, fn) }
    default: return node
  }
}

const selectExprs = (ast) => [
  ...ast.items.filter(i => i.kind === 'expr').map(i => i.expr),
  ...ast.groupBy,
  ast.having,
  ...ast.orderBy.map(o => o.expr),
  ast.where,
].filter(Boolean)

// ── Value semantics ─────────────────────────────────────────────────────────

const isNullish = (v) => v === null || v === undefined
const numeric = (v) => typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v))

/**
 * Three-valued comparison. Returns -1 / 0 / 1, or null when either side is
 * NULL — every caller has to decide what NULL means for it.
 */
function compareValues(a, b) {
  if (isNullish(a) || isNullish(b)) return null
  if (typeof a === 'boolean') a = a ? 1 : 0
  if (typeof b === 'boolean') b = b ? 1 : 0
  const an = typeof a === 'number'
  const bn = typeof b === 'number'
  if (an && bn) return a < b ? -1 : a > b ? 1 : 0
  // A typed number against a numeric string compares numerically; that is what
  // makes `merchant_id = 12345` find the varchar '12345'.
  if ((an && numeric(b)) || (bn && numeric(a))) {
    const x = Number(a)
    const y = Number(b)
    return x < y ? -1 : x > y ? 1 : 0
  }
  const x = String(a).toLowerCase()
  const y = String(b).toLowerCase()
  return x < y ? -1 : x > y ? 1 : 0
}

function likeToRegExp(pattern) {
  let out = ''
  for (const ch of String(pattern)) {
    if (ch === '%') out += '[\\s\\S]*'
    else if (ch === '_') out += '[\\s\\S]'
    else out += ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }
  return new RegExp(`^${out}$`, 'i')
}

// AND/OR over MySQL's three-valued logic. `null` is UNKNOWN.
function and3(a, b) {
  if (a === false || b === false) return false
  if (a === null || b === null) return null
  return true
}
function or3(a, b) {
  if (a === true || b === true) return true
  if (a === null || b === null) return null
  return false
}

const arith = (op, a, b) => {
  if (isNullish(a) || isNullish(b)) return null
  const x = Number(a)
  const y = Number(b)
  if (Number.isNaN(x) || Number.isNaN(y)) return null
  switch (op) {
    case '+': return x + y
    case '-': return x - y
    case '*': return x * y
    case '/': return y === 0 ? null : x / y
    case '%': return y === 0 ? null : x % y
    default: return null
  }
}

/**
 * @param node   expression AST
 * @param row    the row being evaluated, keyed by column name
 * @param aggs   precomputed aggregate values for this group, or null outside a
 *               grouped context (WHERE, INSERT VALUES)
 */
function evalExpr(node, row, aggs) {
  switch (node.t) {
    case 'lit': return node.v
    case 'col': {
      const v = row[node.name]
      return v === undefined ? null : v
    }
    case 'agg':
      if (!aggs) {
        throw new SqlError(
          'Aggregate functions are not allowed here — use HAVING instead of WHERE',
          node.pos, node.fn,
        )
      }
      return aggs[node.key]
    case 'neg': {
      const v = evalExpr(node.e, row, aggs)
      return isNullish(v) ? null : -Number(v)
    }
    case 'not': {
      const v = evalExpr(node.e, row, aggs)
      return v === null ? null : !truth(v)
    }
    case 'isnull': {
      const v = evalExpr(node.e, row, aggs)
      return node.negate ? !isNullish(v) : isNullish(v)
    }
    case 'in': {
      const v = evalExpr(node.e, row, aggs)
      if (isNullish(v)) return null
      let sawNull = false
      for (const item of node.list) {
        const c = compareValues(v, evalExpr(item, row, aggs))
        if (c === null) { sawNull = true; continue }
        if (c === 0) return !node.negate
      }
      // `x IN (1, NULL)` with no match is UNKNOWN, not false — MySQL's rule.
      return sawNull ? null : node.negate
    }
    case 'like': {
      const v = evalExpr(node.e, row, aggs)
      const p = evalExpr(node.pattern, row, aggs)
      if (isNullish(v) || isNullish(p)) return null
      const hit = likeToRegExp(p).test(String(v))
      return node.negate ? !hit : hit
    }
    case 'between': {
      const v = evalExpr(node.e, row, aggs)
      const lo = compareValues(v, evalExpr(node.lo, row, aggs))
      const hi = compareValues(v, evalExpr(node.hi, row, aggs))
      if (lo === null || hi === null) return null
      const hit = lo >= 0 && hi <= 0
      return node.negate ? !hit : hit
    }
    case 'bin': {
      if (node.op === 'AND') return and3(toBool(evalExpr(node.l, row, aggs)), toBool(evalExpr(node.r, row, aggs)))
      if (node.op === 'OR') return or3(toBool(evalExpr(node.l, row, aggs)), toBool(evalExpr(node.r, row, aggs)))
      const a = evalExpr(node.l, row, aggs)
      const b = evalExpr(node.r, row, aggs)
      if (COMPARISONS.has(node.op)) {
        const c = compareValues(a, b)
        if (c === null) return null
        switch (node.op) {
          case '=': return c === 0
          case '!=': return c !== 0
          case '<': return c < 0
          case '<=': return c <= 0
          case '>': return c > 0
          default: return c >= 0
        }
      }
      return arith(node.op, a, b)
    }
    default:
      throw new SqlError(`Cannot evaluate expression node "${node.t}"`, node.pos || 0)
  }
}

// A bare non-boolean in a predicate position (`WHERE 1`) follows MySQL: 0 and
// '' are false, everything else is true.
const truth = (v) => !(v === 0 || v === '' || v === false)
const toBool = (v) => (v === null || v === undefined ? null : (typeof v === 'boolean' ? v : truth(v)))

// ── Table resolution ────────────────────────────────────────────────────────

/**
 * @param tables `{ [name]: { name, db, columns: string[], rows: object[] } }`
 *               or a Map of the same. Only tables the caller mounted exist;
 *               there is deliberately no way to reach anything else.
 */
function tableList(tables) {
  if (!tables) return []
  return tables instanceof Map ? [...tables.values()] : Object.values(tables)
}

function resolveTable(ref, tables) {
  const hit = tableList(tables).find(t => String(t.name).toLowerCase() === ref.name.toLowerCase())
  // A wrong database qualifier is the same fact as a missing table: the person
  // named something this connection does not hold.
  if (!hit || (ref.db && String(hit.db || '').toLowerCase() !== ref.db.toLowerCase())) {
    const named = ref.db ? `${ref.db}.${ref.name}` : ref.name
    throw new SqlError(notAvailable([named]), ref.pos, ref.name)
  }
  return hit
}

function tableColumns(table) {
  if (table.columns?.length) return [...table.columns]
  const seen = []
  const set = new Set()
  for (const row of table.rows || []) {
    for (const k of Object.keys(row)) if (!set.has(k)) { set.add(k); seen.push(k) }
  }
  return seen
}

/**
 * Rewrites every column reference to the table's declared casing and rejects
 * names the table does not have. Done up front against the *declared* columns
 * rather than lazily against a row, so the error is the same on an empty table
 * as on a full one.
 */
function bindColumns(exprs, table, alias) {
  const cols = tableColumns(table)
  const byLower = new Map(cols.map(c => [c.toLowerCase(), c]))
  const qualifiers = new Set([String(table.name).toLowerCase(), ...(alias ? [alias.toLowerCase()] : [])])
  for (const expr of exprs) {
    walk(expr, (node) => {
      if (node.t !== 'col') return
      if (node.qualifier && !qualifiers.has(node.qualifier.toLowerCase())) {
        throw new SqlError(
          `"${node.qualifier}" is not the table in this query (${table.name})`,
          node.pos, node.qualifier,
        )
      }
      const real = byLower.get(node.name.toLowerCase())
      if (!real) {
        throw new SqlError(`Unknown column "${node.name}" in ${table.name}`, node.pos, node.name)
      }
      node.name = real
    })
  }
}

// ── Execution ───────────────────────────────────────────────────────────────

/**
 * Runs a parsed statement against mounted tables.
 *
 * Never mutates the mounted arrays. A write returns the change set it *would*
 * apply so the caller can show a confirmation, then apply it row by row through
 * PostgREST; nothing is committed by running a statement.
 *
 * @returns {{
 *   action: string, table: string|null, tableRef: object|null,
 *   columns: string[], rows: object[], affected: number,
 *   matched?: number, changes?: object[]
 * }}
 */
export function execute(ast, tables) {
  switch (ast.action) {
    case 'SHOW': return execShow(tables)
    case 'DESCRIBE': return execDescribe(ast, tables)
    case 'SELECT': return execSelect(ast, tables)
    case 'INSERT': return execInsert(ast, tables)
    case 'UPDATE': return execUpdate(ast, tables)
    case 'DELETE': return execDelete(ast, tables)
    default: throw new SqlError(`Unsupported statement: ${ast.action}`, ast.pos || 0)
  }
}

function execShow(tables) {
  const rows = tableList(tables).map(t => ({
    database: t.db,
    table: t.name,
    rows: (t.rows || []).length,
    columns: tableColumns(t).length,
  }))
  return {
    action: 'SHOW', table: null, tableRef: null,
    columns: ['database', 'table', 'rows', 'columns'], rows, affected: rows.length,
  }
}

function execDescribe(ast, tables) {
  const t = resolveTable(ast.from, tables)
  const sample = (t.rows || [])[0] || {}
  const rows = tableColumns(t).map(name => ({
    field: name,
    type: typeof sample[name] === 'number' ? 'NUMBER' : 'TEXT',
    sample: isNullish(sample[name]) ? 'NULL' : String(sample[name]),
  }))
  return {
    action: 'DESCRIBE', table: t.name, tableRef: t,
    columns: ['field', 'type', 'sample'], rows, affected: rows.length,
  }
}

function aggregateGroup(node, rows) {
  // COUNT(*) counts rows, including rows that are entirely NULL.
  if (node.fn === 'COUNT' && !node.arg) return rows.length
  let values = rows.map(r => evalExpr(node.arg, r, null)).filter(v => !isNullish(v))
  if (node.distinct) {
    const seen = new Set()
    values = values.filter((v) => {
      const k = typeof v === 'string' ? v.toLowerCase() : v
      if (seen.has(k)) return false
      seen.add(k)
      return true
    })
  }
  switch (node.fn) {
    case 'COUNT': return values.length
    // SUM/AVG over nothing is NULL in SQL, not 0 — the distinction matters when
    // the result feeds a HAVING.
    case 'SUM': return values.length ? values.reduce((a, v) => a + Number(v), 0) : null
    case 'AVG': return values.length ? values.reduce((a, v) => a + Number(v), 0) / values.length : null
    case 'MIN': return values.length ? values.reduce((a, v) => (compareValues(v, a) < 0 ? v : a)) : null
    case 'MAX': return values.length ? values.reduce((a, v) => (compareValues(v, a) > 0 ? v : a)) : null
    default: return null
  }
}

function execSelect(ast, tables) {
  // HAVING and ORDER BY may name a select-list alias — `ORDER BY merchants` for
  // `COUNT(*) AS merchants`. MySQL allows it and it is how anyone writes a
  // grouped query, so the alias is substituted for the expression it names
  // before anything else looks at those clauses.
  const aliases = new Map()
  ast.items.forEach((it) => {
    if (it.kind === 'expr' && it.alias) aliases.set(it.alias.toLowerCase(), it.expr)
  })
  if (aliases.size) {
    const sub = n => (n.t === 'col' && !n.qualifier && aliases.has(n.name.toLowerCase())
      ? aliases.get(n.name.toLowerCase())
      : n)
    if (ast.having) ast.having = mapExpr(ast.having, sub)
    ast.orderBy = ast.orderBy.map(o => ({ ...o, expr: mapExpr(o.expr, sub) }))
  }

  const table = ast.from ? resolveTable(ast.from, tables) : null
  if (table) {
    bindColumns(selectExprs(ast), table, ast.alias)
  } else {
    if (ast.items.some(i => i.kind === 'star')) {
      throw new SqlError('SELECT * needs a FROM clause', ast.pos)
    }
    // Without a FROM there is nothing for a column name to mean, and silently
    // yielding NULL would read as "that column is empty".
    selectExprs(ast).forEach(e => walk(e, (n) => {
      if (n.t === 'col') throw new SqlError(`"${n.name}" needs a FROM clause`, n.pos, n.name)
    }))
  }

  // No FROM means one synthetic empty row, so `SELECT 1 + 1` works.
  const source = table ? (table.rows || []) : [{}]
  const filtered = ast.where ? source.filter(r => evalExpr(ast.where, r, null) === true) : source.slice()

  // Keyed, because alias substitution can put the same aggregate node in the
  // select list and in ORDER BY and it must only be computed once.
  const aggMap = new Map()
  selectExprs(ast).forEach(e => walk(e, (n) => { if (n.t === 'agg') aggMap.set(n.key, n) }))
  const aggs = [...aggMap.values()]
  const grouped = ast.groupBy.length > 0 || aggs.length > 0

  if (grouped && ast.items.some(i => i.kind === 'star')) {
    throw new SqlError('SELECT * cannot be combined with GROUP BY or an aggregate', ast.pos)
  }

  // ONLY_FULL_GROUP_BY: every non-aggregate select item must be a column that
  // GROUP BY names, or a constant. Otherwise the engine would be picking a row
  // out of the group at random and never saying so.
  if (grouped) {
    const groupedNames = new Set(ast.groupBy.filter(g => g.t === 'col').map(g => g.name.toLowerCase()))
    for (const item of ast.items) {
      let hasAgg = false
      const bareCols = []
      walk(item.expr, (n) => {
        if (n.t === 'agg') hasAgg = true
        if (n.t === 'col') bareCols.push(n)
      })
      if (hasAgg) continue
      const bad = bareCols.find(c => !groupedNames.has(c.name.toLowerCase()))
      if (bad) {
        throw new SqlError(
          `"${bad.name}" must appear in GROUP BY or inside an aggregate`,
          bad.pos, bad.name,
        )
      }
    }
  }

  // A "context" is one output row's evaluation environment: a representative
  // source row for the grouped columns plus that group's aggregate values.
  let contexts
  if (!grouped) {
    contexts = filtered.map(row => ({ row, aggs: null }))
  } else if (!ast.groupBy.length) {
    contexts = [{ row: filtered[0] || {}, aggs: null, rows: filtered }]
  } else {
    const buckets = new Map()
    for (const row of filtered) {
      const key = JSON.stringify(ast.groupBy.map(g => {
        const v = evalExpr(g, row, null)
        return typeof v === 'string' ? v.toLowerCase() : v
      }))
      if (!buckets.has(key)) buckets.set(key, { row, aggs: null, rows: [] })
      buckets.get(key).rows.push(row)
    }
    contexts = [...buckets.values()]
  }
  if (grouped) {
    for (const ctx of contexts) {
      ctx.aggs = {}
      for (const node of aggs) ctx.aggs[node.key] = aggregateGroup(node, ctx.rows)
    }
  }

  if (ast.having) {
    if (!grouped) throw new SqlError('HAVING needs GROUP BY or an aggregate', ast.pos)
    contexts = contexts.filter(ctx => evalExpr(ast.having, ctx.row, ctx.aggs) === true)
  }

  // Output column names. Duplicates get a suffix because a row is a plain
  // object here and two columns cannot share a key.
  const names = []
  const plan = []
  const taken = new Set()
  const push = (base, getter) => {
    let name = base
    let n = 2
    while (taken.has(name)) name = `${base}_${n++}`
    taken.add(name)
    names.push(name)
    plan.push({ name, getter })
  }
  for (const item of ast.items) {
    if (item.kind === 'star') {
      for (const c of tableColumns(table)) push(c, ctx => (ctx.row[c] === undefined ? null : ctx.row[c]))
    } else {
      const base = item.alias || (item.expr.t === 'col' ? item.expr.name : (item.expr.src || item.src || 'expr'))
      push(base, ctx => evalExpr(item.expr, ctx.row, ctx.aggs))
    }
  }

  let projected = contexts.map((ctx) => {
    const out = {}
    for (const p of plan) out[p.name] = p.getter(ctx)
    return { out, ctx }
  })

  if (ast.distinct) {
    const seen = new Set()
    projected = projected.filter(({ out }) => {
      const k = JSON.stringify(names.map(n => out[n]))
      if (seen.has(k)) return false
      seen.add(k)
      return true
    })
  }

  if (ast.orderBy.length) {
    const byLower = new Map(names.map(n => [n.toLowerCase(), n]))
    const terms = ast.orderBy.map(({ expr, dir }) => {
      // An output alias wins over a source column, which is how
      // `ORDER BY merchants DESC` resolves against `COUNT(*) AS merchants`.
      if (expr.t === 'col' && byLower.has(expr.name.toLowerCase())) {
        const key = byLower.get(expr.name.toLowerCase())
        return { dir, get: ({ out }) => out[key] }
      }
      if (expr.t === 'lit' && Number.isInteger(expr.v) && expr.v >= 1 && expr.v <= names.length) {
        const key = names[expr.v - 1]
        return { dir, get: ({ out }) => out[key] }
      }
      return { dir, get: ({ ctx }) => evalExpr(expr, ctx.row, ctx.aggs) }
    })
    projected.sort((a, b) => {
      for (const t of terms) {
        const av = t.get(a)
        const bv = t.get(b)
        // MySQL sorts NULL first ascending, last descending.
        if (isNullish(av) && isNullish(bv)) continue
        if (isNullish(av)) return t.dir === 'ASC' ? -1 : 1
        if (isNullish(bv)) return t.dir === 'ASC' ? 1 : -1
        const c = compareValues(av, bv)
        if (c) return t.dir === 'ASC' ? c : -c
      }
      return 0
    })
  }

  const from = ast.offset || 0
  const to = ast.limit == null ? projected.length : from + ast.limit
  const rows = projected.slice(from, to).map(p => p.out)

  return {
    action: 'SELECT', table: table?.name ?? null, tableRef: table,
    columns: names, rows, affected: rows.length,
  }
}

function execInsert(ast, tables) {
  const table = resolveTable(ast.from, tables)
  const cols = tableColumns(table)
  const byLower = new Map(cols.map(c => [c.toLowerCase(), c]))

  const target = (ast.columns ?? cols).map((name) => {
    const real = byLower.get(String(name).toLowerCase())
    if (!real) throw new SqlError(`Unknown column "${name}" in ${table.name}`, ast.from.pos, name)
    return real
  })

  // `INSERT ... VALUES (other_column)` has no row to read from, so a column
  // reference here is always a mistake rather than something to evaluate.
  ast.tuples.forEach(tuple => tuple.forEach(e => walk(e, (n) => {
    if (n.t === 'col') {
      throw new SqlError(`VALUES takes literals — "${n.name}" is a column`, n.pos, n.name)
    }
  })))

  const rows = ast.tuples.map((tuple) => {
    if (tuple.length !== target.length) {
      throw new SqlError(
        `VALUES has ${tuple.length} value(s) but ${target.length} column(s) were named`,
        tuple[0]?.pos ?? ast.pos,
      )
    }
    const row = {}
    // Columns not named are simply absent, so the table's own defaults apply
    // when the caller sends the row to Postgres.
    target.forEach((name, i) => { row[name] = evalExpr(tuple[i], {}, null) })
    return row
  })

  return {
    action: 'INSERT', table: table.name, tableRef: table,
    columns: target, rows, affected: rows.length, matched: rows.length,
    changes: rows.map(after => ({ after })),
  }
}

function requireWhere(ast) {
  if (ast.where) return
  throw new SqlError(
    `${ast.action} without a WHERE clause would touch every row in ${ast.from.name}. `
    + 'Add a WHERE clause naming the rows you mean.',
    ast.pos,
  )
}

const sameValue = (a, b) => a === b || (isNullish(a) && isNullish(b))

function execUpdate(ast, tables) {
  requireWhere(ast)
  const table = resolveTable(ast.from, tables)
  const cols = tableColumns(table)
  const byLower = new Map(cols.map(c => [c.toLowerCase(), c]))

  bindColumns([ast.where, ...ast.set.map(s => s.expr)], table, null)
  const assignments = ast.set.map((s) => {
    const real = byLower.get(s.column.toLowerCase())
    if (!real) throw new SqlError(`Unknown column "${s.column}" in ${table.name}`, s.pos, s.column)
    return { column: real, expr: s.expr }
  })

  const matched = (table.rows || []).filter(r => evalExpr(ast.where, r, null) === true)
  const changes = []
  for (const before of matched) {
    const after = { ...before }
    const set = {}
    for (const a of assignments) {
      // Evaluated against `after`, so `SET a = 1, b = a` sees the new a. That is
      // MySQL's left-to-right rule, and it is the opposite of Postgres's.
      const v = evalExpr(a.expr, after, null)
      set[a.column] = v
      after[a.column] = v
    }
    // A row whose values are already what the SET asks for is dropped: sending
    // it would be a request that changes nothing and writes no audit rows.
    if (Object.keys(set).some(k => !sameValue(before[k], set[k]))) changes.push({ before, after, set })
  }

  return {
    action: 'UPDATE', table: table.name, tableRef: table,
    columns: cols, rows: changes.map(c => c.after),
    affected: changes.length, matched: matched.length, changes,
  }
}

function execDelete(ast, tables) {
  requireWhere(ast)
  const table = resolveTable(ast.from, tables)
  bindColumns([ast.where], table, null)
  const matched = (table.rows || []).filter(r => evalExpr(ast.where, r, null) === true)
  return {
    action: 'DELETE', table: table.name, tableRef: table,
    columns: tableColumns(table), rows: matched,
    affected: matched.length, matched: matched.length,
    changes: matched.map(before => ({ before })),
  }
}

export const WRITE_ACTIONS = new Set(['INSERT', 'UPDATE', 'DELETE'])
export const isWrite = (action) => WRITE_ACTIONS.has(action)
