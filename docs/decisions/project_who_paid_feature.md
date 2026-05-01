---
name: Who Paid feature idea
description: Track expenses others paid on your behalf — "who paid?" field on records for accurate spending totals and debt tracking
type: project
---

User wants to track expenses that OTHER people paid but where they owe their share. Example: Wilmer pays Uber 3000, split /2 — user owes 1500, tagged as Transport/Uber for spending charts.

**Preferred approach (Option B):** Add a "Who paid?" field to records (default: me). When someone else paid:
1. No account balance change (money didn't leave user's account)
2. Debt direction flips (user owes THEM instead of them owing user)
3. Tag/category/amount all work normally for spending totals

This is how Splitwise handles it — every expense has a payer.

**Why:** User consolidates expenses after group activities. Wants accurate spending totals across categories even when others fronted the money. Currently can only track what user personally paid.

**How to apply:** When implementing, add `paidById` to records (null = me, person ID = someone else). Affects: account balance (skip if not me), debt calculation (flip sign), spending totals (include user's share regardless of payer).
