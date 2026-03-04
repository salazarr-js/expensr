import { ref, type Ref } from "vue";
import type {
  OverridesFile,
  TransactionOverride,
  MerchantRule,
  NormalizedTransaction,
} from "../types";

function emptyOverrides(): OverridesFile {
  return {
    version: 1,
    lastModified: new Date().toISOString(),
    transactions: {},
    merchantRules: [],
    people: ["Wilmer", "Angy", "Johan", "Renzo", "Gaby", "Gusmeli"],
  };
}

const overrides = ref<OverridesFile>(emptyOverrides());
const loaded = ref(false);
let initialized = false;
let saveTimer: ReturnType<typeof setTimeout> | null = null;
let saveGeneration = 0;

async function init() {
  if (initialized) return;
  initialized = true;
  try {
    const res = await fetch("/overrides.json");
    if (res.ok) {
      overrides.value = await res.json();
    }
  } catch {
    // No overrides file yet — use defaults
  } finally {
    loaded.value = true;
  }
}

init();

function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => save(), 500);
}

async function save() {
  overrides.value.lastModified = new Date().toISOString();
  const gen = ++saveGeneration;
  try {
    const res = await fetch("/__save-overrides", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(overrides.value, null, 2),
    });
    if (!res.ok && gen === saveGeneration) {
      // Dev server not available — offer download
      downloadOverrides();
    }
  } catch {
    if (gen === saveGeneration) {
      downloadOverrides();
    }
  }
}

function downloadOverrides() {
  const blob = new Blob([JSON.stringify(overrides.value, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "overrides.json";
  a.click();
  URL.revokeObjectURL(url);
}

export function useOverrides() {
  function getOverride(txId: string): TransactionOverride | undefined {
    return overrides.value.transactions[txId];
  }

  function setTransactionOverride(
    txId: string,
    patch: Partial<TransactionOverride>
  ) {
    const existing = overrides.value.transactions[txId] ?? {};
    overrides.value.transactions[txId] = { ...existing, ...patch };
    scheduleSave();
  }

  function markReviewed(txId: string) {
    setTransactionOverride(txId, { reviewed: true });
  }

  function addMerchantRule(rule: MerchantRule) {
    // Remove existing rule with same id
    overrides.value.merchantRules = overrides.value.merchantRules.filter(
      (r) => r.id !== rule.id
    );
    overrides.value.merchantRules.push(rule);
    scheduleSave();
  }

  function removeMerchantRule(id: string) {
    overrides.value.merchantRules = overrides.value.merchantRules.filter(
      (r) => r.id !== id
    );
    scheduleSave();
  }

  function findMatchingTransactions(
    merchantKey: string,
    allTxs: NormalizedTransaction[]
  ): NormalizedTransaction[] {
    const lower = merchantKey.toLowerCase();
    return allTxs.filter((t) => {
      const key = t.merchantName?.toLowerCase();
      return key === lower;
    });
  }

  return {
    overrides: overrides as Ref<OverridesFile>,
    loaded: loaded as Ref<boolean>,
    getOverride,
    setTransactionOverride,
    markReviewed,
    addMerchantRule,
    removeMerchantRule,
    findMatchingTransactions,
    save,
  };
}
