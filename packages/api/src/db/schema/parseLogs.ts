import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

/** Parse observability: logs every parse call with resolution path and feedback. */
export const parseLogs = sqliteTable("parse_logs", {
  id: integer().primaryKey({ autoIncrement: true }),
  inputText: text("input_text").notNull(), // what the user typed
  resolvedBy: text("resolved_by").notNull(), // 'name_match' | 'keyword' | 'ai' | 'none'
  tagMatched: integer("tag_matched", { mode: "boolean" }).notNull(),
  accountMatched: integer("account_matched", { mode: "boolean" }).notNull(),
  peopleCount: integer("people_count").notNull().default(0),
  aiCalled: integer("ai_called", { mode: "boolean" }).notNull().default(false),
  aiSucceeded: integer("ai_succeeded", { mode: "boolean" }), // null if AI not called
  wasCorrected: integer("was_corrected", { mode: "boolean" }), // null until feedback received
  parseResult: text("parse_result").notNull(), // JSON — what parse returned
  finalResult: text("final_result"), // JSON — what user saved (null if cancelled)
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});
