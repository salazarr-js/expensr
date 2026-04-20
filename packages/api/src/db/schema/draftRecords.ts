import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

/** Temporary holding table for quick-recorded expenses before the app is ready. Replayed through the real parse pipeline later. */
export const draftRecords = sqliteTable("draft_records", {
  id: integer().primaryKey({ autoIncrement: true }),
  dateTime: text("date_time").notNull(), // ISO datetime
  text: text().notNull(), // raw remaining text after date/amount extraction
  amount: real(), // extracted amount (nullable)
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});
