# CLAUDE.md

## Project

Expensr — Personal Credit Card Analyzer. Tracks multi-currency transactions (ARS, USD, CLP), matches them with user invoices, and calculates debts owed by others. pnpm workspaces monorepo.

## Ignore

Always ignore `packages/legacy/` and its contents. Do not read, modify, reference, or suggest changes to any file under that directory. It exists only as archived reference and is not part of the active codebase.

## Commands

```bash
pnpm dev            # Vue SPA + Hono API (single Vite process)
pnpm build          # Production build
pnpm preview        # Build + local wrangler dev
pnpm deploy:cf      # Build + deploy to Cloudflare Workers
pnpm typecheck      # TypeScript check
pnpm dev:api        # Standalone API dev via wrangler
pnpm typegen:cf     # Regenerate Cloudflare binding types
```

## Structure

```
packages/
  shared/              # Shared TS types + tsconfig presets
  api/                 # Hono API (pure route library)
  web/                 # Vue 3 SPA + Cloudflare deployment seat
  legacy/              # Archived (ignored)
pnpm-workspace.yaml    # Workspace config + dependency catalog
```

## Packages

| Package | Name | Description |
|---------|------|-------------|
| `packages/shared` | `@slzr/expensr-shared` | Shared types + tsconfig presets |
| `packages/api` | `@slzr/expensr-api` | Hono API (Cloudflare Workers) |
| `packages/web` | `@slzr/expensr-web` | Vue 3 SPA + deployment seat |

## Architecture

Single Cloudflare Worker serves Vue SPA + Hono API. `packages/web/server/index.ts` imports the Hono app from `packages/api` (thin bridge pattern). `@cloudflare/vite-plugin` builds both frontend + worker.

## API

Hono app with `.basePath("/api")`. Current routes:

- `GET /api/name` — test endpoint

## Currency & Rates

- **ARS:** direct, no conversion
- **USD→ARS:** 1,410 (blue compra rate, Jose sold 5,325 USD to pay card)
- **CLP→USD:** per-transaction rate from bank statement (avg ~896 CLP/USD)
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

## UI Stack

- Vue 3 (Vite + Composition API) + Tailwind CSS 4 + Hono + TypeScript
- Fonts: Bricolage Grotesque + Manrope + JetBrains Mono
- Cool light theme (blue-gray tones), currency color-coding (ARS=amber, USD=green, CLP=pink, favors=purple)

## Pending

- Tx #41 (Skechers 78,980 CLP) missing invoice
- ARS (9) and USD (6) transactions have no invoices yet
