# Plan: Migrate to Vite + Vue SFC

## Context

The frontend is a single `public/index.html` (732 lines) using Vue 3 via CDN with all logic inline. As the app grows, this monolith is hard to maintain. Migrating to Vite + Vue SFC gives us: HMR, component splitting, TypeScript in the frontend, proper imports, and a modern dev experience.

## Architecture

```
client/                    # Vite Vue app (NEW)
  index.html               # Minimal HTML shell
  vite.config.ts
  tsconfig.json
  src/
    main.ts                # Vue app entry
    App.vue                # Root component (layout shell)
    types.ts               # Shared types (symlink or copy from src/types.ts)
    assets/
      styles.css           # Moved from public/styles.css
    composables/
      useApi.ts            # load(), saveInvoice(), removeInvoice()
      useFormatting.ts     # fmtNum, fmtUsd, fmtClp, currencyColor, parseAmount
      useMatching.ts       # normalize, textScore, amountScore, dateScore, scoreTransaction
    components/
      AppHeader.vue        # Logo, status badges, save indicator
      SummaryStrip.vue     # Progress bar, currency stats, grand total
      ClpChart.vue         # Category bars + favor bars + totals
      QuickEntryForm.vue   # 6-field form + duplicate warning
      SuggestedMatches.vue # Score-based match suggestions
      InvoicesList.vue     # Left column — sorted invoices with delete
      TransactionsList.vue # Right column — filtered/searchable transactions
server/                    # Renamed from src/ (NEW name)
  server.ts                # Express API (unchanged logic)
  types.ts                 # Shared types
data/                      # Unchanged
  transactions.json
  invoices.json
```

## Steps

### 1. Scaffold Vite project

Create `client/` with `npm create vue@latest` (Vue + TypeScript, no router/pinia/testing needed). Configure `vite.config.ts` with API proxy:

```ts
export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000'
    }
  },
  build: {
    outDir: '../public'  // Build output replaces old public/
  }
})
```

### 2. Update Express to serve Vite build

In `server/server.ts`, serve static from `public/` (Vite's build output) — this already works since Express serves `public/`. No change needed for production.

Update root `package.json` scripts:

```json
{
  "scripts": {
    "dev:server": "tsx watch server/server.ts",
    "dev:client": "cd client && npm run dev",
    "dev": "concurrently \"npm run dev:server\" \"npm run dev:client\"",
    "build": "cd client && npm run build",
    "start": "tsx server/server.ts"
  }
}
```

### 3. Extract composables

Extract pure logic from the inline script into 3 composables:

- **`useApi.ts`** — `load()`, `saveInvoice()`, `removeInvoice()` + reactive state (`transactions`, `invoices`, `saving`, `lastSaved`)
- **`useFormatting.ts`** — `fmtNum()`, `fmtUsd()`, `fmtClp()`, `currencyColor()`, `parseAmount()`
- **`useMatching.ts`** — `normalize()`, `textScore()`, `amountScore()`, `dateScore()`, `scoreTransaction()`

### 4. Create SFC components (7 components)

Split the template into components. Data flows down via props, events bubble up via emit:

| Component | Props (in) | Events (out) |
|---|---|---|
| **AppHeader** | matchedCount, totalInvoices, unmatchedCount, saving, lastSaved | — |
| **SummaryStrip** | summary, grandTotalArs, matchPercent | — |
| **ClpChart** | clpChart, clpChartTotal, clpFavorsTotal, clpFavorsByPerson | — |
| **QuickEntryForm** | form, canSubmit, duplicateWarning, suggestions | submit, update:form |
| **SuggestedMatches** | suggestions | linkAndAdd |
| **InvoicesList** | sortedInvoices, matchedTxIds | remove |
| **TransactionsList** | filteredTransactions, matchedTxIds, txFilter, txSearch | update:txFilter, update:txSearch, prefill |

**App.vue** owns the state (via composables) and wires props/events.

### 5. Move server to `server/`

Rename `src/` → `server/` to avoid confusion with `client/src/`. Update import paths in `server.ts` if needed. Share `types.ts` by having `client/src/types.ts` import from a shared location or simply copy the interfaces.

### 6. Migrate CSS

Move `public/styles.css` → `client/src/assets/styles.css`, import in `main.ts`. Google Fonts stay as a link in `client/index.html`.

### 7. Clean up

- Remove old `public/index.html` and `public/styles.css` (replaced by Vite build output)
- Update CLAUDE.md with new structure and commands
- Add `concurrently` as dev dependency

## Dev Workflow

```bash
# Development (2 servers: Vite HMR on 5173, Express API on 3000)
npm run dev

# Production build
npm run build    # outputs to public/
npm start        # Express serves public/ + API
```

## Migration Order (minimize risk)

1. Scaffold Vite + install deps (non-breaking, new folder)
2. Rename `src/` → `server/`
3. Create composables (pure functions, easy to test)
4. Create App.vue + components (port template section by section)
5. Verify everything works via Vite dev server
6. Build, verify Express serves built output
7. Delete old public/index.html

## Verification

1. `npm run dev` — both servers start, UI loads on localhost:5173
2. All API calls work (create/edit/delete invoices, load transactions)
3. CLP chart renders correctly with categories and favor bars
4. Quick entry form works with suggested matches
5. `npm run build && npm start` — production mode serves correctly on localhost:3000
