# QRDD BU Account Form UX Improvement

**Date:** 2026-07-04
**Status:** Approved
**Files:** `src/modules/qrdd/components/BuAccountForm.vue`

## Requirements

### 1. Side-by-Side Layout
Expense & Receivable form sections rendered horizontally (`grid-template-columns: 1fr 1fr`) instead of vertical stack.

### 2. Account Number Hidden
Account Number fields (`account1`, `account2`) not displayed in form. Values still passed on save (from `props.editing` in edit mode, empty string in add mode). Export unchanged — still includes account numbers.

### 3. Account Name Readonly
Account Name (`acctname1`, `acctname2`) displayed as plain text/label — not an editable input. Values from `props.editing` in edit mode, "—" placeholder in add mode.

### 4. Auto-Percentage (Two-Way, Last-Write Wins)
- User types in `percentage1` (Expense) → `percentage2` auto-calculated as `100 - percentage1`
- User types in `percentage2` (Receivable) → `percentage1` auto-calculated as `100 - percentage2`
- If user clears a field → no auto-update on the other field
- If result < 0 → calculation still applied; validation blocks save

### 5. Edit Mode: Name & SOF Readonly
In edit mode (`props.editing` is truthy), Name and SOF fields are readonly (disabled). Only percentages are editable.

In add mode (`props.editing` is null), Name and SOF are editable as before.

### 6. Validation (Unchanged)
- All fields required (except hidden account numbers)
- Both percentages > 0
- `percentage1 + percentage2` must equal 100 (0.01 tolerance)
- Inline error message if sum != 100

### 7. Export (Unchanged)
`useBuAccounts.js` `exportFiltered()` unchanged — exports all columns including account numbers.

## Implementation

Single file change: `src/modules/qrdd/components/BuAccountForm.vue`

Changes:
1. CSS: grid layout for Expense/Receivable sections
2. Template: remove account number fields, make account name readonly `<p>`, add `.disabled` to Name/SOF in edit mode
3. Script: add `watch` on percentage1/percentage2 for auto-calculation
4. Save unchanged — still emits full form object
