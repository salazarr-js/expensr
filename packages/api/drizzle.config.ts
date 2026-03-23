import { defineConfig } from "drizzle-kit";
import fs from "node:fs";
import path from "node:path";

function getLocalD1Path() {
  const d1Dir = path.resolve(
    __dirname,
    "../web/.wrangler/state/v3/d1/miniflare-D1DatabaseObject"
  );

  if (!fs.existsSync(d1Dir)) return "";

  const files = fs.readdirSync(d1Dir).filter((f) => f.endsWith(".sqlite"));
  if (files.length === 0) return "";

  // Pick the most recently modified file (multiple can exist from miniflare)
  const file = files
    .map((f) => ({ name: f, mtime: fs.statSync(path.join(d1Dir, f)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime)[0].name;

  return path.join(d1Dir, file);
}

export default defineConfig({
  out: "./drizzle",
  schema: "./src/db/schema/index.ts",
  dialect: "sqlite",
  dbCredentials: {
    url: getLocalD1Path(),
  },
});
