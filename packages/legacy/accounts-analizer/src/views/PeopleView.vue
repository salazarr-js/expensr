<script setup lang="ts">
import { ref, computed } from "vue";
import { useAccountsData } from "../composables/useAccountsData";
import { useOverrides } from "../composables/useOverrides";
import { fmtARS, fmtDate } from "../lib/format";
import Badge from "../components/Badge.vue";

const { peopleSummaries, allTransactions } = useAccountsData();
const { overrides, setTransactionOverride } = useOverrides();

const expanded = ref<string | null>(null);
const expandedShared = ref<string | null>(null);

function toggle(name: string) {
  expanded.value = expanded.value === name ? null : name;
}

function toggleShared(name: string) {
  expandedShared.value = expandedShared.value === name ? null : name;
}

const totals = computed(() => {
  const sent = peopleSummaries.value.reduce((s, p) => s + p.sent, 0);
  const received = peopleSummaries.value.reduce((s, p) => s + p.received, 0);
  return { sent, received, net: received - sent };
});

// Shared expenses aggregation from transaction overrides
interface SharedPersonSummary {
  name: string;
  totalOwed: number;
  totalSettled: number;
  expenses: { txId: string; txDescription: string; txDate: Date; amount: number; settled: boolean }[];
}

const sharedExpenses = computed<SharedPersonSummary[]>(() => {
  const map = new Map<string, SharedPersonSummary>();
  const txMap = new Map(allTransactions.value.map((t) => [t.id, t]));

  for (const [txId, override] of Object.entries(overrides.value.transactions)) {
    if (!override.sharedWith?.length) continue;
    const tx = txMap.get(txId);
    if (!tx) continue;

    for (const shared of override.sharedWith) {
      if (!map.has(shared.person)) {
        map.set(shared.person, {
          name: shared.person,
          totalOwed: 0,
          totalSettled: 0,
          expenses: [],
        });
      }
      const entry = map.get(shared.person)!;
      entry.expenses.push({
        txId,
        txDescription: tx.description,
        txDate: tx.date,
        amount: shared.amount,
        settled: !!shared.settled,
      });
      if (shared.settled) {
        entry.totalSettled += shared.amount;
      } else {
        entry.totalOwed += shared.amount;
      }
    }
  }

  return [...map.values()].sort((a, b) => b.totalOwed - a.totalOwed);
});

const totalSharedOwed = computed(() =>
  sharedExpenses.value.reduce((s, p) => s + p.totalOwed, 0)
);

function toggleSettled(txId: string, personName: string) {
  const override = overrides.value.transactions[txId];
  if (!override?.sharedWith) return;
  const shared = override.sharedWith.find((s) => s.person === personName);
  if (!shared) return;
  shared.settled = !shared.settled;
  setTransactionOverride(txId, { sharedWith: override.sharedWith });
}
</script>

