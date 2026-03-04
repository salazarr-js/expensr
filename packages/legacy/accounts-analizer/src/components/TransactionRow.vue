<script setup lang="ts">
import type { NormalizedTransaction } from "../types";
import { fmtARS, fmtDate } from "../lib/format";
import { CATEGORY_LABELS, CATEGORY_COLORS } from "../lib/categories";
import Badge from "./Badge.vue";

defineProps<{
  tx: NormalizedTransaction;
  selected?: boolean;
}>();

defineEmits<{
  select: [id: string];
}>();
</script>

<template>
  <div
    @click="$emit('select', tx.id)"
    class="flex items-center gap-3 px-4 py-2.5 border-b border-border-light transition-colors cursor-pointer"
    :class="[
      selected
        ? 'bg-accent/5 border-l-2 border-l-accent'
        : 'hover:bg-bg-card/60',
      !tx.reviewed && tx.spendingCategory === 'other' ? 'bg-amber-50/40' : '',
    ]"
  >
    <!-- Source dot -->
    <span
      class="w-2 h-2 rounded-full shrink-0"
      :class="tx.source === 'mercadopago' ? 'bg-mp' : 'bg-galicia'"
    />

    <!-- Date -->
    <span class="text-xs text-text-muted font-[family-name:var(--font-mono)] w-20 shrink-0">
      {{ fmtDate(tx.date) }}
    </span>

    <!-- Description -->
    <div class="flex-1 min-w-0">
      <p class="text-sm truncate">{{ tx.description }}</p>
      <div class="flex items-center gap-1.5 mt-0.5 flex-wrap">
        <!-- Merchant name subtitle -->
        <span
          v-if="tx.merchantName"
          class="text-xs text-text-secondary truncate max-w-48"
        >
          {{ tx.merchantName }}
        </span>
        <!-- Spending category badge -->
        <span
          v-if="tx.spendingCategory && tx.spendingCategory !== 'other'"
          class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium"
          :class="CATEGORY_COLORS[tx.spendingCategory]"
        >
          {{ CATEGORY_LABELS[tx.spendingCategory] }}
        </span>
        <Badge v-if="tx.person" variant="favor">{{ tx.person }}</Badge>
        <Badge v-if="!tx.spendingCategory || tx.spendingCategory === 'other'" variant="muted">
          {{ tx.category.replace("_", " ") }}
        </Badge>
      </div>
    </div>

    <!-- Override indicators -->
    <div class="flex items-center gap-1 shrink-0">
      <!-- Shared icon -->
      <span
        v-if="tx.sharedWith && tx.sharedWith.length > 0"
        class="text-favor text-xs"
        title="Shared expense"
      >
        <svg class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
          <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
        </svg>
      </span>
      <!-- Note icon -->
      <span
        v-if="tx.note"
        class="text-text-muted text-xs"
        title="Has note"
      >
        <svg class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
          <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
        </svg>
      </span>
      <!-- Reviewed checkmark -->
      <span
        v-if="tx.reviewed"
        class="text-success text-xs"
        title="Reviewed"
      >
        <svg class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
        </svg>
      </span>
    </div>

    <!-- Amount -->
    <span
      class="font-[family-name:var(--font-mono)] text-sm font-semibold tabular-nums shrink-0"
      :class="tx.amount >= 0 ? 'text-success' : 'text-danger'"
    >
      {{ tx.amount >= 0 ? "+" : "" }}{{ fmtARS(tx.amount) }}
    </span>
  </div>
</template>
