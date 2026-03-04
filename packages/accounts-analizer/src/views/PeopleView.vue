<script setup lang="ts">
import { ref, computed } from "vue";
import { useAccountsData } from "../composables/useAccountsData";
import { fmtARS, fmtDate } from "../lib/format";
import Badge from "../components/Badge.vue";

const { peopleSummaries, longTransactions } = useAccountsData();

const expanded = ref<string | null>(null);

function toggle(name: string) {
  expanded.value = expanded.value === name ? null : name;
}

// Cross-reference: find matching entries in transactions_long
function findLongRefs(personName: string) {
  if (!longTransactions.value) return [];
  const q = personName.toLowerCase();
  return longTransactions.value.transactions.filter((t) => {
    const desc = (t.Description || "").toLowerCase();
    const words = q.split(/\s+/).filter((w) => w.length > 3);
    return words.some((w) => desc.includes(w));
  });
}

const totals = computed(() => {
  const sent = peopleSummaries.value.reduce((s, p) => s + p.sent, 0);
  const received = peopleSummaries.value.reduce((s, p) => s + p.received, 0);
  return { sent, received, net: received - sent };
});
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

          <!-- Cross-reference from transactions_long -->
          <div
            v-if="findLongRefs(person.name).length > 0"
            class="px-5 py-2 bg-favor-bg/30 border-t border-border-light"
          >
            <p class="text-xs text-favor font-semibold mb-1">
              Cross-reference (your manual records)
            </p>
            <div
              v-for="(lt, i) in findLongRefs(person.name).slice(0, 5)"
              :key="i"
              class="text-xs text-text-secondary py-0.5"
            >
              {{ lt.Date }} &middot; {{ lt.Account }} &middot;
              {{ lt.Description }} &middot;
              <span class="font-[family-name:var(--font-mono)]">{{ fmtARS(lt.Amount) }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
