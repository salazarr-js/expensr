import Database from "better-sqlite3";
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// ── Config ──────────────────────────────────────────────────────────

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_NAME = "expensr-db";
const WEB_DIR = path.resolve(__dirname, "../packages/web");
const TMP_FILE = path.resolve(__dirname, ".sync-tmp.sql");

interface TableDef {
  name: string;
  columns: string[];
}

const TABLES: TableDef[] = [
  { name: "categories", columns: ["id", "name", "color", "icon", "created_at", "updated_at"] },
  { name: "accounts", columns: ["id", "name", "code", "type", "currency", "color", "icon", "starting_balance", "created_at", "updated_at"] },
  { name: "people", columns: ["id", "name", "avatar", "created_at", "updated_at"] },
  { name: "tags", columns: ["id", "name", "category_id", "icon", "created_at", "updated_at"] },
  { name: "records", columns: ["id", "type", "amount", "date", "account_id", "tag_id", "category_id", "person_id", "linked_record_id", "note", "created_at", "updated_at"] },
];

const TABLE_GROUPS: Record<string, string[]> = {
  categories: ["categories", "tags"],
  accounts: ["accounts"],
  people: ["people"],
  tags: ["categories", "tags"],
  records: ["categories", "accounts", "people", "tags", "records"],
  all: ["categories", "accounts", "people", "tags", "records"],
};

// ── Helpers ─────────────────────────────────────────────────────────

