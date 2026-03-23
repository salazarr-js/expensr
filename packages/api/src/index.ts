import { Hono } from "hono";
import accountsRoute from "./routes/accounts";
import categoriesRoute from "./routes/categories";
import peopleRoute from "./routes/people";
import recordsRoute from "./routes/records";

/** Hono API app — all routes are prefixed with `/api`. */
const app = new Hono<{ Bindings: CloudflareBindings }>().basePath("/api");

app.get("/name", (c) => {
  return c.json({
    name: "Cloudflare",
  });
});

app.route("/accounts", accountsRoute);
app.route("/categories", categoriesRoute);
app.route("/people", peopleRoute);
app.route("/records", recordsRoute);

export default app;
export { createDb, type Database } from "./db";

