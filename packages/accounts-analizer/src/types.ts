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

export interface RawLongTransaction {
  Date: string; // "YYYY-MM-DD"
  DateQuality: string;
  Year: number;
  Month: number;
  Account: string;
  Currency: string;
  USD_Bucket: boolean;
  TypeGuess: string;
  Amount: number;
  Description: string | null;
  Sheet: string;
  SourceFile: string;
}

export interface RawAccountsMap {
  Account: string;
  AccountDisplay: string;
  Currency: string;
  Bucket: string;
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
  transactions_long: {
    description: string;
    accounts_map: RawAccountsMap[];
    diagnostics: { metric: string; value: string | number }[];
    transactions: RawLongTransaction[];
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

export interface NormalizedTransaction {
  id: string;
  date: Date;
  dateStr: string; // "YYYY-MM-DD"
  description: string;
  amount: number; // signed: negative = outflow
  balance: number | null;
  source: "mercadopago" | "galicia";
  category: TransactionCategory;
  period?: string;
  person?: string;
  referenceId?: string;
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
