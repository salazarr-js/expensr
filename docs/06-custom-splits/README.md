# Custom Splits — Weighted Shared Expenses

## What shipped

Weighted splits for shared expenses. Instead of only equal splits, you can now pay for multiple shares (e.g., paying for yourself + your partner).

- **`records.my_shares`** — how many shares the creator pays (default 1 = equal split)
- **`record_people.share_amount`** — pre-calculated debt per person, stored on create/update
- **Debt calculation** uses `sum(share_amount)` instead of runtime formula
- **RecordFormModal**: linked +/- steppers for shares and /N split, with live money summary
- **Quick record `/N` syntax**: `102000 padel angy wilmer raulo /5` → myShares=2
- **Note → tag matching**: debounced client-side tag detection from note text

## How it works

### Database

```
records
├── amount: 102000
└── my_shares: 2          ← you pay 2 shares

record_people (one row per person)
├── person=Angy   → share_amount: 20400
├── person=Wilmer → share_amount: 20400
└── person=Raulo  → share_amount: 20400
```

**Formula:**
```
perShare = amount / (peopleCount + myShares)
each person owes = perShare
you pay = perShare × myShares
```

### Recalculation

`share_amount` is recalculated automatically on every record update:

| change | what happens |
|---|---|
| Add/remove a person | `syncRecordPeople` deletes all links, re-inserts with new amounts |
| Change amount | Fetches current people from junction table, recalculates |
| Change myShares | Same — fetches current people, recalculates |

The API detects which fields changed and only recalculates when needed:
1. `personIds` provided → sync with new list + recalculate
2. `amount` or `myShares` changed (no personIds) → fetch current people + recalculate
3. Neither → no junction table changes

### Debt balance

People API sums `share_amount` directly:
```sql
sum(CASE WHEN type='expense' THEN share_amount ELSE -share_amount END)
```
No runtime division — the math is done once on write.

## UI: Split controls

When people are selected and amount > 0, a split card appears:

```
┌──────────────────────────────────────────────┐
│ I COVER  [−] 2 [+]       SPLIT  [−] /5 [+]  │
│ Each: 20,400.00 ARS  ·  You: 40,800.00 ARS ×2│
└──────────────────────────────────────────────┘
```

- **"I cover" stepper** — how many shares you pay (min 1)
- **"/N" stepper** — total shares (people + your shares)
- Both are linked: changing one updates the other
- Money summary shows currency from selected account
- Uses `v-show` (not `v-if`) to keep DOM stable while people dropdown is open

## UI: Note → tag matching

The note field auto-detects tags as you type (debounced 400ms, client-side only):

- Extracts keywords (≥3 chars) from note text
- Matches against tag names: exact first, then partial (contains)
- **Keyword order matters** — first word in the note wins ("uber padel" → Uber, not Padel)
- Auto-assigns category from the matched tag
- **Won't override manual picks** — tracks whether the tag was set by note (`tagAutoMatched`) or by user
- **Clearing the note** clears the auto-matched tag + category (manual picks stay)

## Quick record: /N syntax

`/N` at the end of input sets total shares:

```
102000 padel angy wilmer raulo /5
→ amount=102000, tag=Padel, people=[Angy,Wilmer,Raulo], myShares=5-3=2

12000 pelotas angy wilmer
→ amount=12000, tag=Pelotas, people=[Angy,Wilmer], myShares=1 (equal split)
```

- Stripped before other parsing (doesn't interfere with amount/date/account extraction)
- `myShares = N - matchedPeople.length` (if result < 1, ignored)
- Passed to RecordFormModal via `prefillData.myShares`

## Design decisions

- **Store amounts, not ratios** — `share_amount` is the actual debt number. No runtime math needed for debt queries. If the formula changes later (manual amounts), the stored values stay correct.
- **`my_shares` on the record, not per-person weights** — covers 90% of cases (paying for partner/family). Per-person weights would be Part 2 (manual amounts).
- **No `split_type` column yet** — not needed until manual amounts. For now: myShares=1 means equal, myShares>1 means weighted.
- **Backfill migration** — existing shared records got `share_amount` calculated as `amount / (count + 1)`, so debt totals didn't change.
- **Note tag matching is client-side** — uses `allTags` already loaded in the form. No API call, no latency. Same matching logic as smart parse tier 1.
- **People selector None logic** — `0` (None) is a virtual value only in the display model-value, never stored in state. `wasEmpty` checks if personIds was empty (None was displayed), not if `0` was in the array.

## Examples

| expense | people | myShares | /N | each owes | you pay |
|---|---|---|---|---|---|
| Cancha padel 102,000 | Angy, Wilmer, Raulo | 2 | /5 | 20,400 | 40,800 |
| Pelotas padel 12,000 | Angy, Wilmer | 1 | /3 | 4,000 | 4,000 |
| Gatorade 2,500 | — | — | — | — | 2,500 |
| Cena 80,000 | Angy | 2 (me + Gaby) | /3 | 26,667 | 53,333 |
| Taxi 15,000 | Angy, Wilmer, Raulo | 1 | /4 | 3,750 | 3,750 |

## Manual split amounts ✅

Shipped. Per-person custom amounts for complex cases.

- **DB**: `records.split_type` column — 'equal' | 'weighted' | 'manual'
- **API**: `personShares: [{personId, amount}]` in create/update schema. When present, amounts stored directly (not calculated). Manual records don't recalculate when amount changes.
- **UI**: Segmented control [Equal][Manual] in split card. Manual mode shows per-person amount inputs with live "You pay" remainder.
- **Edit**: When editing a manual record, `attachPeople` returns `shareAmount` per person, UI pre-fills the inputs.

## Settlements ✅

Shipped. "Person paid me X" — reduces their debt by the full amount.

- **Type**: `'settlement'` added to `RECORD_TYPES`
- **Validation**: API enforces exactly 1 person (`SETTLEMENT_ONE_PERSON` error)
- **Split**: `splitType = 'manual'`, `share_amount = full record amount`
- **No category/tag**: Settlements are debt payments, not spending
- **Debt calc**: Already handled — settlement falls in the `else` branch (subtracts `share_amount`)
- **UI**: [Expense][Payment] toggle in RecordFormModal. Payment mode: single person selector (closes on pick), required field, simplified form (no category/tag/split controls). "Record payment" label on submit.
- **People page**: "Payment" shortcut button on each person card (visible when balance > 0). Opens RecordFormModal pre-filled with type=settlement and person.

## Next steps

- **Quick record per-person syntax** — `102000 padel angy:20400 wilmer:20400` (stretch goal, manual splits are more natural in the form)
- **Parse logs + feedback wiring** — see [07-parse-logs/](../07-parse-logs/)
