<script setup lang="ts">
import type { NormalizedTransaction } from "../types";
import { fmtARS, fmtDate } from "../lib/format";
import Badge from "./Badge.vue";

defineProps<{
  tx: NormalizedTransaction;
}>();
</script>

<template>
  <div
    class="flex items-center gap-3 px-4 py-2.5 border-b border-border-light hover:bg-bg-card/60 transition-colors"
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
      <div class="flex gap-1.5 mt-0.5" v-if="tx.person || tx.category !== 'other'">
        <Badge v-if="tx.person" variant="favor">{{ tx.person }}</Badge>
        <Badge variant="muted">{{ tx.category.replace("_", " ") }}</Badge>
      </div>
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
