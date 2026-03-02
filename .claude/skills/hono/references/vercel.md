# Hono on Vercel

## How It Works

Vercel auto-detects Hono via `export default app` at `src/index.ts`, `src/server.ts`, or `src/app.ts` (also root-level). Routes become serverless functions. Zero config for simple projects.

**Requirements:** `"type": "module"` in package.json. No build scripts needed — Vercel compiles TS internally.

## Monorepo Setup

Set Vercel project root to `packages/api` in dashboard. Add `vercel.json`:

```json
{
  "installCommand": "cd ../.. && pnpm install",
  "buildCommand": "cd ../.. && pnpm --filter @my/web build-only && cp -r ../web/dist/* ./public/",
  "rewrites": [
    { "source": "/api/(.*)", "destination": "/api/$1" },
    { "source": "/((?!api/).*)", "destination": "/index.html" }
  ]
}
```

## Static Files

Put in `public/` — Vercel CDN serves them. `serveStatic()` from `@hono/node-server` is **ignored** on Vercel.

## Gotchas

- **Read-only FS:** `fs.readFileSync` works (bundled at deploy), `fs.writeFileSync` fails. Use a DB for mutations.
- **No `.listen()`:** entry file must `export default app`.
- **Cold starts:** use `hono/quick` preset for faster startup.
- **Env vars:** set in Vercel dashboard, access via `process.env.VAR` or `env(c)` from `"hono/adapter"`.
- **Streaming:** works via `stream()`, `streamText()`, `streamSSE()`.

## Local Dev

Use `@hono/node-server` in `dev.ts`, proxy frontend `/api/*` to Hono port via Vite/Next config.
