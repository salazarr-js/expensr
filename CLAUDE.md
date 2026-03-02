# CLAUDE.md

## Project

Personal Credit Card Analizer. Tracks multi-currency transactions (ARS, USD, CLP), matches them with user invoices, and calculates debts owed by others. pnpm workspaces monorepo.

## Commands

```bash
pnpm dev       # start API (:3001) + Vite (:5173) concurrently
pnpm dev:api   # start API only (tsx watch, port 3001)
pnpm dev:web   # start Vite dev server only (port 5173, proxies /api → :3001)
pnpm build     # build Vue SPA (vite build)
pnpm typecheck # typecheck all packages
```

## Structure

```
packages/
  shared/
    src/index.ts        # TypeScript types (Transaction, Invoice, TransactionsFile)
  api/
    src/app.ts          # Hono app + error handlers + mounts routes
    src/server.ts       # Local dev server (@hono/node-server, port 3001)
    src/routes/
      transactions.ts   # GET + PATCH /api/transactions
      invoices.ts       # GET + POST + PUT + DELETE /api/invoices
    src/lib/
      data.ts           # JSON read/write helpers + typed loaders
      schemas.ts        # Zod validation schemas
    data/
      transactions.json # 53 transactions extracted from resume.pdf
      invoices.json     # 40 user-entered invoices linked to transactions
    vercel.json         # Vercel deployment config
    public/             # Vue build output (gitignored, populated by Vercel build)
  web/
    src/                # Vue 3 + Vite + Tailwind SPA
    vite.config.ts      # Tailwind plugin + /api proxy → :3001
  cc-analizer/          # Legacy Vue 3 CDN SPA (kept for reference)
pnpm-workspace.yaml     # Workspace config
tsconfig.base.json      # Shared TS config
resume.pdf              # Original credit card statement
```

## Packages

| Package | Name | Description |
|---------|------|-------------|
| `packages/shared` | `@slzr/shared` | Shared TypeScript types |
| `packages/api` | `@slzr/api` | Hono API server |
| `packages/web` | `@slzr/web` | Vue 3 + Vite + Tailwind SPA |
| `packages/cc-analizer` | `@slzr/cc-analizer` | Legacy Vue 3 CDN frontend (reference) |

## API

- `GET /api/transactions` — list all
- `PATCH /api/transactions/:id` — update (e.g. category)
- `GET /api/invoices` — list all
- `POST /api/invoices` — create
- `PUT /api/invoices/:id` — update
- `DELETE /api/invoices/:id` — delete

## Deployment (Vercel)

- Vercel project root: `packages/api`
- Hono auto-detected via `export default app` in `src/app.ts`
- `installCommand`: runs `pnpm install` from monorepo root
- `buildCommand`: builds Vue SPA → copies to `packages/api/public/`
- Static files served by Vercel CDN, API routes handled by Hono serverless
- SPA fallback: non-API routes rewrite to `/index.html`
- JSON file storage is read-only on Vercel (GET works, mutations need DB migration)

## Currency & Rates

- **ARS:** direct, no conversion
- **USD→ARS:** 1,410 (blue compra rate, Jose sold 5,325 USD to pay card)
- **CLP→USD:** per-transaction rate from bank statement (avg ~896 CLP/USD). See memory/rates.md
- **CLP→ARS path:** CLP → USD (bank rate) → ARS (×1,410)

## Taxes

- **DB RG 5617 (30%):** all foreign purchases. Bank tax base rate: 1,430.50 ARS/USD. Recoverable via AFIP.
- **IVA RG 4240 (21%):** digital services only (YouTube, Adobe, CapCut, LinkedIn, Google One)
- **Decision:** Jose charges debtors the base amount only, recovers 30% himself via AFIP.

## Debts (favor_for)

| Person | USD | Items |
|---|---|---|
| Wilmer | 372.89 | Paleta Adidas 286,790 CLP + Cable Thunderbolt 49,900 CLP |
| Gusmeli | 314.64 | Leon servicio carro 223,980 + Almuerzo mitad 45,991 + Loreal 11,490 CLP |
| Johan | 245.32 | Paleta Nox 221,990 CLP |
| Gaby | 172.05 | Farmacia skincare 113,346 + Voce zapatos 40,790 CLP |
| **Total** | **1,104.90** | |

Names normalized: always capitalized (Wilmer, Johan, Gaby, Gusmeli).

## Split Transactions

- **Tx #19** (Mercado Padel 508,780 CLP): Wilmer 286,790 + Johan 221,990 (two invoices, same tx)
- **Tx #35** (Cruzverde 148,676 CLP): Gaby 113,346 + Gusmeli 11,490 + Jose 23,840
- **Tx #27** (Almuerzo 91,982 CLP): only half (45,991) is Gusmeli's debt

## CLP Categories (chart in UI)

clothing, food, shopping, fuel, transport, parking, pharmacy — chart excludes favor amounts, shows personal spending only. "Deudas de otros" section below shows per-person bars.

## UI Stack

- Vue 3 (Vite + Composition API) + Tailwind CSS 4 + Hono + TypeScript
- Fonts: Bricolage Grotesque + Manrope + JetBrains Mono
- Cool light theme (blue-gray tones), currency color-coding (ARS=amber, USD=green, CLP=pink, favors=purple)

## Pending

- Tx #41 (Skechers 78,980 CLP) missing invoice
- ARS (9) and USD (6) transactions have no invoices yet
