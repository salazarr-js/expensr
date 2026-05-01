# ~~Plan: Unified Batch Editor (Full Page)~~ — SUPERSEDED

> **Status:** Superseded (2026-05-01). This in-app batch editor will NOT be built. Batch operations are handled by Claude Code via the `/expensr-batch` skill instead. See [12-expensr-batch-skill/](../12-expensr-batch-skill/) and [13-claude-intermediary/](../13-claude-intermediary/).

## Original Context (historical)
Multiple batch/edit features existed separately: BatchRecordModal (create), spreadsheet mode on RecordsPage (inline edit), QuickRecord batch (parse+create). All three were removed during evaluation (2026-04-21). The plan was to merge them into one page, but the decision shifted to Claude Code as the data engine instead of in-app batch UI.

## Design

### Route
`/dashboard/batch` — full page under DashboardLayout. Replaces BatchRecordModal. Spreadsheet mode on RecordsPage can remain for quick inline edits, but the batch page is the power tool.

### Two modes
1. **Create mode** (default): empty grid, paste text or type rows, parse+save
2. **Edit mode**: load existing records from a date range or filter, edit inline, batch update

### Layout
- **Navbar**: title, account selector (shared default), Save All button, row count
- **Paste area**: textarea at top — paste bank statement or type lines, parse into rows
- **Grid**: spreadsheet-style table with all inline editable fields
- **Columns**: drag handle | date | note | tag (dropdown) | people | amount | type indicator | delete

### Paste/Import parser
- Detect bank statement format: date + description + amount (positive/negative)
- Strip banking noise ("transferencia a terceros", "pago de servicios")
- Auto-match tag from description via smart parse (name match → keyword → AI)
- Handle Argentine number format (dots for thousands, comma for decimals)
- Each parsed line becomes a row in the grid

### Inline editing
- Same pattern as spreadsheet mode: tag dropdown, note input, amount input, account dropdown
- Date: date picker per row
- People: multi-select per row (for shared expenses)
- Type: auto-detected (expense/income from sign, but overridable)

### Save
- New rows → `POST /records/batch` (existing endpoint)
- Modified rows → `POST /records/batch/update` (existing endpoint)
- Deleted rows → `POST /records/batch/delete` (existing endpoint)
- One save button, sends all three in sequence

### Entry points
- Sidebar nav item "Batch" or button in Records navbar
- "Batch" button in RecordFormModal footer (existing, redirects to route)
- "Edit in batch" from Records page (loads current filtered records into edit mode)

## Files to create
- `packages/web/src/pages/BatchEditorPage.vue` — full page component
- `packages/web/src/router/index.ts` — add `/dashboard/batch` route

## Files to modify
- `packages/web/src/layouts/DashboardLayout.vue` — add nav item
- `packages/web/src/pages/RecordsPage.vue` — "Edit in batch" button (optional)

## Dependencies
- Existing: `POST /records/batch`, `POST /records/batch/update`, `POST /records/batch/delete`
- Existing: smart parse via `doParse()` (API) or client-side tag matching
- Existing: SortableJS for drag reorder

## Implementation order
1. Create BatchEditorPage with basic grid (date, note, tag, amount, delete)
2. Add paste parser for bank statement text
3. Add edit mode (load existing records)
4. Add route + nav entry
5. Wire save (create + update + delete in one flow)

## Verification
1. Navigate to /dashboard/batch
2. Paste bank statement text → rows appear with parsed dates, amounts, tags
3. Edit tags inline, reorder, delete rows
4. Click Save → records created
5. Load existing records → edit → Save → records updated
