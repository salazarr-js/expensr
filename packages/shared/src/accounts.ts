import { z } from "zod";

/** Supported account types — determines default icon and grouping. */
export const ACCOUNT_TYPES = [
  "bank",
  "credit_card",
  "cash",
  "digital_wallet",
  "crypto",
] as const;

export type AccountType = (typeof ACCOUNT_TYPES)[number];

/** Row shape returned by the accounts API (includes computed balance fields). */
export interface Account {
  id: number;
  name: string;
  code: string;
  type: AccountType;
  currency: string;
  color: string | null;
  icon: string | null;
  aliases: string | null;
  isDefault: boolean;
  // Computed from monthly balance + records
  balance: number;
  recordCount: number;
  // Monthly balance state (from the latest account_balances row)
  monthlyBalance: { yearMonth: string; balance: number; balanceDate: string } | null;
  initialBalance: number; // auto-computed: bank balance + records before balanceDate
  projectedEnd: number; // auto-computed: bank balance + records after balanceDate
  gap: number | null; // projectedEnd vs next month's balance (null if next month not set)
  createdAt: string;
  updatedAt: string;
}

/** Validation schema for creating an account. */
export const createAccountSchema = z.object({
  name: z.string().min(3, "Must be at least 3 characters").max(100, "Must be at most 100 characters"),
  type: z.enum(ACCOUNT_TYPES, { message: "Select one" }),
  currency: z.string().min(3, "Must be at least 3 characters").max(10, "Must be at most 10 characters"),
  color: z.string().nullable().optional(),
  icon: z.string().nullable().optional(),
  aliases: z.string().nullable().optional(),
  isDefault: z.boolean().optional(),
});

/** All fields optional — only send what changed. */
export const updateAccountSchema = createAccountSchema.partial();

export type CreateAccount = z.infer<typeof createAccountSchema>;
export type UpdateAccount = z.infer<typeof updateAccountSchema>;

// ── Monthly Balances ────────────────────────────────────────────────

/** A monthly balance snapshot for an account. */
export interface AccountBalance {
  id: number;
  accountId: number;
  yearMonth: string; // "2026-04"
  balance: number;
  balanceDate: string; // ISO YYYY-MM-DD
  createdAt: string;
  updatedAt: string;
}

/** Balance with computed fields for display in the timeline modal. */
export interface AccountBalanceWithComputed extends AccountBalance {
  initialBalance: number;
  projectedEnd: number;
  gap: number | null; // null if next month has no balance
  recordsBefore: number; // count of records before balanceDate in this month
  recordsAfter: number; // count of records after balanceDate in this month
}

export const createBalanceSchema = z.object({
  yearMonth: z.string().regex(/^\d{4}-\d{2}$/, "Use YYYY-MM"),
  balance: z.number({ message: "Must be a number" }),
  balanceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD"),
});

export const updateBalanceSchema = createBalanceSchema.partial();

export type CreateBalance = z.infer<typeof createBalanceSchema>;
export type UpdateBalance = z.infer<typeof updateBalanceSchema>;
