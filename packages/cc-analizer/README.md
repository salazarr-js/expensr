# Expensr — cc-analizer (Legacy)

Original single-app version before the monorepo migration. Express API + Vue 3 CDN frontend. Kept for reference.

## Stack

- Express 5 API (`server.ts`)
- Vue 3 via CDN (no build step)
- Plain CSS (`styles.css`)
- TypeScript types in `types.ts`

## Files

```
server.ts       # Express API (transactions + invoices CRUD)
types.ts        # TypeScript interfaces (Transaction, Invoice, TransactionsFile)
index.html      # Vue 3 CDN frontend
styles.css      # Plain CSS
public/         # Static files served by Express
data/           # JSON data (transactions.json, invoices.json)
```

## Usage

```bash
pnpm dev        # tsx watch server.ts (port 3000)
```

Open `http://localhost:3000` — Express serves the frontend from `public/`.

## Note

This package is **not part of the active development**. The current app is split across `packages/api` (Hono), `packages/web` (Vue 3 + Vite + Tailwind), and `packages/shared` (types).
