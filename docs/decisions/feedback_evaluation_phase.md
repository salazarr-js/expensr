---
name: Real-use evaluation phase — no new features
description: App is in evaluation phase since 2026-04-15. No new features. Bias toward removals and simplifications.
type: feedback
originSessionId: b47b9390-264b-4fb6-94fa-80b14573b7a0
---
Since 2026-04-15, expensr is in a **Real-Use Evaluation** phase: the user is going to use the app daily with real expenses to figure out which features are actually useful. The build queue is paused.

**Why:** The app shipped sections 0–11 + 14 (transfers, reconciliation, dashboard, smart parse, splits, settlements, spreadsheet mode, PWA) but the surface area outgrew real usage. The user said "the app is too complex and I'm not using it, let's start clean." During this WIP discard, ~140 lines of half-built spreadsheet add-row + BatchModal polish were thrown away because they were adding more surface area to features that may not survive evaluation.

**How to apply:**
- Don't suggest pulling items from the Future list in `docs/plan.md`, even small ones.
- Don't add features, widgets, or options "while we're here."
- Bug fixes from real usage are welcome.
- **Removals and simplifications are encouraged** — proactively flag dead/unused code or overlapping features when spotted.
- When the user describes a workflow problem, first ask: *can we remove something?* before *can we add something?*
- Likely simplification targets to validate first (don't act preemptively): three batch-entry surfaces (spreadsheet/batch modal/quick batch), splits complexity (manual + weighted + settlements), needsReview flow, account reconciliation gap indicator, keywords/parse-logs observability, dashboard widgets.
- This rule is also documented in `CLAUDE.md` "Current Phase" section and `docs/plan.md` top section.
