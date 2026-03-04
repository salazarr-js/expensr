<script setup lang="ts">
import { ref, computed, watch } from "vue";
import type {
  NormalizedTransaction,
  SpendingCategory,
  SharedExpense,
  TransactionOverride,
} from "../types";
import { useOverrides } from "../composables/useOverrides";
import { useAccountsData } from "../composables/useAccountsData";
import { CATEGORY_LABELS, CATEGORY_COLORS } from "../lib/categories";
import { extractMerchantKey } from "../lib/merchants";
import { fmtARS } from "../lib/format";

const props = defineProps<{
  tx: NormalizedTransaction;
}>();

const emit = defineEmits<{
  close: [];
  saved: [];
}>();

const { setTransactionOverride, addMerchantRule, getOverride, overrides } = useOverrides();
const { allTransactions } = useAccountsData();

// Local edit state
const selectedCategory = ref<SpendingCategory>(props.tx.spendingCategory ?? "other");
const merchantName = ref(props.tx.merchantName ?? "");
const note = ref(props.tx.note ?? "");
const sharedList = ref<SharedExpense[]>([...(props.tx.sharedWith ?? [])]);
const applyToAll = ref(false);

// Reset when tx changes
watch(
  () => props.tx.id,
  () => {
    const override = getOverride(props.tx.id);
    selectedCategory.value = override?.spendingCategory ?? props.tx.spendingCategory ?? "other";
    merchantName.value = override?.merchantName ?? props.tx.merchantName ?? "";
    note.value = override?.note ?? props.tx.note ?? "";
    sharedList.value = [...(override?.sharedWith ?? props.tx.sharedWith ?? [])];
    applyToAll.value = false;
  }
);

const merchantKey = computed(() =>
  extractMerchantKey(props.tx.description, props.tx.source)
);

const matchingCount = computed(() => {
  if (!merchantKey.value) return 0;
  const key = merchantKey.value;
  return allTransactions.value.filter((t) => {
    const tKey = extractMerchantKey(t.description, t.source);
    return tKey === key && t.id !== props.tx.id;
  }).length;
});

const spendingCategories = Object.keys(CATEGORY_LABELS) as SpendingCategory[];

// Shared expenses
const people = computed(() => overrides.value.people);

function addShared(person: string) {
  if (sharedList.value.some((s) => s.person === person)) return;
  sharedList.value.push({ person, amount: 0 });
}

function removeShared(index: number) {
  sharedList.value.splice(index, 1);
}

function handleSave() {
  const override: TransactionOverride = {
    spendingCategory: selectedCategory.value,
    reviewed: true,
  };
  if (merchantName.value) override.merchantName = merchantName.value;
  if (note.value) override.note = note.value;
  if (sharedList.value.length > 0) {
    override.sharedWith = sharedList.value.filter((s) => s.amount > 0);
  }

  setTransactionOverride(props.tx.id, override);

  // Create merchant rule if "apply to all" is checked
  if (applyToAll.value && merchantKey.value) {
    addMerchantRule({
      id: `rule-${merchantKey.value}`,
      pattern: merchantKey.value,
      merchantName: merchantName.value || props.tx.merchantName || merchantKey.value,
      spendingCategory: selectedCategory.value,
      source: props.tx.source,
    });
  }

  emit("saved");
}
</script>

<template>
  <div class="border-t border-border-light bg-bg-input/40 px-5 py-4 space-y-4">
    <!-- Category grid -->
    <div>
      <p class="text-xs text-text-muted font-medium mb-2">Spending Category</p>
      <div class="flex flex-wrap gap-1.5">
        <button
          v-for="cat in spendingCategories"
          :key="cat"
          @click="selectedCategory = cat"
          class="px-2.5 py-1 rounded-md text-xs font-medium transition-all"
          :class="[
            CATEGORY_COLORS[cat],
            selectedCategory === cat
              ? 'ring-2 ring-offset-1 ring-accent'
              : 'opacity-60 hover:opacity-100',
          ]"
        >
          {{ CATEGORY_LABELS[cat] }}
        </button>
      </div>
    </div>

    <!-- Merchant name -->
    <div>
      <p class="text-xs text-text-muted font-medium mb-1">Merchant Name</p>
      <input
        v-model="merchantName"
        type="text"
        placeholder="e.g. Starbucks"
        class="w-full px-3 py-1.5 rounded-lg bg-white border border-border text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
      />
      <!-- Apply to all toggle -->
      <label
        v-if="merchantKey && matchingCount > 0"
        class="flex items-center gap-2 mt-1.5 text-xs text-text-secondary cursor-pointer"
      >
        <input
          v-model="applyToAll"
          type="checkbox"
          class="rounded border-border text-accent focus:ring-accent/30"
        />
        Apply to all "{{ merchantKey }}" ({{ matchingCount }} more)
      </label>
    </div>

    <!-- Shared with -->
    <div>
      <p class="text-xs text-text-muted font-medium mb-1">Shared With</p>
      <div class="flex flex-wrap gap-1.5 mb-2">
        <button
          v-for="person in people"
          :key="person"
          @click="addShared(person)"
          class="px-2 py-0.5 rounded-md text-xs font-medium transition-colors"
          :class="
            sharedList.some((s) => s.person === person)
              ? 'bg-favor-bg text-favor ring-1 ring-favor/30'
              : 'bg-bg-input text-text-muted hover:bg-border-light'
          "
        >
          {{ person }}
        </button>
      </div>
      <!-- Amount inputs for selected people -->
      <div v-if="sharedList.length > 0" class="space-y-1.5">
        <div
          v-for="(shared, i) in sharedList"
          :key="shared.person"
          class="flex items-center gap-2"
        >
          <span class="text-xs font-medium text-favor w-20">{{ shared.person }}</span>
          <input
            v-model.number="shared.amount"
            type="number"
            placeholder="Amount (ARS)"
            class="flex-1 px-2 py-1 rounded-md bg-white border border-border text-xs font-[family-name:var(--font-mono)] focus:outline-none focus:ring-2 focus:ring-accent/30"
          />
          <button
            @click="removeShared(i)"
            class="text-text-muted hover:text-danger text-xs px-1"
          >
            &times;
          </button>
        </div>
      </div>
    </div>

    <!-- Note -->
    <div>
      <p class="text-xs text-text-muted font-medium mb-1">Note</p>
      <input
        v-model="note"
        type="text"
        placeholder="Optional note..."
        class="w-full px-3 py-1.5 rounded-lg bg-white border border-border text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
      />
    </div>

    <!-- Actions -->
    <div class="flex items-center gap-2 pt-1">
      <button
        @click="handleSave"
        class="px-4 py-1.5 rounded-lg bg-accent text-white text-xs font-semibold hover:bg-accent/90 transition-colors"
      >
        Save &amp; Mark Reviewed
      </button>
      <button
        @click="emit('close')"
        class="px-4 py-1.5 rounded-lg bg-bg-input text-text-secondary text-xs font-medium hover:bg-border-light transition-colors"
      >
        Cancel
      </button>
      <span
        v-if="tx.reviewed"
        class="ml-auto text-xs text-success font-medium flex items-center gap-1"
      >
        <svg class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
        </svg>
        Reviewed
      </span>
    </div>
  </div>
</template>
