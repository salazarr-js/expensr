import { ref, computed, readonly } from "vue";
import type {
  RawData,
  NormalizedTransaction,
  PersonSummary,
  MonthBucket,
  AccountSummary,
} from "../types";
import { normalizeAll } from "../lib/normalize";
import { toMonthKey, toMonthLabel } from "../lib/parse";

const allTransactions = ref<NormalizedTransaction[]>([]);
const longTransactionsRef = ref<RawData["transactions_long"] | null>(null);
const loading = ref(true);
const error = ref<string | null>(null);

const threeMonthsAgo = new Date();
threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
threeMonthsAgo.setDate(1);
threeMonthsAgo.setHours(0, 0, 0, 0);

let initialized = false;

async function init() {
  if (initialized) return;
  initialized = true;
  try {
    const res = await fetch("/all_documents.json");
    const raw: RawData = await res.json();
    allTransactions.value = normalizeAll(raw);
    longTransactionsRef.value = raw.transactions_long;
  } catch (e) {
    error.value = e instanceof Error ? e.message : "Failed to load data";
  } finally {
    loading.value = false;
  }
}

init();

export function useAccountsData() {
  const recentTransactions = computed(() =>
    allTransactions.value.filter((t) => t.date >= threeMonthsAgo)
  );

  const accountSummaries = computed<AccountSummary[]>(() => {
    return (["mercadopago", "galicia"] as const).map((source) => {
      const txs = recentTransactions.value.filter((t) => t.source === source);
      const totalIn = txs
        .filter((t) => t.amount > 0)
        .reduce((s, t) => s + t.amount, 0);
      const totalOut = txs
        .filter((t) => t.amount < 0)
        .reduce((s, t) => s + t.amount, 0);
      const sorted = [...txs].sort(
        (a, b) => b.date.getTime() - a.date.getTime()
      );
      return {
        source,
        label: source === "mercadopago" ? "MercadoPago" : "Banco Galicia",
        totalIn,
        totalOut,
        net: totalIn + totalOut,
        txCount: txs.length,
        currentBalance: sorted[0]?.balance ?? null,
      };
    });
  });

  const monthlyBuckets = computed<MonthBucket[]>(() => {
    const map = new Map<string, MonthBucket>();
    for (const t of recentTransactions.value) {
      const key = toMonthKey(t.date);
      if (!map.has(key)) {
        map.set(key, {
          key,
          label: toMonthLabel(t.date),
          income: 0,
          expenses: 0,
          net: 0,
          transactions: [],
        });
      }
      const bucket = map.get(key)!;
      bucket.transactions.push(t);
      if (t.amount > 0) bucket.income += t.amount;
      else bucket.expenses += t.amount;
      bucket.net += t.amount;
    }
    return [...map.values()].sort((a, b) => a.key.localeCompare(b.key));
  });

  const peopleSummaries = computed<PersonSummary[]>(() => {
    const map = new Map<string, PersonSummary>();
    for (const t of allTransactions.value) {
      if (!t.person) continue;
      const name = t.person;
      if (!map.has(name)) {
        map.set(name, { name, sent: 0, received: 0, net: 0, transactions: [] });
      }
      const p = map.get(name)!;
      p.transactions.push(t);
      if (t.amount < 0) p.sent += Math.abs(t.amount);
      else p.received += t.amount;
      p.net = p.received - p.sent;
    }
    return [...map.values()].sort(
      (a, b) => Math.abs(b.net) - Math.abs(a.net)
    );
  });

  const spendingByMerchant = computed(() => {
    const purchases = recentTransactions.value.filter(
      (t) => t.category === "purchase" || t.category === "payment"
    );
    const map = new Map<
      string,
      { label: string; total: number; count: number; transactions: NormalizedTransaction[] }
    >();
    for (const t of purchases) {
      let storeName = t.description;
      if (t.source === "galicia") {
        storeName = storeName
          .replace(/^COMPRA DEBITO\s+/i, "")
          .replace(/^PAGO TARJETA\s+\w+\s+OPERACION\s+\d+/i, "Pago Tarjeta")
          .split(/\s{2,}/)[0];
      }
      if (t.source === "mercadopago") {
        storeName = storeName.replace(/^(Pago|Compra)\s+/i, "").split(/\s{2,}/)[0];
      }
      const key = storeName.toLowerCase().trim();
      if (!key) continue;
      if (!map.has(key))
        map.set(key, { label: storeName, total: 0, count: 0, transactions: [] });
      const entry = map.get(key)!;
      entry.total += Math.abs(t.amount);
      entry.count++;
      entry.transactions.push(t);
    }
    return [...map.values()].sort((a, b) => b.total - a.total);
  });

  const longTransactions = computed(() => longTransactionsRef.value);

  return {
    loading: readonly(loading),
    error: readonly(error),
    allTransactions: readonly(allTransactions),
    recentTransactions,
    accountSummaries,
    monthlyBuckets,
    peopleSummaries,
    spendingByMerchant,
    longTransactions,
  };
}
