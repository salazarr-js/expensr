<script setup lang="ts">
import { ref, computed } from "vue";
import { useAccountsData } from "../composables/useAccountsData";
import { fmtARS, fmtARSShort, fmtSigned } from "../lib/format";
import { toMonthKey, toMonthLabel } from "../lib/parse";
import StatCard from "../components/StatCard.vue";
import Badge from "../components/Badge.vue";
import TransactionRow from "../components/TransactionRow.vue";
import type { NormalizedTransaction, AccountSummary, MonthBucket } from "../types";

const { recentTransactions } = useAccountsData();

// ---- Filters ----
const sourceFilter = ref<"all" | "mercadopago" | "galicia">("all");
const monthFilter = ref<string>("all");

// Available months from data
const availableMonths = computed(() => {
  const set = new Map<string, string>();
  for (const t of recentTransactions.value) {
    const key = toMonthKey(t.date);
    if (!set.has(key)) set.set(key, toMonthLabel(t.date));
  }
  return [...set.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, label]) => ({ key, label }));
});

// Filtered transactions
const filtered = computed(() => {
  let txs = recentTransactions.value;
  if (sourceFilter.value !== "all") {
    txs = txs.filter((t) => t.source === sourceFilter.value);
  }
  if (monthFilter.value !== "all") {
    txs = txs.filter((t) => toMonthKey(t.date) === monthFilter.value);
  }
  return txs;
});

