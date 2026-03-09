import { defineConfig } from "drizzle-kit";
import fs from "node:fs";
import path from "node:path";

function getLocalD1Path() {
  const d1Dir = path.resolve(
    __dirname,
    "../web/.wrangler/state/v3/d1/miniflare-D1DatabaseObject"
  );

  if (!fs.existsSync(d1Dir)) return "";

  const file = fs.readdirSync(d1Dir).find((f) => f.endsWith(".sqlite"));

  return file ? path.join(d1Dir, file) : "";
}

export default defineConfig({
  out: "./drizzle",
  schema: "./src/db/schema/index.ts",
  dialect: "sqlite",
  dbCredentials: {
    url: getLocalD1Path(),
  },
});
