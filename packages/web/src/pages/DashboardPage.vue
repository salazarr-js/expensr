<script setup lang="ts">
import { ref, computed, watch, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { storeToRefs } from "pinia";
import type { RecordWithRelations } from "@slzr/expensr-shared";
import { useRecordsStore, type RecordFilters } from "@/stores/records";
import { useAccountsStore } from "@/stores/accounts";
import { usePeopleStore } from "@/stores/people";
import { useApi } from "@/composables/useApi";
import { formatMoneyParts } from "@/utils/money";
import { getColor } from "@/utils/colors";
import { getDefaultRange, getPreviousPeriod } from "@/utils/dates";
import { DateRangePicker } from "@/components/DateRangePicker";
import { QuickRecordModal } from "@/components/QuickRecordModal";

const route = useRoute();
const router = useRouter();
const recordsStore = useRecordsStore();
const accountsStore = useAccountsStore();
const peopleStore = usePeopleStore();
const api = useApi();

const { records, loading } = storeToRefs(recordsStore);
const { accounts } = storeToRefs(accountsStore);
const { people } = storeToRefs(peopleStore);

const showQuickRecord = ref(false);

// ── Period ───────────────────────────────────────────────────────────

const defaults = getDefaultRange();
const hasDateParams = "dateFrom" in route.query || "dateTo" in route.query;
const dateFrom = ref<string | undefined>(
  hasDateParams ? (String(route.query.dateFrom || "") || undefined) : defaults.dateFrom,
);
const dateTo = ref<string | undefined>(
  hasDateParams ? (String(route.query.dateTo || "") || undefined) : defaults.dateTo,
);

const filters = computed<RecordFilters>(() => ({
  dateFrom: dateFrom.value || undefined,
  dateTo: dateTo.value || undefined,
}));

// Previous period for comparison
const prevRecords = ref<RecordWithRelations[]>([]);

async function fetchPreviousPeriod() {
  if (!dateFrom.value || !dateTo.value) { prevRecords.value = []; return; }
  const prev = getPreviousPeriod(dateFrom.value, dateTo.value);
  try {
    const qs = new URLSearchParams({ dateFrom: prev.dateFrom, dateTo: prev.dateTo }).toString();
    prevRecords.value = await api.get<RecordWithRelations[]>(`/records?${qs}`);
  } catch { prevRecords.value = []; }
}

watch(filters, (f) => { recordsStore.fetchRecords(f); fetchPreviousPeriod(); });
onMounted(() => { recordsStore.fetchRecords(filters.value); fetchPreviousPeriod(); accountsStore.fetchAccountsByUsage(); peopleStore.fetchPeople(); });

// ── Core computeds ──────────────────────────────────────────────────

const expenses = computed(() => records.value.filter((r) => r.type === "expense"));
const incomeRecords = computed(() => records.value.filter((r) => r.type === "income"));
const totalSpending = computed(() => expenses.value.reduce((s, r) => s + r.mySpend, 0));
const totalIncome = computed(() => incomeRecords.value.reduce((s, r) => s + r.amount, 0));

const prevExpenses = computed(() => prevRecords.value.filter((r) => r.type === "expense"));
const prevTotalSpending = computed(() => prevExpenses.value.reduce((s, r) => s + r.mySpend, 0));

/** Spending by currency. */
const spendingByCurrency = computed(() => {
  const map = new Map<string, number>();
  for (const r of expenses.value) map.set(r.accountCurrency, (map.get(r.accountCurrency) ?? 0) + r.mySpend);
  return [...map.entries()].sort((a, b) => b[1] - a[1]);
});

/** Income by currency. */
const incomeByCurrency = computed(() => {
  const map = new Map<string, number>();
  for (const r of incomeRecords.value) map.set(r.accountCurrency, (map.get(r.accountCurrency) ?? 0) + r.amount);
  return [...map.entries()].sort((a, b) => b[1] - a[1]);
});

/** Spending + income grouped by currency for summary cards. */
const summaryByCurrency = computed(() => {
  const all = new Set<string>();
  spendingByCurrency.value.forEach(([c]) => all.add(c));
  incomeByCurrency.value.forEach(([c]) => all.add(c));
  return [...all].map((currency) => ({
    currency,
    spending: spendingByCurrency.value.find(([c]) => c === currency)?.[1] ?? 0,
    income: incomeByCurrency.value.find(([c]) => c === currency)?.[1] ?? 0,
  })).sort((a, b) => b.spending - a.spending);
});

/** Available currencies from expenses. */
const currencies = computed(() => [...new Set(expenses.value.map((r) => r.accountCurrency))]);

/** Selected currency for daily chart + category breakdown. Defaults to highest-spending currency. */
const selectedCurrency = ref<string>(
  route.query.currency ? String(route.query.currency) : "",
);

// Auto-select dominant currency when data changes
watch(spendingByCurrency, (byCurrency) => {
  if (byCurrency.length && (!selectedCurrency.value || !currencies.value.includes(selectedCurrency.value))) {
    selectedCurrency.value = byCurrency[0]![0];
  }
}, { immediate: true });

// Sync filters to URL so back-navigation restores state
watch([dateFrom, dateTo, selectedCurrency], ([df, dt, cur]) => {
  const query: Record<string, string> = {};
  if (df) query.dateFrom = df;
  if (dt) query.dateTo = dt;
  if (cur) query.currency = cur;
  router.replace({ query });
});

/** Expenses filtered to the selected currency — used for daily chart + category breakdown. */
const currencyExpenses = computed(() =>
  selectedCurrency.value ? expenses.value.filter((r) => r.accountCurrency === selectedCurrency.value) : expenses.value,
);
const currencyPrevExpenses = computed(() =>
  selectedCurrency.value ? prevExpenses.value.filter((r) => r.accountCurrency === selectedCurrency.value) : prevExpenses.value,
);
const currencyTotalSpending = computed(() => currencyExpenses.value.reduce((s, r) => s + r.mySpend, 0));

/** Spending change vs previous period (for selected currency). */
const prevCurrencyTotal = computed(() => currencyPrevExpenses.value.reduce((s, r) => s + r.mySpend, 0));
const spendingChange = computed(() => {
  const current = currencyTotalSpending.value;
  const previous = prevCurrencyTotal.value;
  if (!previous) return { pct: 0, increased: false, hasPrevious: false };
  const pct = Math.round(((current - previous) / previous) * 100);
  return { pct: Math.abs(pct), increased: current > previous, hasPrevious: true };
});

// ── Category breakdown ──────────────────────────────────────────────

interface CategoryData {
  name: string; categoryId: number | null; amount: number; color: string | null; icon: string | null;
  percentage: number; prevAmount: number; pctChange: number | null;
}

const categoryBreakdown = computed<CategoryData[]>(() => {
  const map = new Map<string, { amount: number; color: string | null; icon: string | null; categoryId: number | null }>();
  for (const r of currencyExpenses.value) {
    const name = r.categoryName ?? "Uncategorized";
    const ex = map.get(name) ?? { amount: 0, color: r.categoryColor, icon: r.categoryIcon, categoryId: r.categoryId };
    ex.amount += r.mySpend;
    map.set(name, ex);
  }
  const prevMap = new Map<string, number>();
  for (const r of currencyPrevExpenses.value) {
    const name = r.categoryName ?? "Uncategorized";
    prevMap.set(name, (prevMap.get(name) ?? 0) + r.mySpend);
  }
  const total = currencyTotalSpending.value || 1;
  return [...map.entries()].sort((a, b) => b[1].amount - a[1].amount).map(([name, d]) => {
    const prev = prevMap.get(name) ?? 0;
    return { name, ...d, percentage: (d.amount / total) * 100, prevAmount: prev, pctChange: prev > 0 ? Math.round(((d.amount - prev) / prev) * 100) : null };
  });
});

/** Navigate to records page filtered by category + current date range. */
function goToCategory(cat: CategoryData) {
  const query: Record<string, string> = { categoryId: cat.categoryId ? String(cat.categoryId) : "none" };
  if (dateFrom.value) query.dateFrom = dateFrom.value;
  if (dateTo.value) query.dateTo = dateTo.value;
  router.push({ path: "/dashboard/records", query });
}

// ── Donut chart ─────────────────────────────────────────────────────

const hoveredCategory = ref<string | null>(null);

/** Tapped day index for mobile tooltip on daily spending chart. */
const tappedDay = ref<number | null>(null);
function toggleDay(index: number) {
  tappedDay.value = tappedDay.value === index ? null : index;
}

const donutSegments = computed(() => {
  const circumference = 2 * Math.PI * 40;
  let offset = 0;
  return categoryBreakdown.value.map((cat) => {
    const length = (cat.percentage / 100) * circumference;
    const seg = { ...cat, dashArray: `${length} ${circumference - length}`, dashOffset: -offset };
    offset += length;
    return seg;
  });
});

// ── Daily spending sparkline ────────────────────────────────────────

const dailySpending = computed(() => {
  if (!dateFrom.value || !dateTo.value) return [];
  const from = new Date(dateFrom.value + "T12:00:00");
  const to = new Date(dateTo.value + "T12:00:00");
  const map = new Map<string, number>();
  for (const r of currencyExpenses.value) {
    const day = r.date.split("T")[0]!;
    map.set(day, (map.get(day) ?? 0) + r.mySpend);
  }
  const days: { date: string; amount: number; label: string; dayNum: string; dayName: string; isWeekend: boolean; isFirstOfMonth: boolean; monthLabel: string }[] = [];
  const cursor = new Date(from);
  while (cursor <= to) {
    const iso = cursor.toISOString().slice(0, 10);
    const dow = cursor.getDay();
    days.push({
      date: iso,
      amount: map.get(iso) ?? 0,
      label: cursor.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      dayNum: String(cursor.getDate()),
      dayName: cursor.toLocaleDateString("en-US", { weekday: "short" }).toLowerCase(),
      isWeekend: dow === 0 || dow === 6,
      isFirstOfMonth: cursor.getDate() === 1,
      monthLabel: cursor.toLocaleDateString("en-US", { month: "short" }),
    });
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
});

const maxDailySpend = computed(() => Math.max(...dailySpending.value.map((d) => d.amount), 1));
const avgDailySpend = computed(() => {
  const withSpend = dailySpending.value.filter((d) => d.amount > 0);
  return withSpend.length ? withSpend.reduce((s, d) => s + d.amount, 0) / withSpend.length : 0;
});

// ── Account performance ─────────────────────────────────────────────

/** Spending per account: current period vs previous. */
const accountPerformance = computed(() => {
  const cur = new Map<number, number>();
  const prev = new Map<number, number>();
  for (const r of records.value) {
    if (r.type === "expense") cur.set(r.accountId, (cur.get(r.accountId) ?? 0) + r.mySpend);
  }
  for (const r of prevRecords.value) {
    if (r.type === "expense") prev.set(r.accountId, (prev.get(r.accountId) ?? 0) + r.mySpend);
  }
  const result = new Map<number, { current: number; previous: number; pctChange: number | null }>();
  for (const account of accounts.value) {
    const c = cur.get(account.id) ?? 0;
    const p = prev.get(account.id) ?? 0;
    result.set(account.id, { current: c, previous: p, pctChange: p > 0 ? Math.round(((c - p) / p) * 100) : null });
  }
  return result;
});

// ── Debts summary ───────────────────────────────────────────────────

/** People with non-zero balance, sorted by absolute debt descending. */
const debts = computed(() =>
  people.value
    .filter((p) => p.balance !== 0)
    .sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance)),
);

