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
    src/pages/         # Page components (Dashboard, NotFound, ...)
    src/router/        # Vue Router config
    server/            # CF Worker bridge (imports Hono app)
  legacy/              # Archived (ignored)
docs/
  brief.md             # Product vision and concepts
  plan.md              # Implementation timeline
```

## Architecture

Single Cloudflare Worker serves Vue SPA + Hono API. `packages/web/server/index.ts` imports the Hono app from `packages/api` (thin bridge pattern). `@cloudflare/vite-plugin` builds both frontend + worker.

## API

Hono app with `.basePath("/api")`. Current routes:

- `GET /api/name` — test endpoint

## UI Stack

- Vue 3 (Composition API) + Nuxt UI 4 + Tailwind CSS 4 + TypeScript
- Nuxt UI: component library (UApp, UHeader, UMain, UFooter, UContainer, UButton, etc.)
- Light-only theme (`colorMode: false` in Nuxt UI vite plugin)
- Fonts: Bricolage Grotesque, Manrope, JetBrains Mono

## Currency

User-defined on each account (visual only). No hardcoded rates.
