---
name: Claude as data intermediary architecture
description: Claude Code manages bulk data, reconciliation, keyword learning. App stays visual-only + quick record. Agreed changes and pending work list.
type: project
originSessionId: b47b9390-264b-4fb6-94fa-80b14573b7a0
---
## Architecture decision (2026-05-01)

**Claude Code = data engine.** Bulk imports, reconciliation, keyword learning, data quality.
**App = visual layer.** View records, dashboard, charts, edit single record, quick record from phone, monthly balances.
**No bank parsers.** Claude reads any bank format and normalizes it. No parser code to write or maintain. Config files (`.expensr/`, gitignored) only store personal tag mappings — not parsing logic. JSON format (not YAML — zero deps, native to Node).
**Full plan:** `docs/13-claude-intermediary/README.md`

## Agreed changes — pending implementation

### High priority

1. **Re-add batch API (Claude-only, no UI)**
   - `POST /records/batch` — create multiple records
   - `POST /records/batch/update` — update multiple records (notes, tags, amounts, dates)
   - No UI for these — only Claude uses them

2. **Build `/expensr-batch` skill**
   - Receives bank statement paste (or Excel)
   - Parses: date, description, amount, sign
   - Auto-tags via keyword_mappings + pattern matching + tag name match
   - Detects and skips offsetting pairs (percepcion/anulacion, dev.compra/uber shopper)
   - Reverses order (bank = newest-first → API = oldest-first)
   - Shows confirmation table before inserting
   - Design doc at `docs/12-expensr-batch-skill/README.md`

3. **Build reconcile endpoint + `/expensr-reconcile` skill**
   - `POST /records/reconcile` — compares bank data vs DB records
   - Excel = source of truth
   - Match logic: exact (date+amount), fuzzy amount (±1%), fuzzy date (±2 days), both fuzzy (confirm)
   - Updates: note (richer description/person name), date (bank correction), amount (centavo fix), tag (auto-tag if possible), needsReview (clear if tagged)
   - Reports: matched, fuzzyMatched, updated, inserted, orphans (in DB but not in bank), skipped
   - Orphans flagged for review, not auto-deleted
   - Idempotent: running twice doesn't duplicate, only enriches

4. **Disable keyword learning from app UI**
   - Current behavior: editing a needsReview record auto-creates keyword from note → learns wrong keyword (e.g., "vegetales" instead of "MARIA ESTELA")
   - New behavior: app only tags the record, doesn't create keywords
   - Keywords managed by Claude skill during reconcile: "you tagged MARIA ESTELA as Vegetables, save keyword?" — learns from bank description (source of truth), not note

### Medium priority

5. **`/expensr-status` skill** — quick check
   - Accounts + balances + gaps + untagged records + drafts pending

6. **Tag mapping from DB at runtime**
   - Skills read keyword_mappings + tag names from API, not hardcoded patterns
   - Bank-specific patterns (PAYU*AR*UBER, DLO*Rappi) stored as keyword_mappings

### Low priority

7. **Support other bank formats** (BBVA, Santander, MercadoPago)
8. **Detect own-account transfers** (Transferencia → MercadoPago could be transfer not expense)
9. **Learn keyword mappings from user corrections** during reconcile

## What to keep in app

- Records CRUD (single record edit/delete)
- Quick record (phone → /quick endpoint)
- Monthly balances (BalancesModal, auto-reconcile suggestion)
- Dashboard + charts
- Categories/tags CRUD
- Accounts CRUD
- People + debt tracking
- Draft records page
- Drag-and-drop reorder

## What was removed from app

- Spreadsheet mode (2026-04-21)
- BatchRecordModal (2026-04-21)
- QuickRecord batch mode (2026-04-21)
- Starting balance + reconciliation fields (2026-04-21)
