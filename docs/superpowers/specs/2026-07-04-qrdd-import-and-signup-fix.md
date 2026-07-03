# QRDD Import Tool & Signup Fix

## 1. Overview

Two changes in one delivery:
1. **QRDD Import tab** — reusable Excel import with per-sheet preview, validation, and upsert
2. **Signup form fix** — fullName + username mandatory, correct field order

---

## 2. QRDD Import Tab

### 2.1 Architecture

```
New files:
  src/modules/qrdd/composables/useImport.js      — parse, validate, bulk upsert
  src/modules/qrdd/components/ImportTab.vue       — upload UI, preview, progress
  src/modules/qrdd/components/ImportPreviewCard.vue — one card per sheet

Modified files:
  src/modules/qrdd/views/QrddView.vue             — add "Import" tab
  src/modules/qrdd/composables/useBuAccounts.js   — add bulkUpsert()
  src/modules/qrdd/composables/useMerchantWhitelist.js — add bulkUpsert()
  src/modules/qrdd/composables/usePromoRule.js    — add bulkUpsert()
  supabase/schema.sql                             — drop idx_qrdd_bu_accounts_name,
                                                    add unique(name, sof, account1)
```

No new dependencies. `xlsx` already installed.

### 2.2 Data Flow

1. User drops/picks Excel file
2. `xlsx` reads all sheets client-side
3. Sheets matched by name: `discount_bu_accounts`, `merchant_whitelist`, `promo_rule`
4. Columns matched by header name (position-independent)
5. Rows validated (required fields, FK refs, value ranges, duplicate match keys within file)
6. Pre-query existing DB rows by match keys → split into INSERT list vs UPDATE list
7. Preview cards show: sheet name, row count, new/update/error breakdown
8. User clicks "Import All" → inserts in FK order (BU → merchants → promos), 50 rows per batch
9. Progress bar, per-table success toast

### 2.3 Sheet Mapping

#### discount_bu_accounts → qrdd_bu_accounts

| Excel Column | DB Column | Notes |
|---|---|---|
| name | name | trim, required |
| sof | sof | required, PRIME or PAYLATER |
| account1 | account1 | trim, required |
| acctname1 | acctname1 | trim, required |
| percentage1 | percentage1 | already decimal (0.5000), no ÷100 |
| account2 | account2 | trim, required |
| acctname2 | acctname2 | trim, required |
| percentage2 | percentage2 | already decimal |
| — | — | Validate: p1 + p2 = 1.0000 |

Ignore: created_datetime, last_modified

**Upsert match key:** `(name, sof, account1)`

DB change: drop unique index on `(name)` only, add unique on `(name, sof, account1)`

#### merchant_whitelist → qrdd_merchant_whitelist

| Excel Column | DB Column | Notes |
|---|---|---|
| merchant_id | merchant_id | force text (prevent Excel number corruption), trim, required |
| merchant_name | merchant_name | trim, required |
| bu_name | bu_name | required, must exist in BU accounts or in this batch |
| status | status | default ACTIVE, ACTIVE/INACTIVE only |
| — | created_by | `profile.full_name` (not email) |
| — | updated_by | `profile.full_name` |

Ignore: created_time, updated_time

**Upsert match key:** `merchant_id`

#### promo_rule → qrdd_promo_rules

| Excel Column | DB Column | Notes |
|---|---|---|
| promo_id | promo_id | trim, required |
| promo_name | promo_name | trim, required |
| merchant_id | merchant_id | string "NULL" → null, else validate exists |
| bu_name | bu_name | required, must exist |
| start_date | start_date | parse date, required |
| end_date | end_date | parse date, required, ≥ start_date |
| prm_discount_type | prm_discount_type | PERCENTAGE or FIXED |
| prm_discount_value | prm_discount_value | numeric, ≥ 0 |
| prm_max_discount | prm_max_discount | already sentinel 50000000000.00 for unlimited |
| pl_discount_type | pl_discount_type | PERCENTAGE or FIXED |
| pl_discount_value | pl_discount_value | numeric, ≥ 0 |
| pl_max_discount | pl_max_discount | already sentinel |
| min_txn_amount | min_txn_amount | 1.00 = no minimum |
| max_txn_amount | max_txn_amount | "NULL" → null |
| budget_amount | budget_amount | "NULL" → null |
| priority | priority | integer, default 0 |
| status | status | ACTIVE or INACTIVE |
| — | created_by | `profile.full_name` |
| — | updated_by | `profile.full_name` |

**Upsert match key:** `promo_id` (PK)

### 2.4 Validation Rules

**Pre-import (block entirely):**
- `profile.full_name` must be set, else: "Set your full name in Profile before importing"
- At least one recognized sheet with ≥1 row

