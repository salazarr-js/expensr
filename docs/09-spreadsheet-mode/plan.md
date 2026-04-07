# Plan: Spreadsheet Mode for Records

## Context
Records page currently requires opening a modal to edit any field. The user wants a spreadsheet-like inline editing mode where cells are directly editable, rows have inline delete, and changes auto-save on blur with batched API calls.

## Design

### Mode toggle
- Same column header icon (check-square → grid icon) toggles between normal and spreadsheet mode
- In spreadsheet mode: cells become editable, drag handle column becomes delete button column
- Mobile: same behavior on cards — tappable fields become inline editable

### Editable fields (inline)
- **Tag** — dropdown (USelectMenu), auto-sets category
- **Note** — text input
- **Amount** — number input
- **Account** — dropdown (USelectMenu)
- Date and People stay read-only (complex inputs, rare to bulk-edit)

### Inline delete
- First column shows a red X/trash icon per row (replaces drag handle)
- Click → immediate delete with undo toast (no confirmation modal)
- Undo toast has 5s timeout, calls API on expiry

### Auto-save on blur
- When user leaves an edited cell, the change is queued locally
- Debounce 1s — if no more edits within 1s, flush all pending changes
- Pending changes shown with a subtle indicator (e.g. cell border color)
- API: new `POST /records/batch/update` endpoint accepts `[{id, fields...}]`
- On flush: one API call for all pending changes, then clear indicators
- On error: revert cell to original value, show toast

### API endpoint
`POST /records/batch/update` — partial update multiple records at once.
```
Body: [{ id: number, tagId?: number, categoryId?: number, note?: string, amount?: number, accountId?: number }]
Returns: { updated: number }
```

## Files to modify

### API
- `packages/api/src/routes/records.ts` — new `POST /records/batch/update` endpoint

### Store
- `packages/web/src/stores/records.ts` — new `batchUpdateRecords()` function

### RecordsPage
- `packages/web/src/pages/RecordsPage.vue`:
  - Spreadsheet mode state + toggle
  - Editable cell templates (tag dropdown, note input, amount input, account dropdown)
  - Pending changes map + debounced flush
  - Inline delete with undo toast
  - Column definition switches between normal/spreadsheet mode

## Implementation order
1. API: `POST /records/batch/update`
2. Store: `batchUpdateRecords()`
3. RecordsPage: spreadsheet mode toggle + editable cells + auto-save + inline delete

## Verification
1. Toggle spreadsheet mode → cells become editable
2. Change a tag → cell shows pending indicator → after 1s syncs to API
3. Change multiple fields across rows → one batch API call
4. Click inline delete → row disappears → undo toast → API call after 5s
5. Exit spreadsheet mode → back to normal table with drag handles
