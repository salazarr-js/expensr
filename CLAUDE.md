# CLAUDE.md

## Project

Personal Credit Card Analizer. Tracks multi-currency transactions (ARS, USD, CLP), matches them with user invoices, and calculates debts owed by others.

## Commands

```bash
npm run dev    # start dev server with watch (tsx watch src/server.ts)
npm start      # start server (port 3000)
```

## Structure

```
public/
  index.html          # Vue 3 SPA — UI markup + logic
  styles.css          # All CSS styles (extracted from index.html)
src/
  server.ts           # Express 5 API server
  types.ts            # TypeScript types (Transaction, Invoice)
data/
  transactions.json   # 53 transactions extracted from resume.pdf
  invoices.json       # 40 user-entered invoices linked to transactions
resume.pdf            # Original credit card statement
```

## API

- `GET /api/transactions` — list all
- `PATCH /api/transactions/:id` — update (e.g. category)
- `GET /api/invoices` — list all
- `POST /api/invoices` — create
- `PUT /api/invoices/:id` — update
- `DELETE /api/invoices/:id` — delete

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

- Vue 3 (CDN, Composition API) + Express 5 + TypeScript
- Fonts: Bricolage Grotesque + Manrope + JetBrains Mono
- Cool light theme (blue-gray tones), currency color-coding (ARS=amber, USD=green, CLP=pink, favors=purple)

## Pending

- Tx #41 (Skechers 78,980 CLP) missing invoice
- ARS (9) and USD (6) transactions have no invoices yet
