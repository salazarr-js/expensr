# People Feature — Shared Expenses

## What shipped

People you share expenses with (angy, wilmer, renzo). Only YOUR expenses are tracked.

- **CRUD**: name + color, cards with colored initial circle and debt balance
- **Multi-person records**: `record_people` junction table, replaces old single `personId` FK
- **Debt tracking**: balance = sum of pre-calculated `share_amount` per shared record. Positive = they owe you.
- **Parse detection**: person names matched in input text ("uber angy 3500" → detects Angy)
- **Records integration**: people column (overlapping colored circles), person filter, multi-select in form with None option
- **Responsive table**: horizontal scroll with sticky Amount column

## Design decisions

- **You only record your expenses** — not other people's. When Angy pays for something, that's her expense, not yours.
- **Equal split by default** — amount / (people + you). Weighted splits shipped (see [06-custom-splits](../06-custom-splits/)). Manual per-person amounts is a future feature.
- **No `paidBy` field** — since you only record what you paid, all shared records = you paid.
- **Person color, no icon** — colored circle with name initial. Simple.

## Next steps

### Settlements
"Angy paid me 37200" — a new record type that reduces debt balance. Partial settlements supported (Angy sends 20000 now, rest later).

### Spending calculations
For charts/totals, shared records should count as `amount / (people + 1)` (your share) instead of the full amount. Example: you paid 30000 uber split 3 ways → your real spend is 10000, not 30000. The other 20000 is a temporary loan. No schema change needed — just calculation logic in dashboard queries.

### Dashboard widgets (depends on step 9)
- Total debt others owe you
- Settlement history
- How much others spent on you vs you on them (requires tracking when others pay for you — out of scope for now)
