import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
import { tags } from "./tags";
import { accounts } from "./accounts";

/** Learned keyword→tag/account mappings. Built from feedback, checked before AI on parse. */
export const keywordMappings = sqliteTable("keyword_mappings", {
  id: integer().primaryKey({ autoIncrement: true }),
  keyword: text().notNull().unique(),
  tagId: integer("tag_id").references(() => tags.id),
  accountId: integer("account_id").references(() => accounts.id),
  usageCount: integer("usage_count").notNull().default(1), // higher = higher priority when multiple keywords match
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});
