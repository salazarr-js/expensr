# Claude as Data Intermediary — Architecture Plan

**Status:** Planning (2026-05-01)

## Philosophy

**App = visual layer.** View data, basic edit, quick record from phone. Nothing else.
**Claude Code = data engine.** Bulk imports, reconciliation, keyword learning, data quality, bank statement processing.
**No bank-specific parsers.** Claude reads any bank format (Excel, CSV, PDF, raw text) and normalizes it. No parser code to write or maintain. The config file only stores personal tag mappings — not parsing logic.

## Token Efficiency Strategy

### 1. Config files over conversation context

Instead of explaining bank patterns, tag mappings, and parsing rules in every conversation, store them in files that skills read at runtime.

```
.expensr/
  bank-patterns.yaml    # bank-specific parsing rules + tag patterns
  state.yaml            # last reconcile state per account
```

**bank-patterns.json:**
```json
{
  "patterns": [
    { "match": "PAYU*AR*UBER", "tag": "Uber" },
    { "match": "DLO*Rappi", "tag": "Delivery" },
    { "match": "OSDE", "tag": "Health Plan" },
    { "match": "CONSORCIO PROPIETARIOS", "tag": "Rent" },
    { "match": "Compra venta de dolares", "tag": "Sale" }
  ],
  "offsetting": [
    "ANULACION PERCEPCION",
    "PERCEPCION RG",
    "DEV.COMPRA GALICIA",
    "UBER SHOPPER STATEMENT"
  ],
  "personKeywords": {
    "MARIA ESTELA": "Vegetables",
    "Xiaolan Zhang": null
  }
}
```

**state.json:**
```json
{
  "lastReconcile": {
    "galicia-ars": {
      "date": "2026-05-01",
      "file": "resumes/Extracto_00096002931.xlsx",
      "recordCount": 182,
      "lastBalance": 112275.41
    }
  }
}
```

Note: No bank-specific parsing rules in config. Claude reads any bank format (Excel, CSV, PDF, raw text) and figures out the structure. Config only stores **what to remember between sessions**: tag mappings, offsetting patterns, person keywords.

**Why:** Skills read these files (~2KB) instead of Claude re-discovering patterns each session (~5KB+ of conversation). Saves ~3KB per session × N sessions.

### 2. Compact API endpoints

Current `GET /records` returns ~500 bytes per record (all joins, all fields). Claude doesn't need icons, colors, people, splits.

**New: `GET /records?format=compact`**

```json
// Current: 500 bytes/record → 163 records = 80KB
{"id":1,"type":"expense","amount":23050,"date":"2026-04-20T12:00:00",
 "accountId":1,"accountName":"Galicia ARS","accountCurrency":"ARS",
 "tagId":null,"tagName":null,"tagIcon":null,"categoryId":null,
 "categoryName":null,"categoryColor":null,...}

// Compact: 80 bytes/record → 163 records = 13KB (6x smaller)
{"id":1,"d":"04-20","a":-23050,"n":"Xiaolan Zhang","t":null,"r":1}
```

Fields: `id`, `d` (date, short), `a` (signed amount), `n` (note), `t` (tag name or null), `r` (needsReview 0/1).

**New: `GET /accounts?format=compact`**

```json
// Current
{"id":1,"name":"Galicia ARS","balance":112275.41,"recordCount":163,...20 fields}

// Compact
{"id":1,"n":"Galicia ARS","b":112275.41,"rc":163,"gap":null}
```

### 3. Summary endpoints (avoid fetching all records)

**`GET /records/summary?accountId=1&yearMonth=2026-04`**

```json
{
  "total": 163,
  "expenses": 151,
  "income": 12,
  "needsReview": 45,
  "untagged": 45,
  "byTag": [
    {"tag": "Uber", "count": 28, "total": -385000},
    {"tag": "Delivery", "count": 8, "total": -280000},
    {"tag": null, "count": 45, "total": -1200000}
  ]
}
```

**Why:** Claude checks account health with 1 request (~500 bytes) instead of fetching 163 records (80KB).

### 4. File-based bank statement processing

Instead of pasting bank text into conversation (huge token cost), the workflow is:

1. User drops Excel/CSV/PDF in `resumes/` folder
2. Runs `/expensr-batch resumes/file.xlsx`
3. Skill reads the file directly (file read, not conversation)
4. **Claude parses the format** — no bank-specific parser code. Claude reads any structure and normalizes it.
5. Skill reads `bank-patterns.json` for tag mappings + offsetting rules
6. Skill reads `state.json` to know what was already processed
7. Processes → shows compact summary → confirms → inserts via batch API
8. Updates `state.json`

Token cost: ~5KB per session (skill instructions + summary output) vs ~50KB currently (raw bank text + record-by-record processing).

**No parsers to write or maintain.** Claude IS the parser. New bank? Just drop the file. Claude adapts. Only tag mappings are saved for next time.

### 5. Skill files minimize repeated instructions

Claude Code skills load their instructions from the skill file. The conversation only contains:
- User: `/expensr-batch resumes/may-2026.xlsx`
- Claude: reads skill → reads file → reads config → processes → shows summary → done

No re-explaining how to parse, what tags exist, what patterns to use. All in files.

## Changes Required

### Remove from app
- [ ] Draft records table, endpoint, page (temporary — no longer needed)
- [ ] Restore original `/quick` endpoint (uncomment)
- [ ] Keyword auto-learning on record edit (Claude handles this instead)

### Add to API
- [ ] `POST /records/batch` — create multiple (re-add, no UI)
- [ ] `POST /records/batch/update` — update multiple (re-add, no UI)
- [ ] `GET /records?format=compact` — minimal fields for Claude
- [ ] `GET /accounts?format=compact` — minimal fields for Claude
- [ ] `GET /records/summary` — aggregated stats without fetching all records
- [ ] `POST /records/reconcile` — compare bank data vs DB, fuzzy match, report diff

### Create config files
- [ ] `.expensr/bank-patterns.yaml` — bank parsing rules + tag patterns
- [ ] `.expensr/state.yaml` — reconcile state tracking

### Create Claude Code skills
- [ ] `/expensr-batch` — bank statement → parse → reconcile → insert
- [ ] `/expensr-reconcile` — Excel vs DB comparison, merge, enrich
- [ ] `/expensr-status` — quick account health check

### Modify app behavior
- [ ] Remove keyword auto-learning from record edit flow
- [ ] App stays: view + basic CRUD + quick record + monthly balances + dashboard

### Update docs
- [ ] Update `CLAUDE.md` — reflect new architecture (Claude as intermediary, app as visual layer)
- [ ] Update `docs/plan.md` — add intermediary architecture section, update evaluation log
- [ ] Update `docs/12-expensr-batch-skill/README.md` — remove hardcoded parser approach, reflect "Claude is the parser"
- [ ] Clean up old docs that reference removed features (batch, spreadsheet)
- [ ] Add `.expensr.example/` with template config files
- [ ] Update README (when open-sourcing) — explain the Claude Code workflow

## Token Budget Estimate

| Operation | Current | Optimized |
|-----------|---------|-----------|
| Monthly reconcile (163 records) | ~50KB | ~8KB |
| Status check | ~80KB (fetch all records) | ~1KB (summary endpoint) |
| Single record tagging context | ~5KB | ~2KB |
| Skill loading | N/A (conversation) | ~3KB (skill file, cached) |

~6x reduction in typical session token usage.