<template>
  <div class="space-y-4">
    <!-- Summary -->
    <div class="bg-bg-card rounded-xl border border-border-light p-5">
      <h3 class="font-[family-name:var(--font-display)] font-semibold text-lg mb-3">
        People &amp; Debts
      </h3>
      <div class="grid grid-cols-3 gap-4 mb-4">
        <div>
          <p class="text-xs text-text-muted uppercase tracking-wider mb-1">Total Sent</p>
          <p class="font-[family-name:var(--font-mono)] text-lg font-semibold text-danger">
            {{ fmtARS(totals.sent) }}
          </p>
        </div>
        <div>
          <p class="text-xs text-text-muted uppercase tracking-wider mb-1">Total Received</p>
          <p class="font-[family-name:var(--font-mono)] text-lg font-semibold text-success">
            {{ fmtARS(totals.received) }}
          </p>
        </div>
        <div>
          <p class="text-xs text-text-muted uppercase tracking-wider mb-1">Net</p>
          <p
            class="font-[family-name:var(--font-mono)] text-lg font-semibold"
            :class="totals.net >= 0 ? 'text-success' : 'text-danger'"
          >
            {{ fmtARS(totals.net) }}
          </p>
        </div>
      </div>

      <p class="text-xs text-text-muted">
        {{ peopleSummaries.length }} people with transfers. Sorted by largest net balance.
      </p>
    </div>

    <!-- Shared Expenses -->
    <div
      v-if="sharedExpenses.length > 0"
      class="bg-bg-card rounded-xl border border-border-light p-5"
    >
      <div class="flex items-center justify-between mb-3">
        <h3 class="font-[family-name:var(--font-display)] font-semibold text-lg">
          Shared Expenses
        </h3>
        <span class="font-[family-name:var(--font-mono)] text-sm font-bold text-favor">
          {{ fmtARS(totalSharedOwed) }} owed
        </span>
      </div>

      <div class="space-y-2">
        <div
          v-for="person in sharedExpenses"
          :key="person.name"
          class="border border-border-light rounded-lg overflow-hidden"
        >
          <button
            @click="toggleShared(person.name)"
            class="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-bg-input/50 transition-colors text-left"
          >
            <Badge variant="favor">{{ person.name }}</Badge>
            <span class="text-xs text-text-muted">
              {{ person.expenses.length }} expense{{ person.expenses.length === 1 ? '' : 's' }}
            </span>
            <div class="ml-auto flex items-center gap-3">
              <span
                v-if="person.totalSettled > 0"
                class="text-xs text-text-muted font-[family-name:var(--font-mono)] line-through"
              >
                {{ fmtARS(person.totalSettled) }}
              </span>
              <span class="font-[family-name:var(--font-mono)] text-sm font-bold text-favor">
                {{ fmtARS(person.totalOwed) }}
              </span>
            </div>
            <span
              class="text-text-muted text-xs transition-transform"
              :class="expandedShared === person.name ? 'rotate-180' : ''"
            >
              &#9662;
            </span>
          </button>

          <div v-if="expandedShared === person.name" class="border-t border-border-light">
            <div class="px-4 py-2 bg-bg-input/30">
              <div
                v-for="exp in person.expenses"
                :key="exp.txId"
                class="flex items-center gap-3 py-1.5 border-b border-border-light/50 last:border-0"
              >
                <span class="text-xs text-text-muted w-20 font-[family-name:var(--font-mono)]">
                  {{ fmtDate(exp.txDate) }}
                </span>
                <span class="text-xs flex-1 truncate" :class="exp.settled ? 'line-through text-text-muted' : ''">
                  {{ exp.txDescription }}
                </span>
                <span
                  class="font-[family-name:var(--font-mono)] text-xs font-semibold"
                  :class="exp.settled ? 'text-text-muted line-through' : 'text-favor'"
                >
                  {{ fmtARS(exp.amount) }}
                </span>
                <button
                  @click.stop="toggleSettled(exp.txId, person.name)"
                  class="px-2 py-0.5 rounded text-[10px] font-medium transition-colors"
                  :class="
                    exp.settled
                      ? 'bg-success-bg text-success'
                      : 'bg-bg-input text-text-muted hover:bg-border-light'
                  "
                >
                  {{ exp.settled ? 'Settled' : 'Mark settled' }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- People list -->
    <div class="space-y-2">
      <div
        v-for="person in peopleSummaries"
        :key="person.name"
        class="bg-bg-card rounded-xl border border-border-light overflow-hidden"
      >
        <!-- Header row -->
        <button
          @click="toggle(person.name)"
          class="w-full px-5 py-3 flex items-center gap-3 hover:bg-bg-input/50 transition-colors text-left"
        >
          <Badge variant="favor">{{ person.name }}</Badge>
          <div class="flex-1 flex items-center gap-4 text-xs font-[family-name:var(--font-mono)]">
            <span class="text-danger">Sent: {{ fmtARS(person.sent) }}</span>
            <span class="text-success">Recv: {{ fmtARS(person.received) }}</span>
          </div>
          <span
            class="font-[family-name:var(--font-mono)] text-sm font-bold"
            :class="person.net >= 0 ? 'text-success' : 'text-danger'"
          >
            {{ person.net >= 0 ? "+" : "" }}{{ fmtARS(person.net) }}
          </span>
          <span
            class="text-text-muted text-xs transition-transform"
            :class="expanded === person.name ? 'rotate-180' : ''"
          >
            &#9662;
          </span>
        </button>

        <!-- Expanded detail -->
        <div v-if="expanded === person.name" class="border-t border-border-light">
          <div class="px-5 py-2 bg-bg-input/30">
            <p class="text-xs text-text-muted font-medium mb-2">
              {{ person.transactions.length }} transfers
            </p>
            <div
              v-for="tx in person.transactions"
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
              <span
                class="font-[family-name:var(--font-mono)] text-xs font-semibold"
                :class="tx.amount >= 0 ? 'text-success' : 'text-danger'"
              >
                {{ tx.amount >= 0 ? "+" : "" }}{{ fmtARS(tx.amount) }}
              </span>
            </div>
          </div>

        </div>
      </div>
    </div>
  </div>
</template>
