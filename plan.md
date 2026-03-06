# Expensr Implementation Plan

## Context

Build the Expensr expense tracking app in a pnpm monorepo. Backend API in `packages/api/`, frontend SPA in `packages/web/`, shared types in `packages/shared/`. Single Cloudflare Worker deployment.

## Current State (scaffolding complete)

### Done

- Monorepo structure with pnpm workspaces + dependency catalog
- `@slzr/expensr-shared`: tsconfig presets (base, vue, node) replacing `@vue/tsconfig` and `@tsconfig/node24`; placeholder shared types and utilities
- `@slzr/expensr-api`: Hono app with `.basePath("/api")`, `CloudflareBindings` type, standalone wrangler dev
- `@slzr/expensr-web`: Vue 3 + Vite 7, `@cloudflare/vite-plugin`, thin bridge in `server/index.ts`
- API-web connection verified: `pnpm dev` starts both with HMR
- Consolidated root `.gitignore` (merged from all packages)
- Root `.editorconfig`, `.node-version` (24 for fnm), `.vscode/settings.json`
- Root `package.json` scripts for monorepo management
- `packageManager: "pnpm@10.30.3"` for corepack

### Architecture

```
packages/web/                    packages/api/                  packages/shared/
Vue 3 SPA (Vite + Tailwind 4)     Hono route library             Shared TS types
  + server/index.ts bridge    →  (pure export, no server)  ←   + tsconfig presets
  + wrangler.jsonc
  + @cloudflare/vite-plugin
```

- `@cloudflare/vite-plugin` runs both Vue HMR + miniflare-powered Worker locally
- `packages/web/server/index.ts` imports Hono app from `packages/api`
- `packages/api` is a pure Hono library (`export default app`)
- Deploy: `vite build && wrangler deploy` from packages/web — single Worker serves SPA + API

## Data Models (in `packages/shared/`)

### Account
```typescript
interface Account {
  id: string; name: string; code: string;
  currency: "ARS" | "USD" | "CLP";
  type: "bank" | "cash" | "credit_card" | "digital_wallet";
  color: string; icon: string;
  initialBalance: number;
  createdAt: string; updatedAt: string;
}
```

### Category
```typescript
interface Category {
  id: string; name: string; code: string;
  type: "expense" | "income" | "transfer";
  color: string; icon: string;
  createdAt: string; updatedAt: string;
}
```

### Tag (belongs to Category)
```typescript
interface Tag {
  id: string; name: string;
  categoryId: string;
  pattern?: string;
  createdAt: string; updatedAt: string;
}
```

### Transaction
```typescript
interface Transaction {
  id: string; date: string;
  accountId: string;
  amount: number;
  description: string;
  tagIds: string[];
  note?: string;
  createdAt: string; updatedAt: string;
}
```

### Split (shared expense)
```typescript
interface Split {
  id: string; transactionId: string;
  personName: string;
  amount: number;
  settled: boolean;
  settledAt?: string; note?: string;
  createdAt: string; updatedAt: string;
}
```

### Consolidation (account reconciliation)
```typescript
interface Consolidation {
  id: string; accountId: string;
  date: string;
  actualBalance: number;
  trackedBalance: number;
  difference: number;
  note?: string; createdAt: string;
}
```

## API Routes

| Resource | Routes |
|----------|--------|
| Accounts | `GET/POST /api/accounts`, `GET/PUT/DELETE /api/accounts/:id` |
| Categories | `GET/POST /api/categories`, `GET/PUT/DELETE /api/categories/:id` |
| Tags | `GET/POST /api/tags`, `PUT/DELETE /api/tags/:id` |
| Transactions | `GET/POST /api/transactions`, `GET/PUT/DELETE /api/transactions/:id` |
| Splits | `GET/POST /api/splits`, `PUT/DELETE /api/splits/:id`, `PATCH /api/splits/:id/settle` |
| Consolidations | `GET/POST /api/consolidations`, `DELETE /api/consolidations/:id` |
| Dashboard | `GET /api/dashboard?month=YYYY-MM` |
| Debts | `GET /api/debts` |

## Implementation Steps

### Step 1: Shared types
- Add all data model interfaces to `packages/shared/src/index.ts`

### Step 2: API routes
- `src/routes/accounts.ts` — full CRUD
- `src/routes/categories.ts` — full CRUD
- `src/routes/tags.ts` — full CRUD
- `src/routes/transactions.ts` — CRUD with filtering
- `src/routes/splits.ts` — CRUD + settle toggle
- `src/routes/consolidations.ts` — CRUD
- `src/routes/dashboard.ts` — aggregated data + debts

### Step 3: Web setup
- Add Tailwind CSS 4 (`@tailwindcss/vite`)
- `src/router.ts` — app routes
- `src/styles/main.css` — Tailwind theme
- `src/lib/api.ts` — typed fetch wrapper
- `src/components/ui/` — shared UI components

### Step 4: Accounts & Categories views
- Composables, CRUD views, forms

### Step 5: Transactions view
- Tag auto-categorization, filtering, CRUD

### Step 6: Splits & Debts
- Shared expense management, settlement tracking

### Step 7: Dashboard & Consolidation
- Account balances, recent txs, debts summary, reconciliation

## Design

- Vue 3 (Composition API) + Tailwind CSS 4 + TypeScript
- Fonts: Bricolage Grotesque + Manrope + JetBrains Mono
- Cool light theme (blue-gray tones)
- Currency color-coding: ARS=amber, USD=green, CLP=pink, favors=purple

## Future (out of scope)

- KV or D1 migration for production persistence (Workers have no filesystem)
- Production Cloudflare deployment (infrastructure ready, needs storage migration)
