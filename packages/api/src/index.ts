/// <reference path="../worker-configuration.d.ts" />
import { Hono } from "hono";

const app = new Hono<{ Bindings: CloudflareBindings }>().basePath("/api");

app.get("/name", (c) => {
  return c.json({
    name: 'Cloudflare'
  })
});

export default app;
