---
name: Custom table component idea
description: Replace UTable with custom TanStack Table + Tailwind for full styling control
type: project
---

UTable's opinionated styles (pinned column bg-default/75, hover bg-elevated/50, data-selectable) make it hard to customize row colors, hover states, and sticky column backgrounds.

**Future plan:** Build a custom RecordsTable component using TanStack Vue Table directly + plain `<table>` + Tailwind. Same features (sorting, column pinning, column visibility) but full control over row bg, hover, sticky styling.

**Why:** Struggled with settlement green rows + amber review rows conflicting with UTable's built-in hover and pinned column backgrounds. CSS overrides felt hacky.

**How to apply:** When the records page needs more visual customization (charts integration, row grouping, inline editing), that's the right time to replace UTable.
