---
name: hono
description: "Hono API development: routes, middleware, Zod validation, error handling, testing (app.request), Node.js server, Vercel deploy, Express migration, RPC client. Trigger for any work in packages/api/src/ or mentions of Hono, endpoints, zValidator, app.ts, server.ts. Skip for Vue/frontend, Tailwind, charts, shared types, Vite config."
---

# Hono Quick Reference

Ultrafast web framework on Web Standard APIs. App is a pure handler — `export default app`, no `.listen()`.

## Context (`c`) Cheat Sheet

```typescript
// Request
c.req.param("id")              c.req.query("page")
c.req.header("Authorization")  await c.req.json()
c.req.valid("json")            await c.req.parseBody()

// Response
return c.json(data)             return c.json(data, 201)
return c.json({ error }, 404)   return c.text("ok")
return c.redirect("/path")      return c.body(null, 204)

// Variables (set in middleware, read in handlers)
c.set("user", data)   c.get("user")   c.var.user
```

## Routing

```typescript
app.get("/users", handler)           app.post("/users", handler)
app.put("/users/:id", handler)       app.delete("/users/:id", handler)
app.get("/animal/:type?", handler)   app.get("/files/*", handler)

// Params
const id = c.req.param("id")
const { orgId, userId } = c.req.param()
```

Route priority: first match wins. Specific before generic.

## Route Grouping

```typescript
const users = new Hono();
users.get("/", list).post("/", create).get("/:id", get);
export default users;

// Mount in app.ts
app.route("/api/users", users);
app.route("/api/posts", posts);
```

## RPC Client (End-to-End Type Safety)

Chain `.route()` calls and export the **chained** type — this is required for type inference:

```typescript
// server/app.ts
// ✅ Chain routes — one typed instance
const appRoutes = app
  .basePath("/api")
  .route("/users", usersRoute)
  .route("/posts", postsRoute);

export default app;
export type AppRoutes = typeof appRoutes;

// ❌ WRONG — separate calls lose type info
app.route("/users", usersRoute);
app.route("/posts", postsRoute);
export type AppRoutes = typeof app; // types are unknown
```

Frontend client via `hono/client`:

```typescript
import type { AppRoutes } from "@server/app";
import { hc } from "hono/client";

const client = hc<AppRoutes>("/");
const api = client.api;

// Fully typed — paths, methods, inputs, responses
const res = await api.users.$post({ json: input });
const data = await res.json();

// Route params + body
const res = await api.users[":id"].$patch({
  param: { id },
  json: updates,
});
```

## Middleware

Onion model: before `await next()` → handler → after `next()`.

```typescript
app.use(logger())                              // global
app.use("/api/*", cors())                      // path-scoped
app.get("/secret", authMiddleware, handler)     // per-route
```

Built-in: `cors`, `logger`, `compress`, `etag`, `basicAuth`, `bearerAuth`, `jwt`, `serveStatic`, `cache`, `secureHeaders`.

Typed custom middleware: use `createMiddleware` from `"hono/factory"`.

## Zod Validation

```typescript
import { zValidator } from "@hono/zod-validator";
app.post("/users", zValidator("json", schema), (c) => {
  const data = c.req.valid("json"); // typed
});
```

Targets: `"json"`, `"query"`, `"param"`, `"header"`, `"cookie"`, `"form"`. Can chain multiple validators on one route. See [references/api.md](references/api.md) for full Zod patterns and Drizzle integration.

## Error Handling

```typescript
import { HTTPException } from "hono/http-exception";
throw new HTTPException(404, { message: "Not found" });

app.onError((err, c) => {
  if (err instanceof HTTPException) return err.getResponse();
  return c.json({ error: "Internal server error" }, 500);
});
app.notFound((c) => c.json({ error: "Not found" }, 404));
```

## Testing

No server needed — `app.request()` returns a standard Response:

```typescript
const res = await app.request("/api/users");
const res = await app.request("/api/users", {
  method: "POST", body: JSON.stringify(data),
  headers: { "Content-Type": "application/json" },
});
```

## Node.js Dev Server

`app.ts` exports app, `server.ts` runs it via `@hono/node-server`:

```typescript
import { serve } from "@hono/node-server";
import app from "./app.js";
const server = serve({ fetch: app.fetch, port: 3001 });
process.on("SIGINT", () => { server.close(); process.exit(0); });
```

## Vercel

`export default app` — auto-detected, zero config. `serveStatic()` ignored on Vercel — use `public/`. Read-only filesystem (GET works, writes need a DB).

## Express → Hono

| Express | Hono |
|---------|------|
| `req.params.id` | `c.req.param("id")` |
| `req.body` | `await c.req.json()` |
| `res.json(data)` | `return c.json(data)` |
| `res.status(404).json()` | `return c.json(err, 404)` |
| `express.json()` | Not needed |
| `app.listen(port)` | `serve({ fetch: app.fetch, port })` |

## References

| When | Read |
|------|------|
| Full API, patterns, middleware, validation, testing, RPC | [references/api.md](references/api.md) |
| Vercel deployment, monorepo setup, gotchas | [references/vercel.md](references/vercel.md) |
| Cloudflare Workers, D1, KV, R2, wrangler | [references/cloudflare.md](references/cloudflare.md) |
