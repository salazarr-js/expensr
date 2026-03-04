<script setup lang="ts">
import { ref, computed } from "vue";
import { useAccountsData } from "../composables/useAccountsData";
import TransactionRow from "../components/TransactionRow.vue";
import Badge from "../components/Badge.vue";
import { fmtARS } from "../lib/format";

const { recentTransactions } = useAccountsData();

const search = ref("");
const sourceFilter = ref<"all" | "mercadopago" | "galicia">("all");
const categoryFilter = ref<string>("all");
const showCount = ref(50);

const filtered = computed(() => {
  let txs = recentTransactions.value;
  if (sourceFilter.value !== "all") {
    txs = txs.filter((t) => t.source === sourceFilter.value);
  }
  if (categoryFilter.value !== "all") {
    txs = txs.filter((t) => t.category === categoryFilter.value);
  }
  if (search.value) {
    const q = search.value.toLowerCase();
    txs = txs.filter(
      (t) =>
        t.description.toLowerCase().includes(q) ||
        (t.person && t.person.toLowerCase().includes(q))
    );
  }
  return txs;
});

const displayed = computed(() => filtered.value.slice(0, showCount.value));
const hasMore = computed(() => filtered.value.length > showCount.value);

const totalFiltered = computed(() =>
  filtered.value.reduce((s, t) => s + t.amount, 0)
);

const categories = computed(() => {
  const set = new Set(recentTransactions.value.map((t) => t.category));
  return [...set].sort();
});
</script>

<template>
  <div class="space-y-4">
    <!-- Filters -->
    <div class="bg-bg-card rounded-xl border border-border-light p-4 space-y-3">
      <!-- Search -->
      <input
        v-model="search"
        type="text"
        placeholder="Search transactions..."
        class="w-full px-3 py-2 rounded-lg bg-bg-input border border-border text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
      />

      <div class="flex flex-wrap gap-2 items-center">
        <!-- Source toggle -->
        <div class="flex gap-1">
          <button
            v-for="opt in (['all', 'mercadopago', 'galicia'] as const)"
            :key="opt"
            @click="sourceFilter = opt"
            class="px-3 py-1 rounded-md text-xs font-semibold transition-colors capitalize"
            :class="
              sourceFilter === opt
                ? 'bg-accent text-white'
                : 'bg-bg-input text-text-secondary hover:bg-border-light'
            "
          >
            {{ opt === "all" ? "All" : opt === "mercadopago" ? "MercadoPago" : "Galicia" }}
          </button>
        </div>

        <!-- Category -->
        <select
          v-model="categoryFilter"
          class="px-2 py-1 rounded-md text-xs bg-bg-input border border-border text-text-secondary"
        >
          <option value="all">All categories</option>
          <option v-for="cat in categories" :key="cat" :value="cat">
            {{ cat.replace("_", " ") }}
          </option>
        </select>

        <!-- Summary -->
        <div class="ml-auto flex items-center gap-3">
          <Badge variant="muted">{{ filtered.length }} transactions</Badge>
          <span
            class="font-[family-name:var(--font-mono)] text-sm font-semibold"
            :class="totalFiltered >= 0 ? 'text-success' : 'text-danger'"
          >
            Net: {{ fmtARS(totalFiltered) }}
          </span>
        </div>
      </div>
    </div>

    <!-- List -->
    <div class="bg-bg-card rounded-xl border border-border-light overflow-hidden">
      <TransactionRow v-for="tx in displayed" :key="tx.id" :tx="tx" />
      <div v-if="filtered.length === 0" class="p-8 text-center text-text-muted text-sm">
        No transactions match your filters.
      </div>
      <button
        v-if="hasMore"
        @click="showCount += 50"
        class="w-full py-3 text-sm text-accent hover:bg-accent-bg transition-colors font-medium"
      >
        Load more ({{ filtered.length - showCount }} remaining)
      </button>
    </div>
  </div>
</template>
