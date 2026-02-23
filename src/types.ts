export interface Transaction {
  id: number;
  date: string;
  description: string;
  installment: string | null;
  currency: "ARS" | "USD" | "CLP";
  original_amount: number;
  ars: number | null;
  usd: number | null;
  clp: number | null;
  category: string;
  favor_for: string | null;
}

export interface Invoice {
  id: number;
  date: string;
  store: string;
  amount: number;
  currency: "ARS" | "USD" | "CLP";
  notes: string;
  linked_transaction_id: number | null;
  favor_for: string | null;
  created_at: string;
}

export interface TransactionsFile {
  statement: unknown;
  payment_info: unknown;
  transactions: Transaction[];
}
