<script setup lang="ts">
import { reactive, ref, computed, watch, nextTick } from "vue";
import { parseDate, type DateValue } from "@internationalized/date";
import type { AccountBalance, CreateBalance } from "@slzr/expensr-shared";
import { createBalanceSchema } from "@slzr/expensr-shared";
import { useAccountsStore } from "@/stores/accounts";
import { useApi } from "@/composables/useApi";
import { MonthPicker } from "@/components/MonthPicker";

const props = defineProps<{
  accountId: number;
  accountName: string;
  balance?: AccountBalance;
  defaultYearMonth?: string;
}>();

const open = defineModel<boolean>("open", { required: true });
const accountsStore = useAccountsStore();
const api = useApi();

function todayLocalISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function currentYearMonth(): string {
  return todayLocalISO().slice(0, 7);
}

function lastDayOfMonth(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  const last = new Date(y!, m!, 0).getDate();
  return `${ym}-${String(last).padStart(2, "0")}`;
}

function firstDayOfMonth(ym: string): string {
  return `${ym}-01`;
}

/** Smart default: today if within the month, else last day of the month. */
function defaultBalanceDate(ym: string): string {
  const today = todayLocalISO();
  if (today.slice(0, 7) === ym) return today;
  if (today.slice(0, 7) > ym) return lastDayOfMonth(ym);
  return firstDayOfMonth(ym);
}

const defaultState = (): CreateBalance => {
  const ym = props.defaultYearMonth ?? currentYearMonth();
  return { yearMonth: ym, balance: 0, balanceDate: defaultBalanceDate(ym) };
};

const state = reactive<CreateBalance>(defaultState());
const loading = ref(false);
const datePickerOpen = ref(false);

// Calendar min/max — constrain to the selected month
const calendarMin = computed(() => parseDate(firstDayOfMonth(state.yearMonth)));
const calendarMax = computed(() => parseDate(lastDayOfMonth(state.yearMonth)));

/** Bridge between ISO string state and UCalendar's DateValue. */
const calendarModel = computed<DateValue>({
  get: () => parseDate(state.balanceDate),
  set: (val: DateValue) => {
    state.balanceDate = val.toString();
    datePickerOpen.value = false;
  },
});

/** Format the selected date for the button label. */
const dateLabel = computed(() => {
  const [y, m, d] = state.balanceDate.split("-").map(Number);
  return new Date(y!, m! - 1, d!).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
});

// Existing balance detection — prefill form when month already has a balance
const existingBalance = ref<AccountBalance | null>(null);

async function checkExisting(yearMonth: string) {
  if (props.balance) return; // editing — no need to check
  existingBalance.value = null;
  if (!/^\d{4}-\d{2}$/.test(yearMonth)) return;
  try {
    const all = await accountsStore.fetchBalances(props.accountId);
    const found = all.find((b) => b.yearMonth === yearMonth);
    if (found) {
      existingBalance.value = found;
      state.balance = found.balance;
      state.balanceDate = found.balanceDate;
    }
  } catch { /* non-critical */ }
}

// Auto-reconciliation suggestion
const suggestedBalance = ref<number | null>(null);

async function fetchSuggestion(yearMonth: string) {
  if (props.balance) return;
  if (!/^\d{4}-\d{2}$/.test(yearMonth)) { suggestedBalance.value = null; return; }
  try {
    const res = await api.get<{ suggestedBalance: number | null }>(`/accounts/${props.accountId}/balances/suggest?yearMonth=${yearMonth}`);
    suggestedBalance.value = res.suggestedBalance;
  } catch {
    suggestedBalance.value = null;
  }
}

watch(open, async (isOpen) => {
  if (!isOpen) return;
  suggestedBalance.value = null;
  existingBalance.value = null;
  if (props.balance) {
    Object.assign(state, {
      yearMonth: props.balance.yearMonth,
      balance: props.balance.balance,
      balanceDate: props.balance.balanceDate,
    });
  } else {
    Object.assign(state, defaultState());
    checkExisting(state.yearMonth);
    fetchSuggestion(state.yearMonth);
  }
  await nextTick();
});

