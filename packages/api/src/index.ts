import { Hono } from "hono";
import accountsRoute from "./routes/accounts";

/** Hono API app — all routes are prefixed with `/api`. */
const app = new Hono<{ Bindings: CloudflareBindings }>().basePath("/api");

app.get("/name", (c) => {
  return c.json({
    name: "Cloudflare",
  });
});

app.route("/accounts", accountsRoute);

export default app;
export { createDb, type Database } from "./db";

