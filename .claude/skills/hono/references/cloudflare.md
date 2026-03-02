# Hono on Cloudflare Workers

## How It Works

`export default app` — same as Vercel. Workers run on V8 isolates at the edge (300+ cities), ~0ms cold starts. Fastest runtime for Hono.

## Setup

```bash
npm create hono@latest my-app  # select cloudflare-workers template
```

Entry point `src/index.ts`:
```typescript
import { Hono } from "hono";
const app = new Hono();
app.get("/", (c) => c.text("Hello Workers!"));
export default app;
```

## wrangler.toml

```toml
main = "src/index.ts"
minify = true
assets = { directory = "public" }  # static files
```

## Typed Bindings

```typescript
type Bindings = {
  DB: D1Database;
  KV: KVNamespace;
  BUCKET: R2Bucket;
  API_SECRET: string;
};

const app = new Hono<{ Bindings: Bindings }>();

app.get("/", async (c) => {
  const { results } = await c.env.DB.prepare("SELECT * FROM users").all();
  return c.json({ users: results });
});
```

Access all bindings via `c.env`. Type them in the generic to get autocomplete.

## D1 (SQLite Database)

```typescript
// Read
const { results } = await c.env.DB.prepare("SELECT * FROM items").all();
const item = await c.env.DB.prepare("SELECT * FROM items WHERE id = ?").bind(id).first();

// Write
await c.env.DB.prepare("INSERT INTO items (id, name) VALUES (?, ?)").bind(id, name).run();
await c.env.DB.prepare("DELETE FROM items WHERE id = ?").bind(id).run();
```

Free tier: 5GB storage, 5M rows read/day, 100K rows written/day.

## KV (Key-Value)

```typescript
await c.env.KV.put("key", "value");
const val = await c.env.KV.get("key");
await c.env.KV.delete("key");
```

## R2 (Object Storage)

```typescript
await c.env.BUCKET.put("file.txt", content);
const obj = await c.env.BUCKET.get("file.txt");
```

## Environment Variables

Dev: create `.dev.vars` file (dotenv format). Production: set in Cloudflare dashboard.

```
SECRET_KEY=value
API_TOKEN=xyz
```

Access: `c.env.SECRET_KEY`

## Middleware with Env

Bindings aren't available at top level — pass them inside middleware:

```typescript
app.use("/auth/*", async (c, next) => {
  const auth = basicAuth({ username: c.env.USERNAME, password: c.env.PASSWORD });
  return auth(c, next);
});
```

## Static Assets

Set `assets = { directory = "public" }` in `wrangler.toml`. Files in `public/` served automatically.

## Dev & Deploy

```bash
npm run dev      # local dev on :8787 (wrangler)
npm run deploy   # deploy to Cloudflare
```

## Scheduled Handlers

```typescript
export default {
  fetch: app.fetch,
  scheduled: async (batch, env) => { /* cron logic */ },
};
```

## Free Tier

- 100K requests/day
- 10ms CPU time/request
- D1: 5GB, 5M reads/day, 100K writes/day
- KV: 100K reads/day, 1K writes/day
- R2: 10GB, 10M reads/month
