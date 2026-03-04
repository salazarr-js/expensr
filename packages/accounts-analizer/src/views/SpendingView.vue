<script setup lang="ts">
import { ref, computed } from "vue";
import { useAccountsData } from "../composables/useAccountsData";
import { fmtARS, fmtARSShort, fmtDate } from "../lib/format";
import Badge from "../components/Badge.vue";

const { spendingByMerchant, recentTransactions } = useAccountsData();

const expanded = ref<string | null>(null);

function toggle(label: string) {
  expanded.value = expanded.value === label ? null : label;
}

const maxTotal = computed(() => spendingByMerchant.value[0]?.total ?? 1);

const totalSpending = computed(() =>
  spendingByMerchant.value.reduce((s, m) => s + m.total, 0)
);

const totalTxCount = computed(() =>
  spendingByMerchant.value.reduce((s, m) => s + m.count, 0)
);
</script>

<template>
  <div class="space-y-4">
    <!-- Summary -->
    <div class="bg-bg-card rounded-xl border border-border-light p-5">
      <h3 class="font-[family-name:var(--font-display)] font-semibold text-lg mb-2">
        Spending Breakdown
      </h3>
      <p class="text-xs text-text-muted mb-3">
        Purchases &amp; payments from the last 3 months across both accounts.
      </p>
      <div class="flex gap-6">
        <div>
          <p class="text-xs text-text-muted uppercase tracking-wider mb-1">Total Spent</p>
          <p class="font-[family-name:var(--font-mono)] text-xl font-bold text-danger">
            {{ fmtARS(totalSpending) }}
          </p>
        </div>
        <div>
          <p class="text-xs text-text-muted uppercase tracking-wider mb-1">Merchants</p>
          <p class="font-[family-name:var(--font-mono)] text-xl font-bold">
            {{ spendingByMerchant.length }}
          </p>
        </div>
        <div>
          <p class="text-xs text-text-muted uppercase tracking-wider mb-1">Transactions</p>
          <p class="font-[family-name:var(--font-mono)] text-xl font-bold">
            {{ totalTxCount }}
          </p>
        </div>
      </div>
    </div>

    <!-- Merchant bars -->
    <div class="bg-bg-card rounded-xl border border-border-light overflow-hidden">
      <div
        v-for="merchant in spendingByMerchant.slice(0, 30)"
        :key="merchant.label"
        class="border-b border-border-light last:border-0"
      >
        <button
          @click="toggle(merchant.label)"
          class="w-full px-5 py-3 hover:bg-bg-input/50 transition-colors text-left"
        >
          <div class="flex items-center justify-between mb-1.5">
            <span class="text-sm font-medium truncate flex-1">{{ merchant.label }}</span>
            <div class="flex items-center gap-2 shrink-0">
              <Badge variant="muted">{{ merchant.count }}x</Badge>
              <span class="font-[family-name:var(--font-mono)] text-sm font-semibold text-danger">
                {{ fmtARS(merchant.total) }}
              </span>
            </div>
          </div>
          <div class="h-2 bg-bg-input rounded-full overflow-hidden">
            <div
              class="h-full bg-danger/40 rounded-full transition-all"
              :style="{ width: `${(merchant.total / maxTotal) * 100}%` }"
            />
          </div>
        </button>

        <!-- Expanded: individual transactions -->
        <div
          v-if="expanded === merchant.label"
          class="px-5 py-2 bg-bg-input/30 border-t border-border-light"
        >
          <div
            v-for="tx in merchant.transactions"
            :key="tx.id"
            class="flex items-center gap-3 py-1.5 border-b border-border-light/50 last:border-0"
          >
            <span
              class="w-2 h-2 rounded-full shrink-0"
              :class="tx.source === 'mercadopago' ? 'bg-mp' : 'bg-galicia'"
            />
            <span class="text-xs text-text-muted w-20 font-[family-name:var(--font-mono)]">
              {{ fmtDate(tx.date) }}
            </span>
            <span class="text-xs flex-1 truncate">{{ tx.description }}</span>
            <span class="font-[family-name:var(--font-mono)] text-xs font-semibold text-danger">
              {{ fmtARS(Math.abs(tx.amount)) }}
            </span>
          </div>
        </div>
      </div>

      <div v-if="spendingByMerchant.length === 0" class="p-8 text-center text-text-muted text-sm">
        No purchase data in the last 3 months.
      </div>
    </div>
  </div>
</template>