function getLocalD1Path(): string {
  const d1Dir = path.resolve(WEB_DIR, ".wrangler/state/v3/d1/miniflare-D1DatabaseObject");
  if (!fs.existsSync(d1Dir)) {
    throw new Error(`Local D1 directory not found: ${d1Dir}\nRun 'pnpm dev' first to create the local database.`);
  }
  const files = fs.readdirSync(d1Dir).filter((f) => f.endsWith(".sqlite"));
  if (files.length === 0) {
    throw new Error(`No .sqlite file found in ${d1Dir}\nRun 'pnpm dev' first to create the local database.`);
  }
  // Pick the most recently modified file (multiple can exist from miniflare)
  const file = files
    .map((f) => ({ name: f, mtime: fs.statSync(path.join(d1Dir, f)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime)[0].name;
  return path.join(d1Dir, file);
}

function sqlValue(val: unknown): string {
  if (val === null || val === undefined) return "NULL";
  if (typeof val === "number") return String(val);
  return `'${String(val).replace(/'/g, "''")}'`;
}

function wrangler(args: string): string {
  return execSync(`npx wrangler ${args}`, { cwd: WEB_DIR, encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] });
}

function getTableDef(name: string): TableDef {
  const def = TABLES.find((t) => t.name === name);
  if (!def) throw new Error(`Unknown table: ${name}`);
  return def;
}

function resolveTables(group: string): TableDef[] {
  const names = TABLE_GROUPS[group];
  if (!names) {
    const valid = Object.keys(TABLE_GROUPS).join(", ");
    throw new Error(`Unknown table group: '${group}'. Valid options: ${valid}`);
  }
  return names.map(getTableDef);
}

// ── Push (local → remote) ───────────────────────────────────────────

function generatePushSQL(tables: TableDef[], db: Database.Database): string {
  const lines: string[] = [
    `-- db-sync push: local → remote`,
    `-- Generated: ${new Date().toISOString()}`,
    ``,
    `PRAGMA foreign_keys = OFF;`,
    ``,
  ];

  // DELETEs in reverse FK order
  const reversed = [...tables].reverse();
  for (const table of reversed) {
    lines.push(`DELETE FROM ${table.name};`);
  }
  lines.push("");

  // INSERTs in FK order
  for (const table of tables) {
    const rows = db.prepare(`SELECT ${table.columns.join(", ")} FROM ${table.name}`).all() as Record<string, unknown>[];
    if (rows.length === 0) {
      lines.push(`-- ${table.name}: 0 rows`);
      continue;
    }
    lines.push(`-- ${table.name}: ${rows.length} rows`);
    for (const row of rows) {
      const values = table.columns.map((col) => sqlValue(row[col])).join(", ");
      lines.push(`INSERT INTO ${table.name} (${table.columns.join(", ")}) VALUES (${values});`);
    }
    lines.push("");
  }

  lines.push(`PRAGMA foreign_keys = ON;`);
  return lines.join("\n");
}

function push(group: string): void {
  const tables = resolveTables(group);
  const tableNames = tables.map((t) => t.name).join(", ");
  console.log(`\n⬆ Push: local → remote [${tableNames}]\n`);

  const localPath = getLocalD1Path();
  const db = new Database(localPath, { readonly: true });

  const sql = generatePushSQL(tables, db);
  db.close();

  fs.writeFileSync(TMP_FILE, sql, "utf-8");
  console.log(`Generated SQL (${sql.split("\n").length} lines)`);

  console.log(`Executing against remote...`);
  try {
    wrangler(`d1 execute ${DB_NAME} --remote --file=${TMP_FILE} --yes`);
    console.log(`Done.\n`);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`\nFailed to execute against remote:\n${msg}`);
    console.error(`\nCloudflare D1 Time Travel can restore the remote DB if needed.`);
    process.exit(1);
  } finally {
    fs.unlinkSync(TMP_FILE);
  }

  verify(tables);
}

// ── Pull (remote → local) ──────────────────────────────────────────

function pull(group: string): void {
  const tables = resolveTables(group);
  const tableNames = tables.map((t) => t.name).join(", ");
  console.log(`\n⬇ Pull: remote → local [${tableNames}]\n`);

  // Export from remote (one table at a time since --table only accepts one value)
  console.log(`Exporting from remote...`);
  const exportParts: string[] = [];
  for (const table of tables) {
    try {
      wrangler(`d1 export ${DB_NAME} --remote --no-schema --table=${table.name} --output=${TMP_FILE}`);
      exportParts.push(fs.readFileSync(TMP_FILE, "utf-8"));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`Failed to export table '${table.name}' from remote:\n${msg}`);
      process.exit(1);
    }
  }
  const remoteSql = exportParts.join("\n");
  if (fs.existsSync(TMP_FILE)) fs.unlinkSync(TMP_FILE);

  // Filter INSERT statements for target tables only
  const tableNameSet = new Set(tables.map((t) => t.name));
  const insertLines = remoteSql
    .split("\n")
    .filter((line) => {
      const match = line.match(/^INSERT INTO [`"]?(\w+)[`"]?\s/i);
      return match && tableNameSet.has(match[1]);
    });

  console.log(`Parsed ${insertLines.length} INSERT statements`);

  // Apply to local
  const localPath = getLocalD1Path();
  const db = new Database(localPath);

  db.pragma("foreign_keys = OFF");

  const deleteAndInsert = db.transaction(() => {
    // DELETEs in reverse FK order
    const reversed = [...tables].reverse();
    for (const table of reversed) {
      db.prepare(`DELETE FROM ${table.name}`).run();
    }
    // INSERTs
    for (const line of insertLines) {
      db.prepare(line).run();
    }
  });

  try {
    deleteAndInsert();
    console.log(`Applied to local DB.\n`);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`Failed to apply to local DB:\n${msg}`);
    console.error(`\nRe-run 'pnpm db:pull all' to restore local from remote.`);
    process.exit(1);
  } finally {
    db.pragma("foreign_keys = ON");
    db.close();
  }

  verify(tables);
}

// ── Verify ──────────────────────────────────────────────────────────

function getLocalCounts(tables: TableDef[]): Map<string, number> {
  const localPath = getLocalD1Path();
  const db = new Database(localPath, { readonly: true });
  const counts = new Map<string, number>();
  for (const table of tables) {
    const row = db.prepare(`SELECT COUNT(*) as count FROM ${table.name}`).get() as { count: number };
    counts.set(table.name, row.count);
  }
  db.close();
  return counts;
}

function getRemoteCounts(tables: TableDef[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const table of tables) {
    const raw = wrangler(`d1 execute ${DB_NAME} --remote --command="SELECT COUNT(*) as count FROM ${table.name}" --json --yes`);
    const parsed = JSON.parse(raw);
    const count = parsed[0]?.results?.[0]?.count ?? -1;
    counts.set(table.name, count);
  }
  return counts;
}

function verify(tables: TableDef[]): void {
  console.log(`Verifying...`);
  const local = getLocalCounts(tables);
  const remote = getRemoteCounts(tables);

  // Table header
  const nameW = Math.max(10, ...tables.map((t) => t.name.length));
  const header = `${"Table".padEnd(nameW)}  Local  Remote  Status`;
  const sep = "-".repeat(header.length);

  console.log(`\n${header}`);
  console.log(sep);

  let allMatch = true;
  for (const table of tables) {
    const l = local.get(table.name) ?? -1;
    const r = remote.get(table.name) ?? -1;
    const match = l === r;
    if (!match) allMatch = false;
    const status = match ? "✓ Match" : "✗ Mismatch";
    console.log(`${table.name.padEnd(nameW)}  ${String(l).padStart(5)}  ${String(r).padStart(6)}  ${status}`);
  }

  console.log(sep);
  if (allMatch) {
    console.log(`\nAll synced tables match.\n`);
  } else {
    console.log(`\nSome tables have mismatched counts.\n`);
    process.exit(1);
  }
}

// ── CLI ─────────────────────────────────────────────────────────────

function main(): void {
  const args = process.argv.slice(2);
  const direction = args[0];
  const group = args[1];

  if (!direction || !group) {
    console.log(`
Usage:
  pnpm db:push <group>    Push local → remote
  pnpm db:pull <group>    Pull remote → local

Groups:
  categories   categories + tags
  accounts     accounts
  people       people
  records      all tables (accounts, categories, tags, people, records)
  all          all tables
`);
    process.exit(0);
  }

  if (direction === "push") {
    push(group);
  } else if (direction === "pull") {
    pull(group);
  } else {
    console.error(`Unknown direction: '${direction}'. Use 'push' or 'pull'.`);
    process.exit(1);
  }
}

main();
