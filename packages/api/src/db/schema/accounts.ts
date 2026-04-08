import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const accounts = sqliteTable("accounts", {
  id: integer().primaryKey({ autoIncrement: true }),
  name: text().notNull().unique(),
  code: text().notNull().unique(),
  type: text().notNull(),
  currency: text().notNull(),
  color: text(),
  icon: text(),
  aliases: text(), // comma-separated lowercase shorthand for parse matching
  isDefault: integer("is_default", { mode: "boolean" }).notNull().default(false), // explicit parse fallback
  startingBalance: real("starting_balance").notNull().default(0),
  realBalance: real("real_balance").notNull().default(0), // what the bank says right now
  realBalanceDate: text("real_balance_date"), // ISO date of the snapshot (e.g. "2026-04-08")
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});
