import { sqliteTable, text, integer, real, uniqueIndex } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
import { accounts } from "./accounts";

/** Monthly balance snapshot — one per account per month. What the bank says on a given date. */
export const accountBalances = sqliteTable(
  "account_balances",
  {
    id: integer().primaryKey({ autoIncrement: true }),
    accountId: integer("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    yearMonth: text("year_month").notNull(), // "2026-04"
    balance: real().notNull(), // what the bank shows
    balanceDate: text("balance_date").notNull(), // ISO YYYY-MM-DD when user checked
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [
    uniqueIndex("account_balances_account_month_idx").on(table.accountId, table.yearMonth),
  ],
);