// Account summaries from filtered data
const accountSummaries = computed<AccountSummary[]>(() => {
  const sources =
    sourceFilter.value === "all"
      ? (["mercadopago", "galicia"] as const)
      : [sourceFilter.value] as const;

  return sources.map((source) => {
    const txs = filtered.value.filter((t) => t.source === source);
    const totalIn = txs.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0);
    const totalOut = txs.filter((t) => t.amount < 0).reduce((s, t) => s + t.amount, 0);
    const sorted = [...txs].sort((a, b) => b.date.getTime() - a.date.getTime());
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

// Monthly buckets from filtered data
const monthlyBuckets = computed<MonthBucket[]>(() => {
  const map = new Map<string, MonthBucket>();
  for (const t of filtered.value) {
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

const recentTxs = computed(() => filtered.value.slice(0, 20));

const maxMonthlyAmount = computed(() => {
  let max = 0;
  for (const b of monthlyBuckets.value) {
    max = Math.max(max, b.income, Math.abs(b.expenses));
  }
  return max || 1;
});
</script>

<template>
  <div class="space-y-6">
    <!-- Filters -->
    <div class="bg-bg-card rounded-xl border border-border-light p-4">
      <div class="flex flex-wrap gap-2 items-center">
        <!-- Source toggle -->
        <div class="flex gap-1">
          <button
            v-for="opt in (['all', 'mercadopago', 'galicia'] as const)"
            :key="opt"
            @click="sourceFilter = opt"
            class="px-3 py-1 rounded-md text-xs font-semibold transition-colors"
            :class="
              sourceFilter === opt
                ? 'bg-accent text-white'
                : 'bg-bg-input text-text-secondary hover:bg-border-light'
            "
          >
            {{ opt === "all" ? "All Accounts" : opt === "mercadopago" ? "MercadoPago" : "Galicia" }}
          </button>
        </div>

        <!-- Month toggle -->
        <div class="flex gap-1">
          <button
            @click="monthFilter = 'all'"
            class="px-3 py-1 rounded-md text-xs font-semibold transition-colors"
            :class="
              monthFilter === 'all'
                ? 'bg-accent text-white'
                : 'bg-bg-input text-text-secondary hover:bg-border-light'
            "
          >
            All Months
          </button>
          <button
            v-for="m in availableMonths"
            :key="m.key"
            @click="monthFilter = m.key"
            class="px-3 py-1 rounded-md text-xs font-semibold transition-colors"
            :class="
              monthFilter === m.key
                ? 'bg-accent text-white'
                : 'bg-bg-input text-text-secondary hover:bg-border-light'
            "
          >
            {{ m.label }}
          </button>
        </div>

        <Badge variant="muted" class="ml-auto">{{ filtered.length }} transactions</Badge>
      </div>
    </div>

    <!-- Account Summary Cards -->
    <div
      class="grid gap-4"
      :class="accountSummaries.length === 1 ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2'"
    >
      <div
        v-for="acct in accountSummaries"
        :key="acct.source"
        class="bg-bg-card rounded-xl border border-border-light p-5"
      >
        <div class="flex items-center gap-2 mb-4">
          <span
            class="w-3 h-3 rounded-full"
            :class="acct.source === 'mercadopago' ? 'bg-mp' : 'bg-galicia'"
          />
          <h3 class="font-[family-name:var(--font-display)] font-semibold text-lg">
            {{ acct.label }}
          </h3>
          <Badge :variant="acct.source === 'mercadopago' ? 'mp' : 'galicia'">
            {{ acct.txCount }} txns
          </Badge>
        </div>

        <div v-if="acct.currentBalance !== null" class="mb-4">
          <p class="text-xs text-text-muted uppercase tracking-wider mb-1">Latest Balance</p>
          <p class="font-[family-name:var(--font-mono)] text-2xl font-bold">
            {{ fmtARS(acct.currentBalance) }}
          </p>
        </div>

        <div class="grid grid-cols-3 gap-4">
          <StatCard label="Inflows" :value="acct.totalIn" :short="true" color="success" />
          <StatCard label="Outflows" :value="acct.totalOut" :short="true" color="danger" />
          <StatCard
            label="Net"
            :value="acct.net"
            :short="true"
            :color="acct.net >= 0 ? 'success' : 'danger'"
          />
        </div>
      </div>
    </div>

    <!-- Monthly Overview -->
    <div class="bg-bg-card rounded-xl border border-border-light p-5">
      <h3 class="font-[family-name:var(--font-display)] font-semibold text-lg mb-4">
        Monthly Overview
      </h3>
      <div class="space-y-4">
        <div v-for="month in monthlyBuckets" :key="month.key" class="space-y-1.5">
          <div class="flex items-center justify-between">
            <span class="text-sm font-medium w-20">{{ month.label }}</span>
            <span
              class="font-[family-name:var(--font-mono)] text-xs"
              :class="month.net >= 0 ? 'text-success' : 'text-danger'"
            >
              Net {{ fmtSigned(month.net) }}
            </span>
          </div>
          <!-- Income bar -->
          <div class="flex items-center gap-2">
            <span class="text-xs text-text-muted w-6">In</span>
            <div class="flex-1 h-4 bg-bg-input rounded-sm overflow-hidden">
              <div
                class="h-full bg-success/30 rounded-sm"
                :style="{ width: `${(month.income / maxMonthlyAmount) * 100}%` }"
              />
            </div>
            <span class="font-[family-name:var(--font-mono)] text-xs text-text-muted w-16 text-right">
              {{ fmtARSShort(month.income) }}
            </span>
          </div>
          <!-- Expenses bar -->
          <div class="flex items-center gap-2">
            <span class="text-xs text-text-muted w-6">Out</span>
            <div class="flex-1 h-4 bg-bg-input rounded-sm overflow-hidden">
              <div
                class="h-full bg-danger/30 rounded-sm"
                :style="{
                  width: `${(Math.abs(month.expenses) / maxMonthlyAmount) * 100}%`,
                }"
              />
            </div>
            <span class="font-[family-name:var(--font-mono)] text-xs text-text-muted w-16 text-right">
              {{ fmtARSShort(Math.abs(month.expenses)) }}
            </span>
          </div>
        </div>
      </div>
      <div v-if="monthlyBuckets.length === 0" class="text-sm text-text-muted text-center py-4">
        No data for the selected filters.
      </div>
    </div>

    <!-- Recent Activity -->
    <div class="bg-bg-card rounded-xl border border-border-light overflow-hidden">
      <div class="px-5 py-4 border-b border-border-light">
        <h3 class="font-[family-name:var(--font-display)] font-semibold text-lg">
          Recent Activity
        </h3>
        <p class="text-xs text-text-muted mt-0.5">Last 20 transactions matching filters</p>
      </div>
      <TransactionRow v-for="tx in recentTxs" :key="tx.id" :tx="tx" />
      <div v-if="recentTxs.length === 0" class="p-8 text-center text-text-muted text-sm">
        No transactions match the selected filters.
      </div>
    </div>
  </div>
</template>
