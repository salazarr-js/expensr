<script setup lang="ts">
import { useAccountsData } from "../composables/useAccountsData";
import { fmtARS, fmtARSShort, fmtSigned } from "../lib/format";
import StatCard from "../components/StatCard.vue";
import Badge from "../components/Badge.vue";
import TransactionRow from "../components/TransactionRow.vue";
import { computed } from "vue";

const { accountSummaries, monthlyBuckets, recentTransactions } = useAccountsData();

const recentTxs = computed(() => recentTransactions.value.slice(0, 20));

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
    <!-- Account Summary Cards -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
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
    </div>

    <!-- Recent Activity -->
    <div class="bg-bg-card rounded-xl border border-border-light overflow-hidden">
      <div class="px-5 py-4 border-b border-border-light">
        <h3 class="font-[family-name:var(--font-display)] font-semibold text-lg">
          Recent Activity
        </h3>
        <p class="text-xs text-text-muted mt-0.5">Last 20 transactions across both accounts</p>
      </div>
      <TransactionRow v-for="tx in recentTxs" :key="tx.id" :tx="tx" />
    </div>
  </div>
</template>
