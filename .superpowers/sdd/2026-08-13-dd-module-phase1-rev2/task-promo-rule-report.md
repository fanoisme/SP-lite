# Task: downstream promo table is `promo_rule`, not `promo_info`

## Pre-condition note

This worktree's branch (`worktree-agent-a6829942a443275b4`) was created off `main` at `aa1200d`,
which does **not** include the DD module work — none of the target files
(`src/modules/dd/lib/schema.js`, the two `2026-08-13-dd-module-phase1*` docs) existed here.
That work lives on branch `feat/dd-module-phase1`, whose tip (`0397d73`) branches from the
same `aa1200d` commit with no divergence from this worktree's branch. I fast-forward merged
`feat/dd-module-phase1` into the worktree branch (`git merge --ff-only feat/dd-module-phase1`)
— this stayed on the same branch (no checkout/switch), just moved its tip forward by commits
that were already a strict ancestor-descendant relationship. This was necessary for the task
to be possible at all. After the fast-forward, HEAD = `0397d73` on branch
`worktree-agent-a6829942a443275b4`.

## Files and lines changed

### 1. `src/modules/dd/lib/schema.js`
- Line 46-47 (in the `promos` entry): replaced the two-line comment
  `// The sheet was promo_rule; the table downstream is promo_info.` with a single-line comment
  `// Downstream table name.`, and changed `targetTable: 'promo_info'` to `targetTable: 'promo_rule'`.

### 2. `docs/superpowers/specs/2026-08-13-dd-module-phase1-design.md`
- Line 46: "Decisions taken before this spec" downstream-mapping bullet —
  `ihybrid_discount.promo_info` → `ihybrid_discount.promo_rule`.
- Line 254: §2 schema-mapping code block — `targetTable: 'promo_info'` → `targetTable: 'promo_rule'`.
- Line 673: §5a sentence listing downstream names the sidebar shows —
  `` `discount_bu_accounts`, `merchant_whitelist`, `promo_info` `` →
  `` `discount_bu_accounts`, `merchant_whitelist`, `promo_rule` ``.

### 3. `docs/superpowers/plans/2026-08-13-dd-module-phase1-rev2.md`
- Line 22: Global Constraints downstream-mapping line — `ihybrid_discount.promo_info` →
  `ihybrid_discount.promo_rule`.
- Line 235: sentence explaining what `byTargetTable` looks up — `promo_info` → `promo_rule`.
- Line 240: `node -e` verification command — `byTargetTable('promo_info')` →
  `byTargetTable('promo_rule')`, and the assertion label `'byTargetTable promo_info'` →
  `'byTargetTable promo_rule'`.
- Line 1086: browser-check bullet 3 (Databases group table listing) — `promo_info` → `promo_rule`.
- Line 1087: browser-check bullet 4 (row-count badges) — `**0** on \`promo_info\`` →
  `**0** on \`promo_rule\``.
- Line 1097: navigation-check sentence — `Click \`promo_info\`` / `#/dd/table/promo_info` /
  titles itself `promo_info` → all changed to `promo_rule`.
- Line 1927: Task 10 bullet listing tables that must not appear —
  `` `ihybrid_discount`, `merchant_whitelist` or `promo_info` `` →
  `` `ihybrid_discount`, `merchant_whitelist` or `promo_rule` ``.

### Not changed (by design)
- `docs/superpowers/plans/2026-08-13-dd-module-phase1.md` — superseded plan, left untouched per
  instructions. It still contains 4 occurrences of `promo_info` (verified via
  `grep -c promo_info` = 4), which is expected/correct.
- Nothing under `supabase/`, `src/modules/qrdd/`, `src/lib/access.js`,
  `src/composables/useAccess.js`, or `src/App.vue` was touched.

## Verification output

### 1. `grep -rn "promo_info" src/ docs/superpowers/specs/ docs/superpowers/plans/2026-08-13-dd-module-phase1-rev2.md`
```
(no output — grep exit code 1, i.e. zero matches)
```

### 2. `grep -n "promo_rule'" src/modules/dd/lib/schema.js`
```
47:    targetTable: 'promo_rule',
```

### 3. `node -e` schema check
```
ok  promos -> promo_rule
ok  byTargetTable promo_rule resolves
ok  promo_info no longer resolves
ok  local name still does not resolve
ok  bu unchanged
ok  merchant unchanged
ok  promos db unchanged
ok  local table unchanged
ALL PASS
```

### 4. `npm run build`
```
✓ built in 19.28s
```
(full asset manifest printed, no errors/warnings other than the normal chunk-size info lines)

## Other `promo_info` references found (outside scope, not touched)

- `docs/superpowers/plans/2026-08-13-dd-module-phase1.md` — 4 occurrences. This is the
  explicitly-excluded superseded plan; left as historical record per instructions.
- No other occurrences of `promo_info` were found anywhere else in the repository
  (confirmed by the verification-1 grep scope plus a broader
  `grep -rn "promo_info" .` sanity check that only additionally matched the excluded
  phase1.md file).
