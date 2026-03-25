# Parse Logs + Feedback Wiring

## Context

The smart parse feature has no observability. We can't answer: how many parses used AI? How many resolved via name match? How many needed user correction? The feedback loop (corrections → keyword dictionary) was built but never wired up — QuickRecordModal doesn't call `/parse/feedback` after save.

**Goals:**
1. Replace `parse_corrections` with `parse_logs` — log every parse call with resolution path
2. Wire up feedback submission from QuickRecordModal → builds keyword dictionary
3. Return `resolvedBy` in parse response for frontend display
4. Enable efficiency queries

---

## Step 1: Database — Replace `parse_corrections` with `parse_logs`

**Drop** `parse_corrections` table (has 0 rows in both local and prod).

**Create** `parse_logs`:

| Column | Type | Notes |
|---|---|---|
| id | integer | PK |
| input_text | text | What the user typed |
| resolved_by | text | 'name_match', 'keyword', 'ai', 'none' |
| tag_matched | integer (bool) | Did we find a tag? |
| account_matched | integer (bool) | Did we find an account? |
| people_count | integer | How many people detected |
| ai_called | integer (bool) | Did we call Workers AI? |
| ai_succeeded | integer (bool) | Did AI return a usable tag? (null if not called) |
| was_corrected | integer (bool) | User changed result before saving (null if not saved yet) |
| parse_result | text | JSON — what parse returned |
| final_result | text | JSON — what user saved (null if cancelled) |
| created_at | integer | Timestamp |

**Files:**
- Delete `packages/api/src/db/schema/parseCorrections.ts`
- Create `packages/api/src/db/schema/parseLogs.ts`
- Update `packages/api/src/db/schema/index.ts` barrel export

---

## Step 2: Shared Types — Add `resolvedBy` to ParsedRecord

**File:** `packages/shared/src/records.ts`

- Add `resolvedBy: 'name_match' | 'keyword' | 'ai' | 'none'` to `ParsedRecord`
- Add `parseLogId: number` to `ParsedRecord` — so feedback can reference the log row
- Update `parseRecordFeedbackSchema` to accept `parseLogId` instead of `aiResponse`

---

## Step 3: API — Log parse calls + return resolvedBy

**File:** `packages/api/src/routes/records.ts`

In the `POST /parse` endpoint, track which tier resolved the tag:

```
let resolvedBy = 'none';
// After tag name match → resolvedBy = 'name_match'
// After keyword lookup → resolvedBy = 'keyword'
// After AI fallback → resolvedBy = 'ai'
```

After building the result, insert a `parse_logs` row:

```typescript
const [log] = await db.insert(parseLogs).values({
  inputText: parsed.data.text,
  resolvedBy,
  tagMatched: !!finalTag,
  accountMatched: !!resolvedAccount,
  peopleCount: matchedPeople.length,
  aiCalled,
  aiSucceeded: aiCalled ? !!aiTag : null,
  parseResult: JSON.stringify(result),
}).returning();
```

Return `resolvedBy` and `parseLogId` in the response.

---

## Step 4: API — Update feedback endpoint

**File:** `packages/api/src/routes/records.ts`

Update `POST /parse/feedback` to:
- Accept `parseLogId` (number) + `finalResponse` (object)
- Update the `parse_logs` row: set `final_result` and `was_corrected`
- Keep the existing keyword mapping upsert logic (builds the dictionary)
- Remove `aiResponse` from the schema (it's already in `parse_logs.parse_result`)

```typescript
parseRecordFeedbackSchema = z.object({
  parseLogId: z.number(),
  finalResponse: z.record(z.string(), z.unknown()),
});
```

On feedback:
1. Fetch the log row by ID to get `inputText` and `parseResult`
2. Compare `parseResult` vs `finalResponse` → set `was_corrected = true` if tagId or accountId changed
3. Update the log row with `final_result` and `was_corrected`
4. Run keyword mapping upserts (existing logic, re-extracts keywords from `inputText`)

---

## Step 5: Frontend — Wire up feedback from QuickRecordModal

**File:** `packages/web/src/components/QuickRecordModal/QuickRecordModal.vue`

Currently `lastParsed` and `lastText` are stored but never used for feedback.

Pass `parseLogId` to `RecordFormModal` via `prefillData` or a new prop.

**File:** `packages/web/src/components/RecordFormModal/RecordFormModal.vue`

After a successful save (in `onSubmit`), if the record came from a parse (has `parseLogId`):
- Call `POST /parse/feedback` with `{ parseLogId, finalResponse: payload }`
- Fire-and-forget (don't block the UI)

---

## Step 6: API endpoint for parse stats

**File:** `packages/api/src/routes/records.ts`

Add `GET /records/parse/stats`:

```json
{
  "total": 68,
  "byResolution": { "name_match": 45, "keyword": 12, "ai": 8, "none": 3 },
  "aiCalls": 11,
  "aiSuccessRate": 0.73,
  "correctionRate": 0.22,
  "savedCount": 60,
  "cancelledCount": 8
}
```

Simple aggregate query on `parse_logs`.

---

## Files to Modify

| File | Changes |
|---|---|
| `packages/api/src/db/schema/parseCorrections.ts` | Delete |
| `packages/api/src/db/schema/parseLogs.ts` | Create |
| `packages/api/src/db/schema/index.ts` | Update export |
| `packages/shared/src/records.ts` | Add `resolvedBy`, `parseLogId` to ParsedRecord, update feedback schema |
| `packages/api/src/routes/records.ts` | Track resolvedBy, log parse calls, update feedback endpoint, add stats endpoint |
| `packages/web/src/components/QuickRecordModal/QuickRecordModal.vue` | Pass parseLogId to RecordFormModal |
| `packages/web/src/components/RecordFormModal/RecordFormModal.vue` | Submit feedback on save when parseLogId exists |

## Implementation Order

1. DB: delete parseCorrections, create parseLogs, generate migration
2. Shared types: resolvedBy, parseLogId, update feedback schema
3. API: track resolvedBy in parse endpoint, insert parse_logs row
4. API: update feedback endpoint to use parseLogId
5. API: add stats endpoint
6. Frontend: pass parseLogId through QuickRecordModal → RecordFormModal
7. Frontend: submit feedback on save
8. Test end-to-end

## Verification

1. `pnpm db:generate` + `pnpm db:migrate`
2. Quick record "uber 3500" → parse_logs row created with resolvedBy=name_match
3. Save the record → parse_logs row updated with final_result, was_corrected
4. Quick record "carrefour 5000" → parse_logs row with resolvedBy=ai (or none)
5. Correct it to Supermercado → keyword_mappings gets "carrefour"→Supermercado
6. Quick record "carrefour 8000" → resolvedBy=keyword (AI not called)
7. `GET /records/parse/stats` returns correct counts
8. `pnpm typecheck` passes
