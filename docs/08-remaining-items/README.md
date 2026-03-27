# Remaining Items: Parse Logs, Spending Calculations, Auto-save

## Context

Three features from completed sections remain unbuilt. Parse logs has no observability — we can't answer how parses resolved or whether corrections are learning. The feedback loop (QuickRecordModal → keyword dictionary) was built but never wired. Spending calculations don't account for shared expenses — totals show full amounts instead of your portion. Auto-save skips the form when parse confidence is high.

**Person detection in parse** is already implemented (was marked pending People, but People shipped and detection code works). Just needs plan.md checkbox.

---

## Step 1: DB — Replace `parse_corrections` with `parse_logs`

**Delete** `packages/api/src/db/schema/parseCorrections.ts` (0 rows in local + prod, safe)

**Create** `packages/api/src/db/schema/parseLogs.ts`:

| Column | Type | Notes |
|---|---|---|
| id | integer PK | autoincrement |
| inputText | text | What the user typed |
| resolvedBy | text | 'name_match' \| 'keyword' \| 'ai' \| 'none' |
| tagMatched | integer (bool) | Did we find a tag? |
| accountMatched | integer (bool) | Did we find an account? |
| peopleCount | integer | default 0 |
| aiCalled | integer (bool) | default false |
| aiSucceeded | integer (bool) | null if AI not called |
| wasCorrected | integer (bool) | null until feedback received |
| parseResult | text | JSON — what parse returned |
| finalResult | text | JSON — what user saved (null if cancelled) |
| createdAt | integer | default unixepoch() |

**Modify** `packages/api/src/db/schema/index.ts` — replace `parseCorrections` export with `parseLogs`

**Run:** `pnpm db:generate` → `pnpm db:migrate`

---

## Step 2: Shared Types

**Modify** `packages/shared/src/records.ts`:

1. Add `ResolvedBy` type:
   ```ts
   export const RESOLVED_BY = ["name_match", "keyword", "ai", "none"] as const;
   export type ResolvedBy = (typeof RESOLVED_BY)[number];
   ```

2. Extend `ParsedRecord` — add `resolvedBy: ResolvedBy` + `parseLogId: number`

3. Replace `parseRecordFeedbackSchema`:
   ```ts
   z.object({
     parseLogId: z.number(),
     finalResponse: z.record(z.string(), z.unknown()),
   })
   ```

4. Add `mySpend: number` to `RecordWithRelations`

---

## Step 3: API — Track `resolvedBy` + insert parse log

**Modify** `packages/api/src/routes/records.ts` — `POST /parse` endpoint

1. Declare `resolvedBy = 'none'`, `aiCalled = false`, `aiSucceeded = false` at the start
2. After tag name match → `resolvedBy = 'name_match'`
3. After keyword lookup (if tag was null before, not null after) → `resolvedBy = 'keyword'`
4. Before AI call → `aiCalled = true`. On AI tag match → `aiSucceeded = true; resolvedBy = 'ai'`
5. Add `resolvedBy` to result object
6. Insert `parse_logs` row → get `log.id`
7. Add `parseLogId: log.id` to result

---

## Step 4: API — Rewrite feedback endpoint

**Modify** `packages/api/src/routes/records.ts` — `POST /parse/feedback`

1. Parse body with new schema (`{ parseLogId, finalResponse }`)
2. Fetch log row by ID (404 if not found)
3. Compare `JSON.parse(logRow.parseResult)` vs `finalResponse` → `wasCorrected = tagId or accountId differ`
4. Update log row with `finalResult` + `wasCorrected`
5. Re-extract keywords from `logRow.inputText` (replaces old `promptText`)
6. Keep existing `upsertKeywordMapping` calls — same logic, different input source
7. Remove `parseCorrections` insert

---

## Step 5: API — Compute `mySpend` on records

**Modify** `packages/api/src/routes/records.ts`

After `attachPeople` already resolves `people[].shareAmount`, add post-processing:

