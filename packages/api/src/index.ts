import { Hono } from "hono";
import { createDb } from "./db";
import { categories } from "./db/schema";

const app = new Hono<{ Bindings: CloudflareBindings }>().basePath("/api");

app.get("/name", (c) => {
  return c.json({
    name: "Cloudflare",
  });
});

app.get("/categories", async (c) => {
  const db = createDb(c.env.DB);
  const rows = await db.select().from(categories);
  return c.json(rows);
});

export default app;
export { createDb, type Database } from "./db";

