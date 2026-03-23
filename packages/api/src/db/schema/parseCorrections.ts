import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

/** Audit log: what parse returned vs what the user actually selected. */
export const parseCorrections = sqliteTable("parse_corrections", {
  id: integer().primaryKey({ autoIncrement: true }),
  promptText: text("prompt_text").notNull(),
  aiResponse: text("ai_response").notNull(), // JSON string — parse output before correction
  finalResponse: text("final_response").notNull(), // JSON string — final data after user edits
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});
