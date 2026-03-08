# @slzr/expensr-web

Vue 3 SPA and Cloudflare Workers deployment seat. Serves the frontend and bridges to the Hono API via a thin `server/index.ts` entry point.

Scaffolded from [cloudflare-vue template](https://github.com/cloudflare/workers-sdk/tree/main/packages/create-cloudflare/templates/vue/workers/ts).

## Commands

```bash
pnpm dev          # Vite dev server (Vue HMR + miniflare Worker)
pnpm build        # Type-check + production build
pnpm preview      # Build + local wrangler dev
pnpm deploy:cf    # Build + deploy to Cloudflare Workers
pnpm type-check   # TypeScript check only
```

## How It Works

The `@cloudflare/vite-plugin` runs both Vue HMR and a miniflare-powered Worker locally with a single `vite` command. In production, `vite build` compiles the Vue SPA into static assets and `server/index.ts` into a Worker bundle.

```
vite build
  +-- src/     --> static assets (HTML/JS/CSS)
  +-- server/  --> Cloudflare Worker bundle
        imports @slzr/expensr-api (Hono routes)
```

`wrangler.jsonc` configures SPA fallback (`not_found_handling: "single-page-application"`) so Vue Router works with client-side routing.

## TypeScript

Uses project references with three tsconfig zones:

| Config | Extends | Scope |
|--------|---------|-------|
| `tsconfig.app.json` | `@slzr/expensr-shared/tsconfig.vue.json` | Vue browser code (`src/`) |
| `tsconfig.node.json` | `@slzr/expensr-shared/tsconfig.node.json` | Vite/tool config |
| `tsconfig.worker.json` | `./tsconfig.node.json` | Worker code (`server/`) |

## Docs

- [Vue 3](https://vuejs.org/)
- [Vite](https://vite.dev/)
- [@cloudflare/vite-plugin](https://developers.cloudflare.com/workers/vite-plugin/)
- [Cloudflare Workers Static Assets](https://developers.cloudflare.com/workers/static-assets/)


---

## Resources

- https://ui.nuxt.com/
- https://dashboard-vue-template.nuxt.dev/

## Templates
- https://github.com/nuxt-ui-templates/starter-vue
- https://github.com/nuxt-ui-templates/dashboard-vue


## Skills
- https://github.com/vuejs-ai/skills
- https://github.com/onmax/nuxt-skills
- https://github.com/antfu/skills
- https://github.com/nuxt/ui/tree/v4/skills
