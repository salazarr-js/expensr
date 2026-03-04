// ---- Raw JSON shapes (as they come from all_documents.json) ----

export interface RawMPTransaction {
  date: string; // "DD-MM-YYYY"
  description: string;
  reference_id: string;
  amount: string; // locale: "2.258.294,60"
  balance: string;
  period: string; // "Dec 2025" | "Jan 2026" | "Feb 2026"
}

export interface RawMPSummary {
  period: string;
  initial_balance: string;
  credits: string;
  debits: string;
  final_balance: string;
}

export interface RawGaliciaTransaction {
  date: string; // "DD/MM/YYYY"
  description: string;
  debit: string; // locale: "-563.589,29" or "0,00"
  credit: string;
  balance: string;
  comments: string | null;
}

export interface RawData {
  _meta: { description: string; source_files: string[]; generated: string };
  mercadopago: {
    account: string;
    periods: string[];
    summaries: RawMPSummary[];
    transactions: RawMPTransaction[];
    total_transactions: number;
  };
  galicia: {
    account: string;
    period: string;
    transactions: RawGaliciaTransaction[];
    total_transactions: number;
  };
}

// ---- Normalized types ----

export type TransactionCategory =
  | "transfer_out"
  | "transfer_in"
  | "payment"
  | "purchase"
  | "debt_debit"
  | "refund"
  | "income"
  | "service"
  | "tax"
  | "extraction"
  | "other";

export type SpendingCategory =
  | "salary"
  | "transport"
  | "food"
  | "groceries"
  | "housing"
  | "utilities"
  | "sports"
  | "health"
  | "shopping"
  | "family"
  | "entertainment"
  | "subscription"
  | "tax"
  | "transfer"
  | "other";

export interface NormalizedTransaction {
  id: string;
  date: Date;
  dateStr: string; // "YYYY-MM-DD"
  description: string;
  amount: number; // signed: negative = outflow
  balance: number | null;
  source: "mercadopago" | "galicia";
  category: TransactionCategory;
  spendingCategory?: SpendingCategory;
  merchantName?: string; // clean display name (extracted or overridden)
  period?: string;
  person?: string;
  referenceId?: string;
  note?: string;
  sharedWith?: SharedExpense[];
  reviewed?: boolean;
}

// ---- Override / review types ----

export interface SharedExpense {
  person: string; // "Wilmer"
  amount: number; // ARS amount they owe
  settled?: boolean;
}

export interface TransactionOverride {
  spendingCategory?: SpendingCategory;
  merchantName?: string;
  note?: string;
  sharedWith?: SharedExpense[];
  reviewed?: boolean;
}

export interface MerchantRule {
  id: string;
  pattern: string; // regex-escaped merchant key
  merchantName: string; // clean display name
  spendingCategory: SpendingCategory;
  source?: "mercadopago" | "galicia";
}

export interface OverridesFile {
  version: 1;
  lastModified: string;
  transactions: Record<string, TransactionOverride>; // keyed by tx.id
  merchantRules: MerchantRule[];
  people: string[];
}

export interface PersonSummary {
  name: string;
  sent: number;
  received: number;
  net: number; // positive = they owe you
  transactions: NormalizedTransaction[];
}

export interface MonthBucket {
  key: string; // "2025-12"
  label: string; // "Dec 2025"
  income: number;
  expenses: number;
  net: number;
  transactions: NormalizedTransaction[];
}

export interface AccountSummary {
  source: "mercadopago" | "galicia";
  label: string;
  totalIn: number;
  totalOut: number;
  net: number;
  txCount: number;
  currentBalance: number | null;
}