const totalOwedToYou = computed(() => debts.value.filter((p) => p.balance > 0).reduce((s, p) => s + p.balance, 0));
const totalYouOwe = computed(() => debts.value.filter((p) => p.balance < 0).reduce((s, p) => s + Math.abs(p.balance), 0));

// ── Recent records ──────────────────────────────────────────────────

/** Last 5 records in the period, sorted by date descending. */
const recentRecords = computed(() =>
  [...records.value].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5),
);

/** Format a date string for display. */
function formatDate(date: string): string {
  const dateOnly = date.split("T")[0];
  return new Date(dateOnly + "T00:00:00").toLocaleDateString(undefined, {
    month: "short", day: "numeric",
  });
}
</script>

<template>
  <UDashboardPanel>
    <template #header>
      <UDashboardNavbar title="Dashboard">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <DateRangePicker v-model:date-from="dateFrom" v-model:date-to="dateTo" />
          <UButton icon="i-lucide-sparkles" label="Quick record" @click="showQuickRecord = true" />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div v-if="loading && !records.length" class="flex items-center justify-center mt-[25vh]">
        <UIcon name="i-lucide-loader-circle" class="size-8 text-dimmed animate-spin" />
      </div>

      <div v-else-if="!records.length" class="flex flex-col items-center text-center mt-[25vh]">
        <UIcon name="i-lucide-calendar-x" class="mb-4 size-16 text-dimmed/40" />
        <h2 class="text-lg font-semibold text-highlighted">No records in this period</h2>
        <p class="mt-1 text-sm text-muted">Try selecting a different date range.</p>
      </div>

      <div v-else class="space-y-6">

        <!-- Row 1: Spending + Comparison + Income -->
        <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          <div
            v-for="item in summaryByCurrency"
            :key="item.currency"
            class="border border-default rounded-xl p-4 overflow-hidden"
          >
            <p class="text-[11px] text-muted uppercase tracking-wide">{{ item.currency }}</p>
            <p class="text-xl sm:text-2xl font-bold text-highlighted font-mono mt-1 truncate">
              -{{ formatMoneyParts(item.spending).integer }}<span class="text-sm sm:text-lg text-muted">{{ formatMoneyParts(item.spending).decimal }}</span>
            </p>
            <p v-if="item.income > 0" class="text-xs sm:text-sm font-mono font-semibold text-green-600 dark:text-green-400 mt-0.5 truncate">
              +{{ formatMoneyParts(item.income).integer }}<span class="text-[10px] sm:text-xs text-muted">{{ formatMoneyParts(item.income).decimal }}</span>
              <span class="text-[10px] text-muted font-normal ml-1">income</span>
            </p>
          </div>

          <div v-if="spendingChange.hasPrevious" class="border border-default rounded-xl p-4">
            <p class="text-[11px] text-muted uppercase tracking-wide">vs Previous Period</p>
            <div class="flex items-center gap-2 mt-1">
              <UIcon
                :name="spendingChange.increased ? 'i-lucide-trending-up' : 'i-lucide-trending-down'"
                class="size-5"
                :class="spendingChange.increased ? 'text-red-500' : 'text-green-500'"
              />
              <span class="text-2xl font-bold" :class="spendingChange.increased ? 'text-red-500' : 'text-green-500'">
                {{ spendingChange.pct }}%
              </span>
              <span class="text-xs text-muted">{{ spendingChange.increased ? 'more' : 'less' }}</span>
            </div>
            <p class="text-xs text-muted mt-1 font-mono">
              Prev: {{ formatMoneyParts(prevTotalSpending).integer }}
            </p>
          </div>
        </div>

        <!-- Currency selector (when multiple currencies) -->
        <div v-if="currencies.length > 1" class="flex items-center gap-2">
          <span class="text-xs text-muted">Analyzing</span>
          <div class="flex gap-1">
            <UButton
              v-for="cur in currencies"
              :key="cur"
              :label="cur"
              size="xs"
              :variant="selectedCurrency === cur ? 'solid' : 'ghost'"
              :color="selectedCurrency === cur ? 'primary' : 'neutral'"
              @click="selectedCurrency = cur"
            />
          </div>
        </div>

        <!-- Row 2: Daily Spending -->
        <div v-if="dailySpending.length > 1" class="border border-default rounded-xl p-4 space-y-2">
          <div class="flex items-center justify-between">
            <h3 class="text-[11px] text-muted uppercase tracking-wide font-semibold">Daily Spending · <span class="text-highlighted">{{ selectedCurrency }}</span></h3>
            <div class="flex items-center gap-2">
              <span class="text-[9px] text-zinc-500 dark:text-zinc-400">avg</span>
              <div class="w-6 border-t-2 border-dashed border-zinc-400/60 dark:border-zinc-500/40" />
              <span class="text-xs text-muted">
                <span class="font-mono font-semibold text-highlighted">{{ formatMoneyParts(avgDailySpend).integer }}</span> {{ selectedCurrency }} / day
              </span>
            </div>
          </div>
          <!-- Chart (scrollable on mobile) -->
          <div class="overflow-x-auto">
            <div class="relative" :style="{ minWidth: dailySpending.length > 14 ? `${dailySpending.length * 20}px` : undefined }">
              <!-- Avg line -->
              <div
                class="absolute left-0 right-0 z-10"
                :style="{ bottom: `${(avgDailySpend / maxDailySpend) * 100}%` }"
              >
                <div class="border-t-2 border-dashed border-zinc-400/60 dark:border-zinc-500/40" />
              </div>
              <!-- Bars -->
              <div class="flex items-end gap-[2px] h-28">
              <template v-for="(day, i) in dailySpending" :key="day.date">
                <!-- Month separator -->
                <div v-if="day.isFirstOfMonth && i > 0" class="w-px h-full bg-muted/30 shrink-0" />
                <div
                  class="flex-1 flex flex-col items-center group relative cursor-pointer"
                  @click="toggleDay(i)"
                >
                  <!-- Weekend background -->
                  <div v-if="day.isWeekend" class="absolute inset-0 bg-muted/5 rounded-t" />
                  <div
                    class="w-full rounded-t transition-all group-hover:brightness-110 relative z-1"
                    :style="{
                      height: `${(day.amount / maxDailySpend) * 96}px`,
                      minHeight: day.amount > 0 ? '2px' : '0',
                      backgroundColor: day.amount > avgDailySpend
                        ? 'var(--color-rose-300)'
                        : day.amount > 0
                          ? 'var(--color-teal-300)'
                          : 'var(--color-zinc-200)',
                      opacity: day.amount > 0 ? 0.9 : 0.15,
                    }"
                  />
                  <!-- Tooltip: hover on desktop, tap on mobile -->
                  <div
                    class="absolute bottom-full mb-1 z-20 bg-inverted text-inverted text-[10px] px-1.5 py-0.5 rounded whitespace-nowrap"
                    :class="tappedDay === i ? 'block' : 'hidden group-hover:block'"
                  >
                    {{ day.dayName }} {{ day.dayNum }} {{ day.monthLabel }} · {{ formatMoneyParts(day.amount).integer }} {{ selectedCurrency }}
                  </div>
                </div>
              </template>
            </div>
            <!-- X axis labels — adapts to range length -->
            <div class="flex items-start mt-1">
              <template v-for="(day, i) in dailySpending" :key="'lbl-' + day.date">
                <div v-if="day.isFirstOfMonth && i > 0" class="w-px shrink-0" />
                <div class="flex-1 text-center leading-tight">
                  <!-- Week view (≤7 days): day name + number -->
                  <template v-if="dailySpending.length <= 7">
                    <span class="text-[9px] block font-bold uppercase text-muted">{{ day.dayName }}</span>
                    <span class="text-[9px] block text-muted">{{ day.dayNum }}</span>
                  </template>
                  <!-- Month view (≤31 days): day name + number -->
                  <template v-else-if="dailySpending.length <= 31">
                    <span class="text-[8px] block font-bold uppercase text-muted">{{ day.dayName.slice(0, 1) }}</span>
                    <span class="text-[8px] block text-muted">{{ day.dayNum }}</span>
                  </template>
                  <!-- Long range (3m+): month name on 1st, day number every 5 days -->
                  <template v-else>
                    <span v-if="day.isFirstOfMonth" class="text-[9px] text-highlighted font-semibold">{{ day.monthLabel }}</span>
                    <span v-else-if="i % 5 === 0" class="text-[8px] text-muted">{{ day.dayNum }}</span>
                  </template>
                </div>
              </template>
            </div>
          </div>
          </div>
        </div>

        <!-- Row 3: Category (donut+bars) -->
        <div class="space-y-2">
            <h3 class="text-[11px] text-muted uppercase tracking-wide font-semibold">By Category</h3>

            <div class="border border-default rounded-xl p-4">
              <div class="flex flex-col sm:flex-row gap-4">
                <!-- Donut -->
                <div class="flex flex-col items-center shrink-0">
                  <svg viewBox="0 0 100 100" class="size-44 -rotate-90">
                    <circle
                      v-for="seg in donutSegments"
                      :key="seg.name"
                      cx="50" cy="50" r="40"
                      fill="none"
                      :stroke="getColor(seg.color)[500]"
                      :stroke-width="hoveredCategory === seg.name ? 16 : 12"
                      :stroke-dasharray="seg.dashArray"
                      :stroke-dashoffset="seg.dashOffset"
                      :opacity="1"
                      class="transition-all duration-200 cursor-pointer"
                      @mouseenter="hoveredCategory = seg.name"
                      @mouseleave="hoveredCategory = null"
                      @click="goToCategory(seg)"
                    />
                    <!-- Center label -->
                    <g class="rotate-90 origin-center">
                      <text x="50" y="44" text-anchor="middle" class="fill-muted text-[5px]">Total · {{ selectedCurrency }}</text>
                      <text x="50" y="55" text-anchor="middle" class="fill-highlighted text-[8px] font-bold font-mono">
                        {{ formatMoneyParts(currencyTotalSpending).integer }}
                      </text>
                    </g>
                  </svg>
                </div>

                <!-- Bars list -->
                <div class="flex-1 min-w-0">
                  <div
                    v-for="cat in categoryBreakdown"
                    :key="cat.name"
                    class="flex items-center gap-2 px-1.5 py-1 rounded-lg transition-colors cursor-pointer"
                    :class="hoveredCategory === cat.name ? 'bg-elevated' : ''"
                    @mouseenter="hoveredCategory = cat.name"
                    @mouseleave="hoveredCategory = null"
                    @click="goToCategory(cat)"
                  >
                    <div
                      class="flex items-center justify-center size-6 rounded-md shrink-0"
                      :style="{ backgroundColor: getColor(cat.color)[100], color: getColor(cat.color)[500] }"
                    >
                      <UIcon :name="cat.icon || 'i-lucide-tag'" class="size-3" />
                    </div>
                    <span class="text-xs text-highlighted w-20 truncate">{{ cat.name }}</span>
                    <div class="flex-1 h-2 rounded-full overflow-hidden" :style="{ backgroundColor: getColor(cat.color)[100] }">
                      <div class="h-full rounded-full transition-all" :style="{ width: `${cat.percentage}%`, backgroundColor: getColor(cat.color)[500] }" />
                    </div>
                    <div class="flex flex-col items-end shrink-0 w-16 gap-0.5">
                      <span class="text-[10px] text-muted leading-none">{{ Math.round(cat.percentage) }}%</span>
                      <span class="text-xs font-mono font-semibold text-highlighted leading-none">
                        {{ formatMoneyParts(cat.amount).integer }}
                      </span>
                    </div>
                    <div class="w-[34px] text-right shrink-0">
                      <span
                        v-if="cat.pctChange !== null"
                        class="text-[10px]"
                        :class="cat.pctChange > 0 ? 'text-red-500' : 'text-green-500'"
                      >
                        {{ cat.pctChange > 0 ? '↑' : '↓' }}{{ Math.abs(cat.pctChange) }}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
        </div>

        <!-- Row 4: Accounts + Debts + Recent Records -->
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">

          <!-- Accounts -->
          <div class="space-y-2">
            <h3 class="text-[11px] text-muted uppercase tracking-wide font-semibold">Accounts</h3>
            <div class="border border-default rounded-xl divide-y divide-default overflow-hidden">
              <div v-for="account in accounts" :key="account.id" class="flex items-center gap-3 px-4 py-2.5">
                <div
                  class="flex items-center justify-center size-7 rounded-lg shrink-0"
                  :style="{ backgroundColor: getColor(account.color)[100], color: getColor(account.color)[500] }"
                >
                  <UIcon :name="account.icon || 'i-lucide-wallet'" class="size-3.5" />
                </div>
                <span class="text-sm text-highlighted flex-1 truncate">{{ account.name }}</span>
                <div class="flex flex-col items-end shrink-0">
                  <span class="text-sm font-mono font-semibold leading-tight" :class="account.balance >= 0 ? 'text-highlighted' : 'text-error'">
                    {{ formatMoneyParts(account.balance).integer }}<span class="text-xs text-muted">{{ formatMoneyParts(account.balance).decimal }}</span>
                  </span>
                  <div class="flex items-center gap-1">
                    <span class="text-[10px] text-muted leading-none">{{ account.currency }}</span>
                    <span
                      v-if="accountPerformance.get(account.id)?.pctChange != null"
                      class="text-[10px] leading-none"
                      :class="accountPerformance.get(account.id)!.pctChange! > 0 ? 'text-red-500' : 'text-green-500'"
                    >
                      {{ accountPerformance.get(account.id)!.pctChange! > 0 ? '↑' : '↓' }}{{ Math.abs(accountPerformance.get(account.id)!.pctChange!) }}%
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Debts summary -->
          <div class="space-y-2">
            <div class="flex items-center justify-between">
              <h3 class="text-[11px] text-muted uppercase tracking-wide font-semibold">Debts</h3>
              <RouterLink to="/dashboard/people" class="text-[11px] text-primary hover:underline">View all</RouterLink>
            </div>

            <div v-if="!debts.length" class="border border-default rounded-xl p-6 text-center">
              <UIcon name="i-lucide-handshake" class="size-8 text-dimmed/40 mx-auto mb-2" />
              <p class="text-sm text-muted">All settled up</p>
            </div>

            <div v-else class="border border-default rounded-xl overflow-hidden">
              <!-- Totals row -->
              <div class="flex items-center justify-between px-4 py-2 bg-elevated/50 border-b border-default">
                <div v-if="totalOwedToYou > 0" class="flex items-center gap-1.5">
                  <UIcon name="i-lucide-arrow-down-left" class="size-3.5 text-green-500" />
                  <span class="text-xs font-mono font-semibold text-green-600 dark:text-green-400">{{ formatMoneyParts(totalOwedToYou).integer }}</span>
                  <span class="text-[10px] text-muted">owed to you</span>
                </div>
                <div v-if="totalYouOwe > 0" class="flex items-center gap-1.5">
                  <UIcon name="i-lucide-arrow-up-right" class="size-3.5 text-red-500" />
                  <span class="text-xs font-mono font-semibold text-red-600 dark:text-red-400">{{ formatMoneyParts(totalYouOwe).integer }}</span>
                  <span class="text-[10px] text-muted">you owe</span>
                </div>
              </div>
              <!-- People list -->
              <div class="divide-y divide-default">
                <RouterLink
                  v-for="person in debts"
                  :key="person.id"
                  :to="{ path: '/dashboard/records', query: { personId: String(person.id) } }"
                  class="flex items-center gap-3 px-4 py-2.5 hover:bg-elevated/50 transition-colors"
                >
                  <div
                    class="flex items-center justify-center size-7 rounded-full shrink-0 text-xs font-bold text-white"
                    :style="{ backgroundColor: getColor(person.color)[500] }"
                  >
                    {{ person.name.charAt(0).toUpperCase() }}
                  </div>
                  <span class="text-sm text-highlighted flex-1 truncate">{{ person.name }}</span>
                  <span
                    class="text-sm font-mono font-semibold"
                    :class="person.balance > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'"
                  >
                    {{ person.balance > 0 ? '+' : '-' }}{{ formatMoneyParts(Math.abs(person.balance)).integer }}<span class="text-xs text-muted">{{ formatMoneyParts(Math.abs(person.balance)).decimal }}</span>
                  </span>
                </RouterLink>
              </div>
            </div>
          </div>

          <!-- Recent records -->
          <div class="space-y-2">
            <div class="flex items-center justify-between">
              <h3 class="text-[11px] text-muted uppercase tracking-wide font-semibold">Recent</h3>
              <RouterLink :to="{ path: '/dashboard/records', query: { dateFrom: dateFrom, dateTo: dateTo } }" class="text-[11px] text-primary hover:underline">View all</RouterLink>
            </div>
            <div class="border border-default rounded-xl divide-y divide-default overflow-hidden">
              <RouterLink
                v-for="record in recentRecords"
                :key="record.id"
                :to="{ path: '/dashboard/records', query: { dateFrom: dateFrom, dateTo: dateTo } }"
                class="flex items-center gap-3 px-4 py-2.5 hover:bg-elevated/50 transition-colors"
              >
                <!-- Category icon -->
                <div
                  class="flex items-center justify-center size-7 rounded-lg shrink-0"
                  :style="{
                    backgroundColor: record.type === 'settlement' ? getColor('Green')[100] : getColor(record.categoryColor)[100],
                    color: record.type === 'settlement' ? getColor('Green')[500] : getColor(record.categoryColor)[500],
                  }"
                >
                  <UIcon
                    :name="record.type === 'settlement' ? 'i-lucide-hand-coins' : (record.categoryIcon || 'i-lucide-tag')"
                    class="size-3.5"
                  />
                </div>
                <!-- Note / tag -->
                <div class="flex-1 min-w-0">
                  <p class="text-sm text-highlighted truncate">{{ record.note || record.tagName || 'Untitled' }}</p>
                  <p class="text-[11px] text-muted">
                    {{ formatDate(record.date) }}
                    <span v-if="record.tagName && record.note"> · {{ record.tagName }}</span>
                    <span v-if="record.people?.length"> · {{ record.people.map(p => p.name).join(', ') }}</span>
                  </p>
                </div>
                <!-- Amount -->
                <span
                  class="text-sm font-mono font-semibold shrink-0"
                  :class="record.type === 'income' ? 'text-green-600 dark:text-green-400' : record.type === 'settlement' ? 'text-green-600 dark:text-green-400' : 'text-highlighted'"
                >
                  {{ record.type === 'income' ? '+' : record.type === 'settlement' ? '' : '-' }}{{ formatMoneyParts(record.amount).integer }}<span class="text-xs text-muted">{{ formatMoneyParts(record.amount).decimal }}</span>
                </span>
                <span class="text-[10px] text-muted w-8">{{ record.accountCurrency }}</span>
              </RouterLink>
            </div>
          </div>
        </div>
      </div>
    </template>
  </UDashboardPanel>

  <QuickRecordModal v-model:open="showQuickRecord" />
</template>
