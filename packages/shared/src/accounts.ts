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

/** Row shape returned by the accounts API. */
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
  startingBalance: number;
  realBalance: number;
  realBalanceDate: string | null;
  balance: number; // tracked balance (starting + income - expenses +/- transfers)
  recordCount: number;
  createdAt: string;
  updatedAt: string;
}

/** Validation schema for creating an account. Used by both frontend forms and API. */
export const createAccountSchema = z.object({
  name: z.string().min(3, "Must be at least 3 characters").max(100, "Must be at most 100 characters"),
  type: z.enum(ACCOUNT_TYPES, { message: "Select one" }),
  currency: z.string().min(3, "Must be at least 3 characters").max(10, "Must be at most 10 characters"),
  color: z.string().nullable().optional(),
  icon: z.string().nullable().optional(),
  aliases: z.string().nullable().optional(),
  isDefault: z.boolean().optional(),
  startingBalance: z.number({ message: "Must be a number" }).default(0),
  realBalance: z.number({ message: "Must be a number" }).default(0),
  realBalanceDate: z.string().nullable().optional(),
});

/** All fields optional — only send what changed. */
export const updateAccountSchema = createAccountSchema.partial();

export type CreateAccount = z.infer<typeof createAccountSchema>;
export type UpdateAccount = z.infer<typeof updateAccountSchema>;
