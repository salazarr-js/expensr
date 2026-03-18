import { ref } from "vue";
import { defineStore } from "pinia";
import type { Account, CreateAccount, UpdateAccount } from "@slzr/expensr-shared";
import { useApi } from "@/composables/useApi";

export const useAccountsStore = defineStore("accounts", () => {
  const accounts = ref<Account[]>([]);
  const currencies = ref<string[]>([]);
  const loading = ref(false);
  const error = ref(false);
  const api = useApi();

  /** Loads all accounts from the API, sorted by name. */
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

  /** Loads all accounts sorted by record count (most used first). */
  async function fetchAccountsByUsage() {
    try {
      accounts.value = await api.get<Account[]>("/accounts?sort=usage");
    } catch {
      // Fallback: if usage sort fails, at least keep whatever we have
    }
  }

  /** Fetches distinct currencies across all accounts, ordered by usage count. */
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

  /** Creates a new account and appends it to the local list. */
  async function createAccount(data: CreateAccount) {
    const account = await api.post<Account>("/accounts", data);
    accounts.value.push(account);
    return account;
  }

  /** Patches an account and replaces it in the local list. */
  async function updateAccount(id: number, data: UpdateAccount) {
    const account = await api.put<Account>(`/accounts/${id}`, data);
    const index = accounts.value.findIndex((a) => a.id === id);
    if (index !== -1) accounts.value[index] = account;
    return account;
  }

  /** Deletes an account and removes it from the local list. */
  async function deleteAccount(id: number) {
    await api.del(`/accounts/${id}`);
    accounts.value = accounts.value.filter((a) => a.id !== id);
  }

  return { accounts, currencies, loading, error, fetchAccounts, fetchAccountsByUsage, fetchCurrencies, createAccount, updateAccount, deleteAccount };
});
