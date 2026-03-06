# Expensr

Personal credit card analyzer. Tracks multi-currency transactions (ARS, USD, CLP), matches them with invoices, and calculates debts owed by others.

## Architecture

Single Cloudflare Worker serves both the Vue SPA and Hono API. The `@cloudflare/vite-plugin` handles building frontend assets + worker bundle in one `vite build`.

```
Browser request
  |
  +-- /api/*  --> Cloudflare Worker (Hono)
  +-- /*      --> Static assets (Vue SPA with SPA fallback)
```

`packages/web` is the deployment seat — it owns `wrangler.jsonc` and a thin `server/index.ts` bridge that imports the Hono app from `packages/api`. This keeps API logic separate while deploying as a single Worker.

## Monorepo

pnpm workspaces with shared dependency catalog.

| Package | Name | Description |
|---------|------|-------------|
| `packages/shared` | `@slzr/expensr-shared` | Shared types + tsconfig presets |
| `packages/api` | `@slzr/expensr-api` | Hono API (pure route library) |
| `packages/web` | `@slzr/expensr-web` | Vue 3 SPA + Cloudflare deployment |
| `packages/legacy/` | — | Archived reference apps (ignored) |

## Commands

All commands run from the monorepo root:

```bash
pnpm dev            # Vue SPA + Hono API (single Vite process)
pnpm build          # Production build (static assets + worker bundle)
pnpm preview        # Build + local wrangler dev (production preview)
pnpm deploy:cf      # Build + deploy to Cloudflare Workers
pnpm typecheck      # TypeScript check across packages
pnpm dev:api        # Standalone API dev via wrangler
pnpm typegen:cf     # Regenerate Cloudflare binding types
```

## Structure

```
packages/
  shared/                # Shared TS types + tsconfig presets
    src/index.ts         # Types and utilities
    tsconfig.base.json   # Base config (all packages extend this)
    tsconfig.vue.json    # Vue/DOM preset
    tsconfig.node.json   # Node/Worker preset
  api/                   # Hono API server
    src/index.ts         # Routes, export default app
    wrangler.jsonc       # Standalone dev config
  web/                   # Vue 3 SPA + deployment seat
    server/index.ts      # Thin bridge: imports Hono from api
    src/                 # Vue application source
    wrangler.jsonc       # Production Worker config
    vite.config.ts       # vue() + cloudflare() plugins
  legacy/                # Archived (not part of active codebase)
.editorconfig            # Editor formatting rules
.node-version            # fnm: Node 24
pnpm-workspace.yaml      # Workspace config + dependency catalog
```

## Tech Stack

- **Frontend**: Vue 3 (Composition API) + Vite 7 + TypeScript
- **API**: Hono on Cloudflare Workers
- **Deployment**: Cloudflare Workers (single Worker)
- **Build**: `@cloudflare/vite-plugin` (unified frontend + worker build)
- **Package Manager**: pnpm 10 (corepack via `packageManager` field)
- **Node**: 24 LTS (fnm via `.node-version`)

## Scaffold Origin

The project was scaffolded from two Cloudflare templates:

- **API**: [cloudflare-hono template](https://github.com/cloudflare/workers-sdk/tree/main/packages/create-cloudflare/templates/hono/workers/templates)
- **Web**: [cloudflare-vue template](https://github.com/cloudflare/workers-sdk/tree/main/packages/create-cloudflare/templates/vue/workers/ts)

Key decisions from the scaffold investigation:
- **Single Worker** over two Workers — no CORS, one deploy, lower cost
- **Thin bridge pattern** — `web/server/index.ts` re-exports the Hono app from the api package
- **Shared tsconfig presets** — replaced `@vue/tsconfig` and `@tsconfig/node24` with local presets in `@slzr/expensr-shared`
- **pnpm catalog** — shared versions for `typescript`, `@types/node`, `wrangler`
