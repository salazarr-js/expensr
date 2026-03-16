<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { storeToRefs } from "pinia";
import { ACCOUNT_TYPES, type Account, type AccountType } from "@slzr/expensr-shared";
import { useAccountsStore } from "@/stores/accounts";
import { getColor } from "@/utils/colors";
import { formatMoneyParts } from "@/utils/money";
import { AccountFormModal } from "@/components/AccountFormModal";
import { useAlertDialog } from "@/composables/useAlertDialog";

const accountsStore = useAccountsStore();
const { accounts, loading, error } = storeToRefs(accountsStore);
const alert = useAlertDialog();

const showFormModal = ref(false);
const selectedAccount = ref<Account | undefined>();

const TYPE_LABELS: Record<AccountType, string> = {
  bank: "Bank",
  credit_card: "Credit Card",
  cash: "Cash",
  digital_wallet: "Digital Wallet",
  crypto: "Crypto",
};

const typeFilterOptions: { label: string; value: string }[] = [
  { label: "All", value: "all" },
  ...ACCOUNT_TYPES.map((t) => ({ label: TYPE_LABELS[t], value: t })),
];

const selectedTypes = ref<string[]>(["all"]);

/** Handles "All" toggle logic: selecting "All" clears others, selecting a type removes "All". */
function onTypeFilterUpdate(value: string[]) {
  const hadAll = selectedTypes.value.includes("all");
  const hasAll = value.includes("all");

  if (hasAll && !hadAll) {
    // "All" was just selected — reset to only "all"
    selectedTypes.value = ["all"];
  } else if (hadAll && value.length > 1) {
    // A specific type selected while "All" was active — remove "all"
    selectedTypes.value = value.filter((v) => v !== "all");
  } else if (!hasAll && value.length === 0) {
    // Everything deselected — fall back to "all"
    selectedTypes.value = ["all"];
  } else {
    selectedTypes.value = value;
  }

  // All individual types selected — collapse to "All"
  const typesOnly = selectedTypes.value.filter((v) => v !== "all");
  if (typesOnly.length === ACCOUNT_TYPES.length) {
    selectedTypes.value = ["all"];
  }
}

const filteredAccounts = computed(() => {
  const types = selectedTypes.value.filter((t) => t !== "all");
  if (!types.length) return accounts.value;
  return accounts.value.filter((a) => types.includes(a.type));
});

function openCreate() {
  selectedAccount.value = undefined;
  showFormModal.value = true;
}

function openEdit(account: Account) {
  selectedAccount.value = account;
  showFormModal.value = true;
}

/** Prompts for confirmation then deletes the account. */
async function deleteAccount(account: Account) {
  const confirmed = await alert.destructive({
    title: `Delete ${account.name}?`,
    onConfirm: () => accountsStore.deleteAccount(account.id),
  });
  if (confirmed) {
    showFormModal.value = false;
    useToast().add({ title: "Account deleted", color: "success" });
  }
}

function getAccountIcon(account: Account) {
  return account.icon || "i-lucide-wallet";
}

function getTypeLabel(type: string) {
  return TYPE_LABELS[type as AccountType] ?? type;
}

onMounted(accountsStore.fetchAccounts);
</script>

<template>
  <UDashboardPanel>
    <template #header>
      <UDashboardNavbar title="Accounts">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>

        <template #right>
          <UButton icon="i-lucide-plus" label="New account" @click="openCreate" />
        </template>
      </UDashboardNavbar>

      <UDashboardToolbar>
        <template #left>
          <USelectMenu
            :model-value="selectedTypes"
            :items="typeFilterOptions"
            value-key="value"
            multiple
            placeholder="All types"
            icon="i-lucide-filter"
            class="w-48"
            @update:model-value="onTypeFilterUpdate"
          />
        </template>
      </UDashboardToolbar>
    </template>

    <template #body>
      <!-- Loading -->
      <div v-if="loading && !accounts.length" class="flex items-center justify-center mt-[25vh]">
        <UIcon name="i-lucide-loader-circle" class="size-8 text-dimmed animate-spin" />
      </div>

      <!-- Error state -->
      <div v-else-if="error && !accounts.length" class="flex flex-col items-center text-center mt-[25vh]">
        <UIcon name="i-lucide-wifi-off" class="mb-4 size-16 text-dimmed/40" />
        <h2 class="text-lg font-semibold text-highlighted">Failed to load accounts</h2>
        <p class="mt-1 text-sm text-muted">Something went wrong. Check your connection and try again.</p>
        <UButton icon="i-lucide-refresh-cw" label="Retry" class="mt-6" :loading="loading" @click="accountsStore.fetchAccounts" />
      </div>

      <!-- Empty state -->
      <div v-else-if="!accounts.length" class="flex flex-col items-center text-center mt-[25vh]">
        <UIcon name="i-lucide-wallet" class="mb-4 size-16 text-dimmed/40" />
        <h2 class="text-lg font-semibold text-highlighted">No accounts yet</h2>
        <p class="mt-1 text-sm text-muted">Create your first account to start tracking expenses.</p>
        <UButton icon="i-lucide-plus" label="New account" class="mt-6" @click="openCreate" />
      </div>

      <!-- No results for filter -->
      <div v-else-if="!filteredAccounts.length" class="flex flex-col items-center text-center mt-[25vh]">
        <UIcon name="i-lucide-filter-x" class="mb-4 size-12 text-dimmed/40" />
        <p class="text-sm text-muted">No accounts match the selected filters.</p>
      </div>

      <!-- Account grid -->
      <div v-else class="grid gap-4 lg:gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 3xl:grid-cols-5">
        <UCard
          v-for="account in filteredAccounts"
          :key="account.id"
          class="cursor-pointer hover:ring-1 hover:ring-default-border transition-shadow"
          @click="openEdit(account)"
        >
          <div class="flex items-center gap-3">
            <div
              class="flex items-center justify-center size-10 rounded-lg shrink-0"
              :style="{ backgroundColor: getColor(account.color)?.[100] ?? '#f3f4f6', color: getColor(account.color)?.[500] ?? '#9ca3af' }"
            >
              <UIcon :name="getAccountIcon(account)" class="size-5" />
            </div>
            <div class="min-w-0">
              <h3 class="text-sm font-semibold text-highlighted truncate">{{ account.name }}</h3>
              <p class="text-xs text-muted">{{ getTypeLabel(account.type) }}</p>
            </div>
          </div>

          <div class="mt-3 flex items-end justify-between">
            <div />
            <div class="text-right">
              <p class="text-[11px] uppercase tracking-wider text-muted font-medium">{{ account.currency }}</p>
              <p class="text-2xl font-heading font-bold text-highlighted tracking-tight">
                {{ formatMoneyParts(account.startingBalance).integer }}<span class="text-base font-medium text-muted">{{ formatMoneyParts(account.startingBalance).decimal }}</span>
              </p>
            </div>
          </div>
        </UCard>
      </div>
    </template>
  </UDashboardPanel>

  <AccountFormModal v-model:open="showFormModal" :account="selectedAccount" @delete="deleteAccount" />
</template>
