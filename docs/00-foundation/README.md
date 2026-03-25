# Foundation — Project Setup & Infrastructure

## What shipped

pnpm monorepo with three packages serving a single Cloudflare Worker.

- **Monorepo**: pnpm workspaces — `shared` (types/schemas), `api` (Hono routes), `web` (Vue SPA + CF Worker bridge)
- **Single Worker**: `packages/web/server/index.ts` imports the Hono app from `packages/api` (thin bridge pattern)
- **Database**: Drizzle ORM + Cloudflare D1 (SQLite). Schema-as-TypeScript, migrations via `drizzle-kit`
- **Frontend**: Vue 3 + Nuxt UI 4 + Tailwind CSS 4 + TypeScript
- **Layout system**: Multi-layout via Vue Router nested routes (DashboardLayout, BaseLayout)
- **Theme**: Light/dark/system with Teal primary, Zinc neutral
- **Fonts**: Bricolage Grotesque (heading), Manrope (body), JetBrains Mono (mono)
- **DB sync CLI**: push/pull data between local and production D1

## Design decisions

- **Single Worker, not separate API** — `@cloudflare/vite-plugin` builds both frontend + worker together. No CORS, no separate deploy. The API is a pure route library, not a standalone server.
- **Drizzle over raw SQL** — type-safe schema definitions, auto-generated migrations, but still close to SQL (no magic ORM layer).
- **Nuxt UI without Nuxt** — using `@nuxt/ui/vite` plugin for Vue 3 SPA. Gets the component library without the Nuxt framework overhead.
- **No custom component wrappers** — use Nuxt UI components as-is. No `:ui` prop overrides, no global theme overrides.
- **Cloudflare Access** — auth via email OTP, no custom auth system needed for single-user app.

## Files in this folder

- [brief.md](brief.md) — product vision and core concepts
- [database.md](database.md) — DB schema reference and D1 CLI commands
- [db-sync.md](db-sync.md) — push/pull CLI for local ↔ production data
- [changelog-plan.md](changelog-plan.md) — auto-generated changelog approach