**Per-sheet (shown in preview, row marked as error):**
- Required field empty
- merchant_id: no digit count check — can be any alphanumeric, any length
- bu_name not found in DB and not in current batch
- Duplicate match key within the same Excel sheet
- Percentage pair doesn't sum to 100% (BU accounts)
- sof not PRIME/PAYLATER
- discount_type not PERCENTAGE/FIXED
- end_date < start_date

**Runtime (skip single row, continue batch):**
- FK violation from wrong insert order (should not happen)
- Unique constraint (should be caught in pre-validation)

### 2.5 Batch Strategy

- 50 rows per Supabase call
- FK order enforced: BU accounts → merchants → promos
- Per-table: pre-query existing rows by match keys, split INSERT vs UPDATE
- INSERT: `.insert()` with deduplicated rows
- UPDATE: `.upsert()` or per-row `.update()`
- Partial success OK — per-table toast: "BU: 20 inserted, 4 updated, 0 skipped"

### 2.6 UI Layout

Import tab added to QRDD pill tabs as last tab: **"Import"** icon `upload`.

```
┌──────────────────────────────────────────────────┐
│  Import tab                                       │
│                                                    │
│  [Drop zone / File picker]                         │
│  "Drop Direct Discount.xlsx here or click"         │
│                                                    │
│  ── After file loaded ──                           │
│                                                    │
│  Sheet Preview Cards (3 cards):                    │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐           │
│  │ BU Acc   │ │ Merchants│ │ Promo    │           │
│  │ 24 rows  │ │ 1,927    │ │ 365      │           │
│  │ ↻ 4 upd  │ │ ↻ 127 upd│ │ ↻ 15 upd │           │
│  │ ✓ 20 new │ │ ✓ 1,800  │ │ ✓ 350    │           │
│  │ ✗ 0 err  │ │ ✗ 0 err  │ │ ✗ 0 err  │           │
│  └──────────┘ └──────────┘ └──────────┘           │
│                                                    │
│  ── Click card to expand details ──                │
│  ┌──────────────────────────────────────────────┐  │
│  │ Preview table (first 5 rows)                  │  │
│  │ + full error list                             │  │
│  └──────────────────────────────────────────────┘  │
│                                                    │
│  [Import All] button                               │
│  Progress: ████████████░░░░ 67%                    │
└──────────────────────────────────────────────────┘
```

### 2.7 Responsive Design

Import tab follows same responsive patterns as other QRDD tabs and pages:
- Preview cards: 3-column grid on desktop (≥1024px), stack vertically on tablet/mobile
- Drop zone: full width, min-height reduces on mobile
- Preview table: horizontal scroll on overflow, sticky first column
- Font sizes, padding, gaps scale down via existing CSS custom properties
- Uses existing `--space-*`, `--radius-*`, `--font-*` tokens — no hardcoded pixel values

### 2.8 Empty & Edge States

- Sheet missing from file → skip, no error
- All sheets 0 rows → "No data found in file"
- DB already populated → preview shows "↻" counts for existing matches
- User has errors → "Import All" disabled if any error rows exist

---

## 3. Signup Form Fix

### 3.1 Changes

File: `src/modules/auth/views/LoginView.vue`

| Current | New |
|---|---|
| Username label: "Username (opsional)" | "Username" (no optional badge) |
| No full name field | Full Name field, first in order |
| Field order: email, username, password | Full Name, email, username, password |
| signUp({ email, password, username }) | signUp({ email, password, username, fullName }) |

### 3.2 Validation (client-side)

| Field | Rule |
|---|---|
| Full Name | required, trim, min 1 char |
| Email | required, valid email |
| Username | required, 3-32 chars, `[a-z0-9._-]` only |
| Password | required |

### 3.3 `useAuth.signUp()` signature

Already accepts `fullName` parameter — no change to `useAuth.js` needed. Just pass it from LoginView.

---

## 4. DB Migration

```sql
-- Drop old unique on name only (allows only one row per BU name)
drop index if exists idx_qrdd_bu_accounts_name;

-- New composite unique: one BU name can have both PRIME and PAYLATER rows
create unique index if not exists idx_qrdd_bu_accounts_name_sof_acct1
  on public.qrdd_bu_accounts (name, sof, account1);
```

Apply via Supabase migration file.

---

## 5. Self-Review

- No placeholders or TBD
- Import and signup are independent — can be built separately
- DB migration must run before import of multi-SOF BU accounts
- `created_by`/`updated_by` uses `profile.full_name` consistently across all 3 tables
- Signup form field order: Full Name, Email, Username, Password
