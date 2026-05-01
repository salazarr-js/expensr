# Expensr — CC Analizer

Standalone credit card statement analyzer. Parses Galicia Visa PDF statements into structured JSON, lets you categorize transactions, track installments, link invoices, and analyze spending.

## Stack

- Express 5 API (`server.ts`)
- Vue 3 via CDN (no build step)
- Plain CSS (`styles.css`)
- TypeScript types in `types.ts`
- Data persisted as JSON files in `data/` (gitignored — personal CC data)

## Usage

```bash
pnpm dev:cc     # from project root (port 3000, auto-increments if busy)
```

Open `http://localhost:3000` — Express serves the frontend from `public/`.

## Multi-statement support

The app supports switching between CC statement periods. Drop JSON files in `data/`:

```
data/
  visa-2026-01.json              # January statement
  visa-2026-03.json              # March statement
  visa-2026-04.json              # April statement
  invoices-visa-2026-01.json     # Invoices linked to January
  invoices-visa-2026-04.json     # Invoices linked to April
```

Each statement has its own invoices file (created automatically). Switch between periods via the dropdown in the header.

**Generating statement JSON:** Use Claude Code — paste or drop the CC PDF in `resumes/`, Claude reads it and generates the JSON in the correct format.

## Files

```
server.ts       # Express API — transactions + invoices CRUD, multi-statement
types.ts        # TypeScript interfaces (Transaction, Invoice, TransactionsFile)
public/
  index.html    # Vue 3 CDN frontend (SPA, ~750 lines)
  styles.css    # Design system (CSS variables, components)
data/           # JSON data per statement period (gitignored)
```

## Features

- **Transaction list** with search, filter (all/matched/unmatched)
- **Invoice CRUD** — quick entry form, link to transactions
- **Smart matching** — suggests matching transactions by amount/description/date similarity
- **Multi-currency** — ARS, USD, CLP with per-currency summaries
- **Installment tracking** — detects cuota patterns (e.g., "2/3")
- **Spending breakdown** — by category with drill-down
- **Shared expenses** — `favor_for` field tracks who owes what
- **Real-time save** — changes persisted immediately to JSON

## TODO

### Use expensr categories/tags for categorization

Currently the app has its own hardcoded category system (`gym`, `uber`, `supermarket`, etc.) that doesn't match expensr's categories and tags. Should:

- [ ] Fetch categories and tags from expensr API (`GET /api/categories/tags`)
- [ ] Replace hardcoded categories with expensr tag IDs
- [ ] Use expensr's tag colors and icons for display
- [ ] When categorizing a CC transaction, the selected tag should be an expensr tag — so when the data eventually feeds into expensr records, the tag is already correct
- [ ] Category auto-detection should use expensr's `keyword_mappings` table

### Make the app generic (not CLP-centric)

The current UI is heavily focused on CLP (Chilean Peso) spending — chart breakdown, category analysis, and shared expenses are all CLP-specific. Should:

- [ ] Remove CLP-specific sections or make them dynamic per currency
- [ ] Main view should work with just ARS + USD (the common case)
- [ ] CLP/other currencies become optional — shown only when present in the data
- [ ] Summary strip should adapt to whatever currencies are in the current statement
- [ ] Shared expenses (`favor_for`) should work for any currency, not just CLP

### Integration with expensr

- [ ] Export button: convert CC transactions into expensr records (via `POST /api/records/batch`)
- [ ] Map CC transaction → expensr record (date, amount, tag, account, note)
- [ ] Account: should map to a "Galicia Visa" account in expensr
- [ ] Installments: each cuota charge becomes a separate expense record in the month it's billed
- [ ] Fees/taxes: optionally import as Finance/Fees tagged records

### Claude Code integration

- [ ] `/expensr-cc` skill: reads CC PDF from `resumes/`, generates statement JSON
- [ ] Skill auto-categorizes using expensr tags (via keyword_mappings API)
- [ ] Skill detects installments, recurring charges, and new merchants
- [ ] Statement comparison (month vs month) via Claude analysis