```ts
function computeMySpend(rows) {
  return rows.map(r => {
    if (r.type === 'settlement') return { ...r, mySpend: 0 };
    const othersTotal = r.people.reduce((sum, p) => sum + p.shareAmount, 0);
    return { ...r, mySpend: r.amount - othersTotal };
  });
}
```

Apply to both `GET /` and `GET /:id` returns. Zero extra DB queries.

Note: Account balance stays as cash flow (full amounts). `mySpend` is for spending totals/charts (future dashboard).

---

## Step 6: API — Parse stats endpoint (optional)

**Modify** `packages/api/src/routes/records.ts`

`GET /parse/stats` — aggregate counts from `parse_logs` (total, byResolution, aiCalls, aiSuccessRate, correctionRate, savedCount). Place before `/:id` route.

---

## Step 7: Frontend — Wire feedback

**Modify** `packages/web/src/components/QuickRecordModal/QuickRecordModal.vue`:
- Store `lastParseLogId` from parse result
- Pass `parseLogId` prop to RecordFormModal
- Clear on modal close

**Modify** `packages/web/src/components/RecordFormModal/RecordFormModal.vue`:
- Add `parseLogId?: number` prop
- After successful create (not update), if `parseLogId` exists:
  ```ts
  api.post("/records/parse/feedback", {
    parseLogId: props.parseLogId,
    finalResponse: payload,
  }).catch(() => {}); // fire-and-forget
  ```

---

## Step 8: Frontend — Auto-save high-confidence matches

**Modify** `packages/web/src/components/QuickRecordModal/QuickRecordModal.vue`

**Auto-save condition:**
```ts
function canAutoSave(result: ParsedRecord): boolean {
  return !!(
    result.amount && result.accountId && result.tagId &&
    !result.needsReview &&
    (result.resolvedBy === 'name_match' || result.resolvedBy === 'keyword')
  );
}
```

**Flow change in `parse()`:**
- If `canAutoSave(result)` → save directly via `recordsStore.createRecord()`, close modal, fire-and-forget feedback, show toast with record summary + "Edit" action
- Else → open RecordFormModal as usual

**Toast "Edit" action:** Fetches the record by ID (`GET /records/:id`), opens RecordFormModal in edit mode. Add `autoSavedRecord` ref to track this state.

**Fallback:** If auto-save fails (API error), fall back to opening RecordFormModal with prefilled data.

---

## Files Changed

| File | Action | Features |
|---|---|---|
| `packages/api/src/db/schema/parseCorrections.ts` | Delete | Parse logs |
| `packages/api/src/db/schema/parseLogs.ts` | Create | Parse logs |
| `packages/api/src/db/schema/index.ts` | Modify (1 line) | Parse logs |
| `packages/shared/src/records.ts` | Modify | All three |
| `packages/api/src/routes/records.ts` | Modify | All three |
| `packages/web/src/components/QuickRecordModal/QuickRecordModal.vue` | Modify | Parse logs + Auto-save |
| `packages/web/src/components/RecordFormModal/RecordFormModal.vue` | Modify | Parse logs (feedback) |
| `docs/plan.md` | Modify | Mark checkboxes |

## Dependency Graph

```
Step 1 (DB) → Step 2 (types) → Step 3 (resolvedBy + log)
                              → Step 4 (feedback rewrite)
                              → Step 5 (mySpend) — independent
                              → Step 6 (stats) — independent, optional
Steps 3+4 → Step 7 (frontend feedback)
Steps 3+7 → Step 8 (auto-save)
```

## Verification

1. `pnpm db:generate` + `pnpm db:migrate` — clean migration
2. `pnpm typecheck` — no errors
3. Quick record "uber 3500" → auto-saved (resolvedBy=name_match), toast with Edit, parse_logs row created
4. Quick record "carrefour 5000" → opens form (resolvedBy=none/ai), correct to Supermercado → feedback creates keyword mapping
5. Quick record "carrefour 8000" → auto-saved (resolvedBy=keyword) — keyword from previous correction
6. Toast "Edit" button → opens record for editing
7. Records list `mySpend`: full amount for solo, reduced for shared, 0 for settlements
8. `GET /records/parse/stats` returns valid counts
