---
name: Performance improvements backlog
description: Known performance issues to address in future revisions
type: project
---

**RecordFormModal fires 5 API requests on every open:** accounts?sort=usage, categories, tags, people, keywords. These are reference data that rarely changes — should be cached in stores with a staleness check instead of re-fetching on every modal open.

**Why:** Each modal open = 5 network round-trips. Noticeable latency, especially on mobile.

**How to apply:** When working on performance or the form modal, consider:
- Stores should cache reference data with a `lastFetched` timestamp
- Only re-fetch if stale (e.g., >5 min) or explicitly invalidated after a mutation
- QuickRecordModal has the same pattern (fetches accounts + categories on open)
- Dashboard also fetches accounts + people on mount
