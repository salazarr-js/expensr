# Smart Parse Test Suite Plan

## Context

The smart parse feature (POST `/api/records/parse` + `/api/records/parse/feedback`) has no tests. We manually tested 30 real-world inputs and found issues (negative amounts, account resolution gaps) that were fixed. We need a test suite to prevent regressions and validate the feedback learning loop. The project has zero existing test infrastructure.

## Setup (one-time)

### 1. Install deps
```bash
pnpm add -D vitest miniflare --filter @slzr/expensr-api
```

### 2. Create `packages/api/vitest.config.ts`
- `include: ["src/**/*.test.ts"]`
- `testTimeout: 15_000` (AI mock + D1 setup can be slow)

### 3. Add scripts
- `packages/api/package.json`: `"test": "vitest"`, `"test:run": "vitest run"`
- Root `package.json`: `"test": "pnpm --filter @slzr/expensr-api test:run"`

### 4. Fix `packages/api/src/env.d.ts`
Add `AI: Ai` to `CloudflareBindings` (currently only has `DB: D1Database`; the `AI` binding is only declared in the web-generated types).

## Refactor: Extract parse helpers

Move the 6 pure functions out of `records.ts` so they're directly importable in unit tests:

- **Create** `packages/api/src/parse/helpers.ts` — move `extractNeedsReview`, `extractParensAccount`, `extractDate`, `extractAmount`, `extractKeywords`, `matchAccount`
- **Create** `packages/api/src/parse/index.ts` — barrel re-export
- **Update** `packages/api/src/routes/records.ts` — import from `../parse/helpers`

## Test utilities

### `packages/api/src/test/setup-d1.ts`
- Uses miniflare to create an in-memory D1 database
- Applies all migration SQL files from `packages/api/drizzle/` in sorted order (including `0001_seed_categories.sql` which seeds the 12 default categories)
- Returns `{ mf, d1 }` for use in tests

### `packages/api/src/test/seed.ts`
- Inserts known test accounts: Galicia ARS, Galicia USD, Efectivo (cash)
- Inserts known test tags under the seeded categories: Uber (Transport), Reembolso (Income), Restaurante (Dining), Celular (Personal), Padel (Leisure), Verduras (Shopping), Supermercado (Shopping), Subscriptions (Digital), Salario (Income)
- Returns ID maps for assertions

### `packages/api/src/test/ai-mock.ts`
- `createAiMock(responseMap?)` — mock `AI.run()` that returns mapped responses by note text, tracks calls
- `createExecutionCtxMock()` — mock `ctx.executionCtx.waitUntil()` that collects promises, with `waitForAll()` to flush fire-and-forget updates before re-parsing

## Test files

### Unit: `packages/api/src/parse/helpers.test.ts`

Pure function tests, no DB or mocks needed. ~35 cases:

**extractNeedsReview** — `??` strips and flags, `???` strips and flags, no markers returns false, single `?` ignored

**extractParensAccount** — `(galicia)` extracts, mid-text parens, no parens returns null

**extractDate** — `16/03/26` → `2026-03-16`, `16/03` → current year, invalid day/month → null

**extractAmount** — last standalone number wins, `150usd` skipped (glued), `-305.28` → `305.28` (absolute), decimals, commas, no number → null

**extractKeywords** — filters <3 chars and numbers, lowercases

**matchAccount** — partial match both directions, no match → null

### Integration: `packages/api/src/routes/records.parse.test.ts`

Uses miniflare D1 + AI mock + `app.request()`. ~25 cases:

**Real-world inputs (test.each):**
| Input | Assert amount | Assert account | Assert tag | Assert flags |
|---|---|---|---|---|
| `uber 3327` | 3327 | default | Uber | — |
| `127 reintegro galicia` | 127 | Galicia ARS | Reembolso | type=income |
| `1281.50 reintegro galicia` | 1281.5 | Galicia ARS | Reembolso | type=income |
| `5126 uber` | 5126 | default | Uber | — |
| `reintegro 831.75` | 831.75 | default | Reembolso | type=income |
| `percepcion -305.28` | 305.28 | default | null | — |
| `uber 1000` | 1000 | default | Uber | — |
| `clase padel robbie -30000` | 30000 | default | Padel | — |
| `exchange 150usd 204750` | 204750 | default | null | — |
| `carrefour -16364.25` | 16364.25 | default | (AI) | — |
| `verduras ruth 4500` | 4500 | default | Verduras | — |
| `mercadopago sbuxespejo?? 16/03/26 11500` | 11500 | default | null | needsReview, date=2026-03-16 |
| `tranf angelica salvatierra vargas??? 16/03/26 -20000` | 20000 | default | null | needsReview, date=2026-03-16 |

**Account resolution priority:**
- `(galicia)` → Galicia ARS (parens match)
- `mercadopago debito 17000 (galicia)` → Galicia ARS (parens override)
- `127 reintegro galicia` → Galicia ARS (note word match)
- `dev compra galicia (reintegro) 1000` → Galicia ARS (parens no match → note fallback)
- no account match → first alphabetically (Efectivo)

**AI fallback:**
- When no keyword mapping exists, verify AI mock is called
- When keyword mapping exists for "uber", verify AI is NOT called

### Integration: `packages/api/src/routes/records.feedback.test.ts`

Feedback endpoint + learning loop. ~8 cases:

**Feedback storage:**
- Stores correction in `parse_corrections` table
- Creates keyword mapping for 1-2 word notes
- Skips keyword mapping for 3+ word notes
- Maps account from parens keywords

**Feedback loop (the key tests):**
1. Parse `movistar 5000` → no keyword, AI fallback called
2. Submit feedback with correct tagId (Celular)
3. Flush waitUntil promises
4. Re-parse `movistar 8000` → keyword "movistar" resolves to Celular, AI NOT called

5. Parse `netflix 5999` → no keyword, AI fallback
6. Submit feedback with tagId (Subscriptions) + accountId (Galicia ARS)
7. Re-parse `netflix 3000` → tag from keyword, account from keyword, AI NOT called

## Verification

```bash
pnpm --filter @slzr/expensr-api test:run
```

All tests green. Specifically verify:
- Unit tests pass with no network/DB
- Integration tests spin up miniflare D1 and dispose cleanly
- Feedback loop tests confirm keyword learning works end-to-end
- AI mock tracks that it's called when expected and NOT called when keywords resolve

## Files to create/modify

| Action | File |
|---|---|
| Create | `packages/api/vitest.config.ts` |
| Create | `packages/api/src/parse/helpers.ts` |
| Create | `packages/api/src/parse/index.ts` |
| Create | `packages/api/src/test/setup-d1.ts` |
| Create | `packages/api/src/test/seed.ts` |
| Create | `packages/api/src/test/ai-mock.ts` |
| Create | `packages/api/src/parse/helpers.test.ts` |
| Create | `packages/api/src/routes/records.parse.test.ts` |
| Create | `packages/api/src/routes/records.feedback.test.ts` |
| Modify | `packages/api/src/routes/records.ts` — import helpers from `../parse/helpers` |
| Modify | `packages/api/src/env.d.ts` — add `AI: Ai` |
| Modify | `packages/api/package.json` — add test scripts + devDeps |
| Modify | root `package.json` — add test script |
