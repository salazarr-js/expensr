import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
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
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});
