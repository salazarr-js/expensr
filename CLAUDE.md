# CLAUDE.md

## Project

Expensr — Modern personal expense tracker. Frictionless recording, multi-currency accounts, shared expenses, smart categorization. pnpm workspaces monorepo.

## Ignore

Always ignore `packages/legacy/` and its contents.

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
    src/layouts/       # Layout components (DashboardLayout, BaseLayout)
    src/pages/         # Page components
    src/router/        # Vue Router config (nested routes per layout)
    server/            # CF Worker bridge (imports Hono app)
  legacy/              # Archived (ignored)
docs/
  brief.md             # Product vision and concepts
  plan.md              # Implementation timeline
```

## Architecture

Single Cloudflare Worker serves Vue SPA + Hono API. `packages/web/server/index.ts` imports the Hono app from `packages/api` (thin bridge pattern). `@cloudflare/vite-plugin` builds both frontend + worker.

## Layouts

Multi-layout system via Vue Router nested routes. Layouts are route components with `<RouterView />`.

- **DashboardLayout** — sidebar + panels for authenticated pages (`/dashboard/*`)
- **BaseLayout** — minimal centered layout for auth/public pages

To add a new layout: create `src/layouts/NewLayout.vue` with `<RouterView />`, add route group in `src/router/index.ts`.

## Routes

- `/` — Home (public, no layout)
- `/dashboard` — Dashboard
- `/dashboard/records` — Records
- `/dashboard/accounts` — Accounts
- `/dashboard/people` — People
- `/dashboard/settings` — Settings
- `/dashboard/*` — 404 with sidebar (DashboardNotFound)
- `/*` — 404 without layout (NotFound)

## API

Hono app with `.basePath("/api")`. Current routes:

- `GET /api/name` — test endpoint

## UI Stack

- Vue 3 (Composition API) + Nuxt UI 4 + Tailwind CSS 4 + TypeScript
- Dashboard components: UDashboardGroup, UDashboardSidebar, UDashboardPanel, UDashboardNavbar, UDashboardToolbar
- Light-only theme (`colorMode: false` in Nuxt UI vite plugin)
- Fonts: Bricolage Grotesque (heading), Manrope (body), JetBrains Mono (mono) via Fontsource

## Currency

User-defined on each account (visual only). No hardcoded rates.
