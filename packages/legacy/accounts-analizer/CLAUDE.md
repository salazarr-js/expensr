# Accounts Analyzer

Read-only dashboard for visualizing MercadoPago and Banco Galicia account statements. Part of the Expensr monorepo.

## Commands

```bash
pnpm dev        # dev server (vite, port 5173)
pnpm build      # typecheck + production build
pnpm typecheck  # vue-tsc --noEmit
```

## Stack

Vue 3 (Composition API) + Vite + Tailwind CSS 4 + TypeScript. No router, no API server, no charting library.

## Structure

```
public/
  all_documents.json    # merged data from all xlsx bank statements (fetched at runtime)
src/
  main.ts               # entry point
  App.vue               # root layout + tab switching (dashboard/transactions/people/spending)
  types.ts              # raw JSON shapes + normalized types
  styles/
    main.css            # tailwind import + @theme tokens (colors, fonts)
  lib/
    parse.ts            # parseLocaleNumber(), date parsers (DD-MM-YYYY, DD/MM/YYYY)
    normalize.ts        # raw JSON → NormalizedTransaction[] with categorization + person extraction
    categories.ts       # keyword → SpendingCategory mapping for enriching transactions
    format.ts           # fmtARS(), fmtDate(), fmtSigned()
  composables/
    useAccountsData.ts  # main composable: fetches JSON, normalizes, exposes all computed data
  components/
    AppHeader.vue       # sticky header + nav tabs
    StatCard.vue        # reusable stat widget
    Badge.vue           # colored badge (mp/galicia/favor/success/danger)
    TransactionRow.vue  # single transaction row with source dot, date, description, amount
  views/
    DashboardView.vue   # account cards + monthly bars + recent activity
    TransactionsView.vue # full list with search/filters/pagination
    PeopleView.vue      # debts by person with transfer history
    SpendingView.vue    # spending by category + merchant with expandable bars
```

## Data

`public/all_documents.json` contains 2 sections:

| Section | Source | Records | Amounts | Dates |
|---------|--------|---------|---------|-------|
| `mercadopago` | 3 account_statement xlsx | 138 txns | locale strings `"2.258.294,60"` | `DD-MM-YYYY` |
| `galicia` | Extracto xlsx | 407 txns | locale strings, debit/credit cols | `DD/MM/YYYY` |

## Key Data Patterns

- **Locale numbers:** dots = thousands separator, comma = decimal. `parseLocaleNumber()` in `lib/parse.ts` handles this.
- **Person extraction:** regex on descriptions — MP: `"Transferencia enviada/recibida [Name]"`, Galicia: `"TRANSFERENCIA A/DE TERCEROS [Name] [CUIT]"`.
- **Structural categories:** `transfer_in`, `transfer_out`, `payment`, `purchase`, `debt_debit`, `refund`, `income`, `service`, `tax`, `extraction`, `other`.
- **Spending categories:** keyword-based enrichment in `lib/categories.ts` — `salary`, `transport`, `food`, `groceries`, `housing`, `utilities`, `sports`, `health`, `shopping`, `family`, `entertainment`, `subscription`, `tax`, `transfer`, `other`.

## Design Tokens

Defined in `src/styles/main.css` via Tailwind `@theme`:

- **Fonts:** Bricolage Grotesque (display), Manrope (body), JetBrains Mono (mono)
- **Source colors:** MercadoPago = `--color-mp` (#00b4d8), Galicia = `--color-galicia` (#e65100)
- **Semantic:** success (green), danger (red), accent (purple), favor (purple)
- **Theme:** cool light blue-gray tones matching the root Expensr design system
