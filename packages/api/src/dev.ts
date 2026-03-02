import { serve } from "@hono/node-server";
import app from "./server.js";

const PORT = Number(process.env.PORT) || 3001;
serve({ fetch: app.fetch, port: PORT }, (info) => {
  console.log(`API: http://localhost:${info.port}`);
});
