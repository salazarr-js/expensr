import { sqliteTable, text, integer, real, index } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
import { accounts } from "./accounts";
import { tags } from "./tags";
import { categories } from "./categories";

/** Core entity. Sorted by date DESC (ISO "YYYY-MM-DDTHH:MM:SS" text, not Unix). */
export const records = sqliteTable(
  "records",
  {
    id: integer().primaryKey({ autoIncrement: true }),
    type: text().notNull(),
    amount: real().notNull(), // always positive — type handles direction
    date: text().notNull(),
    accountId: integer("account_id")
      .notNull()
      .references(() => accounts.id),
    tagId: integer("tag_id").references(() => tags.id),
    categoryId: integer("category_id").references(() => categories.id),
    linkedRecordId: integer("linked_record_id"), // counterpart record for transfers
    note: text(),
    needsReview: integer("needs_review", { mode: "boolean" }).notNull().default(false), // flagged via ?? in smart parse
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [
    index("records_account_id_idx").on(table.accountId),
    index("records_date_idx").on(table.date),
    index("records_category_id_idx").on(table.categoryId),
    index("records_tag_id_idx").on(table.tagId),
  ]
);
