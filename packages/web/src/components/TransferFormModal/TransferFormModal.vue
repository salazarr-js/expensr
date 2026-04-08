<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { storeToRefs } from "pinia";
import { useAccountsStore } from "@/stores/accounts";
import { useRecordsStore } from "@/stores/records";
import { useApi } from "@/composables/useApi";
import { getColor } from "@/utils/colors";

const open = defineModel<boolean>("open", { required: true });

const accountsStore = useAccountsStore();
const recordsStore = useRecordsStore();
const api = useApi();
const { accounts } = storeToRefs(accountsStore);

const loading = ref(false);

const state = ref({
  fromAccountId: undefined as number | undefined,
  toAccountId: undefined as number | undefined,
  amount: null as number | null,
  toAmount: null as number | null,
  date: new Date().toISOString().slice(0, 10),
  note: "",
  feeAmount: null as number | null,
});

/** Whether the transfer is between different currencies (exchange). */
const isExchange = computed(() => {
  const from = accounts.value.find((a) => a.id === state.value.fromAccountId);
  const to = accounts.value.find((a) => a.id === state.value.toAccountId);
  return from && to && from.currency !== to.currency;
});

const fromCurrency = computed(() =>
  accounts.value.find((a) => a.id === state.value.fromAccountId)?.currency ?? "",
);
const toCurrency = computed(() =>
  accounts.value.find((a) => a.id === state.value.toAccountId)?.currency ?? "",
);

/** Account options excluding the other selected account. */
const fromOptions = computed(() =>
  accounts.value
    .filter((a) => a.id !== state.value.toAccountId)
    .map((a) => ({ label: `${a.name} (${a.currency})`, value: a.id, icon: a.icon, color: a.color })),
);
const toOptions = computed(() =>
  accounts.value
    .filter((a) => a.id !== state.value.fromAccountId)
    .map((a) => ({ label: `${a.name} (${a.currency})`, value: a.id, icon: a.icon, color: a.color })),
);

/** Swap from and to accounts. */
function swap() {
  const tmp = state.value.fromAccountId;
  state.value.fromAccountId = state.value.toAccountId;
  state.value.toAccountId = tmp;
}

/** Track which field the user edited last to know what to auto-calculate. */
let lastEdited: "amount" | "toAmount" | "fee" | null = null;

function setAmount(val: number) {
  state.value.amount = val;
  lastEdited = "amount";
  autoCalc();
}
function setToAmount(val: number) {
  state.value.toAmount = val;
  lastEdited = "toAmount";
  autoCalc();
}
function setFee(val: number) {
  state.value.feeAmount = val;
  lastEdited = "fee";
  autoCalc();
}

/** Auto-calculate the third value from the other two (same currency only). */
function autoCalc() {
  if (isExchange.value) return; // different currencies — can't auto-calc
  const a = state.value.amount;
  const r = state.value.toAmount;
  const f = state.value.feeAmount;
  if (lastEdited !== "fee" && a && r) {
    state.value.feeAmount = Math.max(0, a - r) || null;
  } else if (lastEdited !== "toAmount" && a && f) {
    state.value.toAmount = Math.max(0, a - f) || null;
  } else if (lastEdited !== "amount" && r && f) {
    state.value.amount = r + f;
  }
}

const canSubmit = computed(() =>
  state.value.fromAccountId && state.value.toAccountId && state.value.amount && state.value.amount > 0,
);

watch(open, (isOpen) => {
  if (!isOpen) return;
  accountsStore.fetchAccountsByUsage();
  state.value = {
    fromAccountId: undefined,
    toAccountId: undefined,
    amount: null,
    toAmount: null,
    date: new Date().toISOString().slice(0, 10),
    note: "",
    feeAmount: null,
  };
});

async function onSubmit() {
  if (!canSubmit.value) return;
  loading.value = true;
  try {
    await api.post("/records/transfer", {
      fromAccountId: state.value.fromAccountId,
      toAccountId: state.value.toAccountId,
      amount: state.value.amount,
      toAmount: state.value.toAmount && state.value.toAmount !== state.value.amount ? state.value.toAmount : undefined,
      date: state.value.date,
      note: state.value.note || null,
      feeAmount: state.value.feeAmount || undefined,
      feeAccountId: state.value.fromAccountId,
    });
    await recordsStore.fetchRecords();
    open.value = false;
    useToast().add({ title: isExchange.value ? "Exchange recorded" : "Transfer recorded", color: "success" });
  } catch {
    useToast().add({ title: "Failed to save transfer", color: "error" });
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <UModal v-model:open="open" :title="isExchange ? 'Currency Exchange' : 'Transfer'">
    <template #body>
      <form class="space-y-4" @submit.prevent="onSubmit">
        <!-- From account -->
        <UFormField label="From" required>
          <USelectMenu
            v-model="state.fromAccountId"
            :items="fromOptions"
            value-key="value"
            placeholder="Select account"
            class="w-full"
          />
        </UFormField>

        <!-- Swap button -->
        <div class="flex justify-center -my-2">
          <UButton icon="i-lucide-arrow-down-up" size="xs" variant="ghost" color="neutral" @click="swap" />
        </div>

        <!-- To account -->
        <UFormField label="To" required>
          <USelectMenu
            v-model="state.toAccountId"
            :items="toOptions"
            value-key="value"
            placeholder="Select account"
            class="w-full"
          />
        </UFormField>

        <!-- Amount sent -->
        <UFormField :label="`Amount sent${fromCurrency ? ` (${fromCurrency})` : ''}`" required>
          <UInput :model-value="state.amount" type="number" placeholder="0" class="w-full" @update:model-value="setAmount(Number($event))" />
        </UFormField>

        <!-- Amount received -->
        <UFormField :label="`Amount received${toCurrency ? ` (${toCurrency})` : ''}`">
          <UInput :model-value="state.toAmount" type="number" placeholder="0" class="w-full" @update:model-value="setToAmount(Number($event))" />
        </UFormField>

        <!-- Fee (auto-calculated for same currency) -->
        <UFormField :label="`Fee${fromCurrency ? ` (${fromCurrency})` : ''}`">
          <UInput :model-value="state.feeAmount" type="number" placeholder="0" class="w-full" @update:model-value="setFee(Number($event))" />
        </UFormField>

        <!-- Date -->
        <UFormField label="Date">
          <UInput v-model="state.date" type="date" class="w-full" />
        </UFormField>

        <!-- Note -->
        <UFormField label="Note">
          <UInput v-model="state.note" placeholder="Optional note" class="w-full" />
        </UFormField>
      </form>
    </template>

    <template #footer>
      <UButton label="Cancel" variant="outline" color="neutral" @click="open = false" />
      <UButton
        :label="isExchange ? 'Exchange' : 'Transfer'"
        icon="i-lucide-arrow-right-left"
        :loading="loading"
        :disabled="!canSubmit"
        @click="onSubmit"
      />
    </template>
  </UModal>
</template>
