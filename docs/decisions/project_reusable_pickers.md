---
name: Reusable picker components
description: AccountPicker and CategoryTagPicker components that read from stores and encapsulate rendering
type: project
---

Create reusable picker components to eliminate duplicated account/tag select code:

**AccountPicker:** USelectMenu with colored icon rendering, reads from accounts store. Simple `v-model` for selected account ID.

**CategoryTagPicker:** UDropdownMenu with cascading categories → tags, reads from categories store. Simple `v-model` for selected tag/category ID.

**Key design:** Pickers do NOT fetch data themselves. Parent page fetches on mount (already happens). Pickers just read from the Pinia store (shared singleton). This avoids redundant API calls when multiple pickers are on the same page.

**Files to refactor:** RecordFormModal, BatchRecordModal, RecordsPage toolbar — all have duplicated accountOptions computed + icon template rendering.

**How to apply:** Build as `src/components/AccountPicker/` and `src/components/CategoryTagPicker/`. Replace all existing account/tag select instances.
