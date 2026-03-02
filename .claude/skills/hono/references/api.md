# Hono API & Patterns

## App Constructor

```typescript
const app = new Hono({ strict: false }); // /path and /path/ equivalent
```

Presets: `"hono"` (default SmartRouter), `"hono/quick"` (fast cold start), `"hono/tiny"` (smallest).

## Context — Request

```typescript
c.req.param("id")                    // path param
c.req.query("page")                  // query string
c.req.queries("tags")                // string[] for repeated key
c.req.header("Authorization")        // header
await c.req.json()                   // JSON body
await c.req.text()                   // text body
await c.req.arrayBuffer()            // binary
await c.req.parseBody()              // form data / file upload
await c.req.parseBody({ all: true }) // all values with same name
c.req.valid("json")                  // validated data (after zValidator)
```

## Context — Response

```typescript
return c.json(data)              // 200 JSON
return c.json(data, 201)         // with status
return c.json({ error }, 404)    // error
return c.text("ok")              // text/plain
return c.html("<h1>Hi</h1>")    // text/html
return c.body(null, 204)         // no content
return c.redirect("/path")       // 302
return c.redirect("/path", 301)  // permanent

c.status(201)
c.header("X-Custom", "value")
```

## Variables (request-scoped)

```typescript
// Set in middleware
c.set("user", { id: "123" });
// Read in handler
c.get("user")   // or c.var.user
```

## Typed Environment

```typescript
type Env = {
  Variables: { user: { id: string; role: string }; requestId: string };
};
const app = new Hono<Env>();
// c.set("user", ...) and c.var.user are now typed
```

## Middleware

### CORS

```typescript
import { cors } from "hono/cors";
app.use(cors());  // permissive
app.use(cors({
  origin: "https://example.com",
  allowMethods: ["GET", "POST", "PUT", "DELETE"],
  allowHeaders: ["Content-Type", "Authorization"],
  credentials: true, maxAge: 86400,
}));
// Multiple origins
app.use(cors({ origin: ["https://a.com", "https://b.com"] }));
// Dynamic
app.use(cors({ origin: (o) => o.endsWith(".example.com") ? o : false }));
```

### Custom Typed Middleware

```typescript
import { createMiddleware } from "hono/factory";

export const auth = createMiddleware<{
  Variables: { userId: string; role: string };
}>(async (c, next) => {
  const token = c.req.header("Authorization")?.replace("Bearer ", "");
  if (!token) return c.json({ error: "Unauthorized" }, 401);
  // validate token, then:
  c.set("userId", decoded.sub);
  c.set("role", decoded.role);
  await next();
});
```

### Built-in List

`cors`, `logger`, `compress`, `etag`, `basicAuth`, `bearerAuth`, `jwt`, `serveStatic`, `cache`, `secureHeaders`. Import from `"hono/<name>"`.

## Zod Validation

```typescript
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";

// Body
app.post("/", zValidator("json", z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
})), (c) => {
  const data = c.req.valid("json"); // typed
  return c.json(data, 201);
});

// Query
app.get("/", zValidator("query", z.object({
  page: z.coerce.number().default(1),
  limit: z.coerce.number().max(100).default(20),
  search: z.string().optional(),
})), handler);

// Custom error response
app.post("/", zValidator("json", schema, (result, c) => {
  if (!result.success) {
    return c.json({ error: "Validation failed", details: result.error.flatten() }, 400);
  }
}), handler);

// Infer types
type User = z.infer<typeof userSchema>;
```

## Drizzle + Zod (Single Source of Truth)

Generate Zod schemas from Drizzle DB schema — no manual type duplication:

```typescript
import { sqliteTable, text, real, integer } from "drizzle-orm/sqlite-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

// DB schema
export const expenses = sqliteTable("expenses", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  amount: real("amount").notNull(),
  date: text("date").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull().$defaultFn(() => new Date()),
});

// Generated schemas
export const insertExpenseSchema = createInsertSchema(expenses);
export const selectExpenseSchema = createSelectSchema(expenses);

// Use in routes
app.post("/expenses", zValidator("json", insertExpenseSchema), (c) => {
  const expense = c.req.valid("json"); // typed from DB schema
  return c.json({ data: expense }, 201);
});
```