// When month changes: auto-adjust date, check existing, fetch suggestion
watch(() => state.yearMonth, (ym) => {
  state.balanceDate = defaultBalanceDate(ym);
  if (!props.balance) {
    checkExisting(ym);
    fetchSuggestion(ym);
  }
});

const emit = defineEmits<{
  delete: [balance: AccountBalance];
  saved: [];
}>();

const form = ref<{ submit: () => Promise<void>; errors: { message: string }[]; dirty: boolean }>();
const hasErrors = computed(() => !!form.value?.errors?.length);

async function onSubmit() {
  loading.value = true;
  try {
    await accountsStore.setBalance(props.accountId, { ...state });
    open.value = false;
    emit("saved");
    useToast().add({
      title: props.balance ? "Balance updated" : "Balance set",
      color: "success",
    });
  } catch (e: unknown) {
    useToast().add({
      title: e instanceof Error ? e.message : "Something went wrong",
      color: "error",
    });
  } finally {
    loading.value = false;
  }
}

function applySuggestion() {
  if (suggestedBalance.value !== null) state.balance = suggestedBalance.value;
}

function fmtMonth(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y!, m! - 1, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });
}
</script>

<template>
  <UModal v-model:open="open" :title="balance ? `Edit balance — ${fmtMonth(balance.yearMonth)}` : `Set balance — ${accountName}`">
    <template #body>
      <UForm ref="form" :schema="createBalanceSchema" :state="state" class="space-y-4" @submit="onSubmit">
        <!-- Month header (only on create) -->
        <div v-if="!balance">
          <MonthPicker v-model="state.yearMonth" />
        </div>

        <!-- Balance + date fields -->
        <div class="grid grid-cols-2 gap-4">
          <UFormField label="Balance" name="balance">
            <UInput v-model.number="state.balance" type="number" step="0.01" class="w-full" />
          </UFormField>

          <UFormField label="Date checked" name="balanceDate">
            <UPopover v-model:open="datePickerOpen" :content="{ side: 'bottom', align: 'start' }">
              <UButton :label="dateLabel" icon="i-lucide-calendar" color="neutral" variant="outline" class="w-full justify-start" />

              <template #content>
                <UCalendar
                  v-model="calendarModel"
                  :min-value="calendarMin"
                  :max-value="calendarMax"
                  :ui="{ header: 'hidden' }"
                />
              </template>
            </UPopover>
          </UFormField>
        </div>

        <!-- Existing balance warning -->
        <div v-if="existingBalance && !balance" class="flex items-center gap-2 text-xs bg-warning/5 border border-warning/20 rounded-md px-3 py-2">
          <UIcon name="i-lucide-info" class="size-3.5 text-warning shrink-0" />
          <span class="text-muted">This month already has a balance (<strong class="text-highlighted tabular-nums">{{ existingBalance.balance.toLocaleString(undefined, { minimumFractionDigits: 2 }) }}</strong>). Saving will update it.</span>
        </div>

        <!-- Auto-reconciliation suggestion -->
        <div v-if="suggestedBalance !== null && !balance" class="flex items-center gap-2 text-xs bg-primary/5 border border-primary/20 rounded-md px-3 py-2">
          <UIcon name="i-lucide-sparkles" class="size-3.5 text-primary shrink-0" />
          <span class="text-muted">Auto-reconcile: <strong class="text-highlighted tabular-nums">{{ suggestedBalance.toLocaleString(undefined, { minimumFractionDigits: 2 }) }}</strong> closes the gap</span>
          <UButton label="Use" size="xs" variant="soft" class="ml-auto shrink-0" @click="applySuggestion" />
        </div>
      </UForm>
    </template>

    <template #footer>
      <UButton v-if="balance" label="Delete" icon="i-lucide-trash-2" variant="outline" color="error" @click="emit('delete', balance)" />
      <UButton label="Cancel" variant="ghost" color="neutral" @click="open = false" class="ml-auto" />
      <UButton :label="balance ? 'Save changes' : 'Set balance'" :loading="loading" :disabled="hasErrors" @click="form?.submit()" />
    </template>
  </UModal>
</template>
