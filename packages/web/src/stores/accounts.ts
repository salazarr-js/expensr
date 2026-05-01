import { ref } from "vue";
import { defineStore } from "pinia";
import type { Account, CreateAccount, UpdateAccount, CreateBalance, AccountBalance, AccountBalanceWithComputed } from "@slzr/expensr-shared";
import { useApi } from "@/composables/useApi";

export const useAccountsStore = defineStore("accounts", () => {
  const accounts = ref<Account[]>([]);
  const currencies = ref<string[]>([]);
  const loading = ref(false);
  const error = ref(false);
  const api = useApi();

  /** Loads all accounts with computed balance fields. */
  async function fetchAccounts() {
    loading.value = true;
    error.value = false;
    try {
      accounts.value = await api.get<Account[]>("/accounts");
    } catch {
      error.value = true;
      useToast().add({ title: "Failed to load accounts", color: "error" });
    } finally {
      loading.value = false;
    }
  }

  /** Loads all accounts sorted by record count. */
  async function fetchAccountsByUsage() {
    try {
      accounts.value = await api.get<Account[]>("/accounts?sort=usage");
    } catch {
      // Fallback: keep whatever we have
    }
  }

  /** Fetches distinct currencies. */
  async function fetchCurrencies() {
    loading.value = true;
    try {
      currencies.value = await api.get<string[]>("/accounts/currencies");
    } catch {
      useToast().add({ title: "Failed to load currencies", color: "error" });
    } finally {
      loading.value = false;
    }
  }

  /** Creates an account and refetches the list. */
  async function createAccount(data: CreateAccount) {
    const account = await api.post<Account>("/accounts", data);
    await fetchAccounts();
    return account;
  }

  /** Patches an account and refetches the list. */
  async function updateAccount(id: number, data: UpdateAccount) {
    const account = await api.put<Account>(`/accounts/${id}`, data);
    await fetchAccounts();
    return account;
  }

  /** Deletes an account. */
  async function deleteAccount(id: number) {
    await api.del(`/accounts/${id}`);
    accounts.value = accounts.value.filter((a) => a.id !== id);
  }

  // ── Monthly Balances ──────────────────────────────────────────────

  /** Lists monthly balances for an account (newest first, with computed fields). */
  async function fetchBalances(accountId: number): Promise<AccountBalanceWithComputed[]> {
    return api.get<AccountBalanceWithComputed[]>(`/accounts/${accountId}/balances`);
  }

  /** Creates or updates a monthly balance (upsert by yearMonth). Refetches accounts. */
  async function setBalance(accountId: number, data: CreateBalance) {
    const bal = await api.post<AccountBalance>(`/accounts/${accountId}/balances`, data);
    await fetchAccounts();
    return bal;
  }

  /** Deletes a monthly balance. Refetches accounts. */
  async function deleteBalance(accountId: number, balId: number) {
    await api.del(`/accounts/${accountId}/balances/${balId}`);
    await fetchAccounts();
  }

  return {
    accounts, currencies, loading, error,
    fetchAccounts, fetchAccountsByUsage, fetchCurrencies,
    createAccount, updateAccount, deleteAccount,
    fetchBalances, setBalance, deleteBalance,
  };
});
