---
name: Real-use evaluation log
description: Per-feature evaluation verdicts during the 2026-04-15 evaluation phase. Source of truth for what's validated/under review/removed.
type: project
originSessionId: b47b9390-264b-4fb6-94fa-80b14573b7a0
---
Tracks the user's verdict on each feature during the Real-Use Evaluation phase (started 2026-04-15). Mirror in `docs/plan.md` "Evaluation log" table — keep both in sync.

**Validated (definitely keep):**
- Categories + Tags (2026-04-21) — 12 categories, 45 tags (all English). Merged Corner Store → Groceries. Removed Monotributo from seed. Added Family. Re-seeded local + prod.

**Removed / simplified:**
- Accounts → starting balance (2026-04-21) — column dropped. Replaced by monthly balance model.
- Account reconciliation (real_balance + Synced/Gap badge) (2026-04-21) — columns dropped. Replaced by account_balances table.
- Spreadsheet mode (2026-04-21) — all inline editing, batch/update, batch/delete APIs removed. ~500 lines deleted across 6 files.
- Batch create modal + API (2026-04-21) — BatchRecordModal deleted, POST /batch removed. Replaced by Claude Code `/expensr-batch` skill (planned).
- QuickRecord batch mode (2026-04-21) — multi-line batch toggle removed. ~240 lines deleted.
- Account checkpoints (original design) — stash dropped. Replaced by simpler monthly balance model.

**Built (awaiting real-use validation):**
- Monthly balances (2026-04-21) — one balance per account per month. Auto-computed initial/projected/gap. BalancesModal + BalanceFormModal + MonthPicker. Auto-reconciliation suggestion.
- Draft records (2026-04-20) — temporary /quick → draft_records table + DraftsPage.

**How to apply:** When user gives a verdict on a feature, update both `docs/plan.md` and this memory.
