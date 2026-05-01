<script setup lang="ts">
import { ref, watch, computed } from "vue";
import type { Account, AccountBalance, AccountBalanceWithComputed } from "@slzr/expensr-shared";
import { useAccountsStore } from "@/stores/accounts";
import { useAlertDialog } from "@/composables/useAlertDialog";
import { BalanceFormModal } from "@/components/BalanceFormModal";

const props = defineProps<{
  account: Account;
}>();

const open = defineModel<boolean>("open", { required: true });

const accountsStore = useAccountsStore();
const alert = useAlertDialog();

/** Live account from the store so it updates after mutations. */
const liveAccount = computed(() => accountsStore.accounts.find((a) => a.id === props.account.id) ?? props.account);

const balances = ref<AccountBalanceWithComputed[]>([]);
const loading = ref(false);
const error = ref(false);

const showFormModal = ref(false);
const editingBalance = ref<AccountBalance | undefined>();

async function load() {
  loading.value = true;
  error.value = false;
  try {
    balances.value = await accountsStore.fetchBalances(props.account.id);
  } catch {
    error.value = true;
  } finally {
    loading.value = false;
  }
}

watch(open, (isOpen) => {
  if (!isOpen) return;
  balances.value = [];
  load();
}, { immediate: true });

function openAdd() {
  editingBalance.value = undefined;
  showFormModal.value = true;
}

function openEdit(bal: AccountBalance) {
  editingBalance.value = bal;
  showFormModal.value = true;
}

async function onDeleteFromForm(bal: AccountBalance) {
  showFormModal.value = false;
  await confirmDelete(bal);
}

async function confirmDelete(bal: AccountBalance) {
  const ok = await alert.destructive({
    title: "Delete balance?",
    description: `Remove the ${fmtMonth(bal.yearMonth)} balance?`,
    confirmLabel: "Delete",
  });
  if (!ok) return;
  try {
    await accountsStore.deleteBalance(props.account.id, bal.id);
    await load();
    useToast().add({ title: "Balance deleted", color: "success" });
  } catch {
    useToast().add({ title: "Failed to delete", color: "error" });
  }
}

function fmtMonth(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y!, m! - 1, 1).toLocaleDateString(undefined, { month: "short", year: "numeric" });
}

function fmtDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y!, m! - 1, d!).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function fmtMoney(n: number): string {
  const sign = n < 0 ? "−" : "";
  return `${sign}${Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
</script>

<template>
  <UModal v-model:open="open" :title="`Balances — ${liveAccount.name}`" :ui="{ content: 'sm:max-w-xl' }">
    <template #body>
      <div class="space-y-4">
        <div class="flex justify-end">
          <UButton icon="i-lucide-plus" label="Set balance" size="sm" @click="openAdd" />
        </div>

        <!-- Loading -->
        <div v-if="loading" class="text-center text-sm text-muted py-8">Loading…</div>

        <!-- Error -->
        <div v-else-if="error" class="text-center py-8">
          <p class="text-sm text-error mb-2">Failed to load balances</p>
          <UButton size="sm" variant="outline" @click="load">Retry</UButton>
        </div>

        <!-- Empty -->
        <div v-else-if="!balances.length" class="text-center py-12 space-y-2">
          <UIcon name="i-lucide-anchor" class="size-8 text-muted mx-auto" />
          <p class="text-sm text-muted">No balances set</p>
          <p class="text-xs text-muted">Tell the app what your bank shows for a month. Records before and after will auto-compute.</p>
        </div>

        <!-- Monthly balance cards (newest first) -->
        <div v-else class="space-y-3">
          <div
            v-for="bal in balances"
            :key="bal.id"
            class="border border-default rounded-md p-3 space-y-2"
            :class="bal.gap !== null && Math.abs(bal.gap) > 1 ? 'bg-amber-50/40 dark:bg-amber-950/10 border-amber-200 dark:border-amber-900' : ''"
          >
            <!-- Header: month + actions -->
            <div class="flex items-start justify-between gap-3">
              <div>
                <p class="text-sm font-semibold text-highlighted">{{ fmtMonth(bal.yearMonth) }}</p>
                <p class="text-xs text-muted">Checked {{ fmtDate(bal.balanceDate) }}</p>
              </div>
              <div class="flex items-center gap-1 shrink-0">
                <UButton icon="i-lucide-pencil" size="xs" variant="ghost" color="neutral" @click="openEdit(bal)" />
                <UButton icon="i-lucide-trash-2" size="xs" variant="ghost" color="error" @click="confirmDelete(bal)" />
              </div>
            </div>

            <!-- Three numbers: initial → bank → projected -->
            <div class="flex items-center justify-between text-sm tabular-nums gap-2 pt-1">
              <div class="text-center flex-1">
                <p class="text-muted text-[10px] uppercase tracking-wide">Initial</p>
                <p class="font-mono text-highlighted">{{ fmtMoney(bal.initialBalance) }}</p>
              </div>
              <UIcon name="i-lucide-arrow-right" class="size-3.5 text-muted shrink-0" />
              <div class="text-center flex-1">
                <p class="text-muted text-[10px] uppercase tracking-wide">Bank</p>
                <p class="font-mono font-bold text-highlighted">{{ fmtMoney(bal.balance) }}</p>
              </div>
              <UIcon name="i-lucide-arrow-right" class="size-3.5 text-muted shrink-0" />
              <div class="text-center flex-1">
                <p class="text-muted text-[10px] uppercase tracking-wide">Projected</p>
                <p class="font-mono text-highlighted">{{ fmtMoney(bal.projectedEnd) }}</p>
              </div>
            </div>

            <!-- Records count -->
            <div class="flex items-center justify-between text-xs text-muted pt-1 border-t border-default">
              <span>{{ bal.recordsBefore }} before · {{ bal.recordsAfter }} after</span>
              <!-- Gap -->
              <span
                v-if="bal.gap !== null"
                class="font-semibold"
                :class="Math.abs(bal.gap) < 1 ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'"
              >
                {{ Math.abs(bal.gap) < 1 ? '✓ Synced' : `Off by ${fmtMoney(bal.gap)}` }}
              </span>
              <span v-else class="text-muted italic">No next month set</span>
            </div>
          </div>
        </div>
      </div>
    </template>

    <template #footer>
      <UButton label="Close" variant="ghost" color="neutral" @click="open = false" class="ml-auto" />
    </template>
  </UModal>

  <BalanceFormModal
    v-model:open="showFormModal"
    :account-id="liveAccount.id"
    :account-name="liveAccount.name"
    :balance="editingBalance"
    @delete="onDeleteFromForm"
    @saved="load"
  />
</template>
