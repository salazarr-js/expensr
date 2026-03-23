# Smart Parse Algorithm

Flowchart: [smart-parse-flowchart.excalidraw](smart-parse-flowchart.excalidraw)

![Smart Parse Flowchart](smart-parse-flowchart.svg)

## Input Syntax

| Token | Meaning | Example |
|---|---|---|
| number | amount | `11500`, `-30000`, `51144.70` |
| `(text)` | account (partial match) | `(galicia)`, `(usd)`, `(cash)` |
| `??` / `???` | needs review flag | `sbuxespejo??` |
| `DD/MM/YY` or `DD/MM` | explicit date (current year if omitted) | `16/03/26`, `16/03` |
| everything else | note / context | `mercadopago sbuxespejo` |

## Algorithm

### 1. Pre-process
- Strip `??` markers → set `needsReview: true`
- Extract `(account)` from parentheses
- Extract date if present (DD/MM/YY or DD/MM → use current year)
- Extract amount (last standalone number)
- Remaining text = note (always preserved in full)

### 2. Account Resolution (always before AI)
1. `(parens)` → partial match against account names (authoritative)
2. If no parens → check note words against `keyword_mappings` for accountId
3. If still no match → use default account (most used)

### 3. Tag / Category Resolution
1. Check note words against `keyword_mappings` for tagId
2. If tag found → auto-assign its parent category
3. <!-- TODO: people detection → match note words against people table, use defaultTagId if set -->
4. If no tag found → AI fallback (tag/category only, account already resolved)
   - AI receives keyword dictionary as compact context

### 4. Result
All parsed records open the edit/review modal (training phase). Once keyword dictionary has enough data, auto-save can be re-enabled for high-confidence matches.

## Keyword Dictionary

The `keyword_mappings` table learns from corrections:
- When user corrects a parsed record, keywords from the input text are upserted with the corrected tagId/accountId
- Only auto-maps keywords when the note is 1-2 words (brands/stores like "uber", "carrefour")
- Multi-word notes are too ambiguous for single-word mapping — people detection will handle those cases
- Keywords must be 3+ characters, non-numeric

## Resolution Priority

```
Amount + Date + needsReview    (deterministic extraction)
         ↓
Account: (parens) → keyword → default
         ↓
Tag:     keyword → [people w/ defaultTag] → AI fallback
         ↓
Person:  [match against people table, even without defaultTag]

[ ] = planned, not yet implemented
```

## Examples

```
uber 3327                                → amount=3327, keyword "uber"→tag Uber
uber muniz 3500 (galicia)                → amount=3500, account=Galicia ARS, note="uber muniz"
mercadopago sbuxespejo?? 11500 (galicia) → amount=11500, account=Galicia ARS, note="mercadopago sbuxespejo", needsReview=true
51144.70 pizzas urban jazz               → amount=51144.70, note="pizzas urban jazz"
tranf a gustavo -30000                   → amount=-30000, note="tranf a gustavo"
exchange 150usd 204750                   → amount=204750, note="exchange 150usd"
carrefour 4386.85 16/03                  → amount=4386.85, date=2026-03-16, keyword "carrefour"→tag
percepcion rg 5617/24 -305.25           → amount=-305.25, note="percepcion rg 5617/24" (not a date)
```