## Error Handling

```typescript
import { HTTPException } from "hono/http-exception";

// Throw anywhere
throw new HTTPException(404, { message: "Not found" });
throw new HTTPException(401, { message: "Bad token", cause: originalError });

// Global handler
app.onError((err, c) => {
  if (err instanceof HTTPException) return err.getResponse();
  console.error(err);
  return c.json({ error: "Internal server error" }, 500);
});

app.notFound((c) => c.json({ error: "Not found" }, 404));
```

## CRUD Route Template

```typescript
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";

const createSchema = z.object({ name: z.string().min(1).max(100) });
const updateSchema = createSchema.partial();
const app = new Hono();

app.get("/", async (c) => c.json({ items }));
app.get("/:id", async (c) => {
  const id = c.req.param("id");
  if (!item) return c.json({ error: "Not found" }, 404);
  return c.json({ item });
});
app.post("/", zValidator("json", createSchema), async (c) => {
  const body = c.req.valid("json");
  return c.json({ item }, 201);
});
app.put("/:id", zValidator("json", updateSchema), async (c) => {
  const body = c.req.valid("json");
  return c.json({ item });
});
app.delete("/:id", async (c) => c.body(null, 204));

export default app;
```

## Route Organization

- **<10 routes:** single `server.ts`
- **10-30:** one file per resource in `routes/`, mount with `app.route("/api/users", users)`
- **30+:** `routes/<resource>/index.ts` + `handlers.ts` + `validators.ts`

## RPC Client (End-to-End Type Safety)

```typescript
// Server — chain routes (app.route() breaks RPC inference)
const route = app
  .get("/api/users", (c) => c.json({ users: [] as User[] }))
  .post("/api/users", zValidator("json", schema), (c) =>
    c.json({ user: { id: 1, ...c.req.valid("json") } }, 201));

export type AppType = typeof route;

// Client
import { hc, InferResponseType, InferRequestType } from "hono/client";
import type { AppType } from "../server";

const client = hc<AppType>("http://localhost:3001");
const res = await client.api.users.$get();
const { users } = await res.json(); // typed

type Req = InferRequestType<typeof client.api.users.$post>;
type Res = InferResponseType<typeof client.api.users.$post>;
```

## Testing

```typescript
import { describe, it, expect } from "vitest";
import app from "./server.js";

describe("API", () => {
  it("GET", async () => {
    const res = await app.request("/api/users");
    expect(res.status).toBe(200);
  });
  it("POST", async () => {
    const res = await app.request("/api/users", {
      method: "POST",
      body: JSON.stringify({ name: "John", email: "j@t.com" }),
      headers: { "Content-Type": "application/json" },
    });
    expect(res.status).toBe(201);
  });
  it("auth", async () => {
    const res = await app.request("/api/admin", {
      headers: { Authorization: "Bearer valid-token" },
    });
    expect(res.status).toBe(200);
  });
});
```

## Streaming & SSE

```typescript
import { stream, streamText, streamSSE } from "hono/streaming";

app.get("/sse", (c) => streamSSE(c, async (stream) => {
  await stream.writeSSE({ data: "hello", event: "msg", id: "1" });
  await stream.sleep(1000);
}));
```

## Cookies

```typescript
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
setCookie(c, "token", "val", { path: "/", httpOnly: true, maxAge: 3600 });
getCookie(c, "token");
deleteCookie(c, "token");
```

## Helpers Quick Reference

| Import | Exports |
|--------|---------|
| `hono/cookie` | `getCookie`, `setCookie`, `deleteCookie`, `getSignedCookie`, `setSignedCookie` |
| `hono/jwt` | `sign`, `verify`, `decode` |
| `hono/streaming` | `stream`, `streamText`, `streamSSE` |
| `hono/html` | `html`, `raw` |
| `hono/factory` | `createMiddleware` |
| `hono/adapter` | `env`, `getRuntimeKey` |
| `hono/dev` | `showRoutes`, `getRouterName` |
| `hono/proxy` | `proxy` |
