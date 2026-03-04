<script setup lang="ts">
import { fmtARS, fmtARSShort } from "../lib/format";

const props = defineProps<{
  label: string;
  value: number;
  short?: boolean;
  color?: "success" | "danger" | "accent" | "muted";
}>();

const colorClass: Record<string, string> = {
  success: "text-success",
  danger: "text-danger",
  accent: "text-accent",
  muted: "text-text-muted",
};
</script>

<template>
  <div>
    <p class="text-xs text-text-muted font-medium uppercase tracking-wider mb-1">
      {{ label }}
    </p>
    <p
      class="font-[family-name:var(--font-mono)] text-lg font-semibold"
      :class="color ? colorClass[color] : ''"
    >
      {{ short ? fmtARSShort(value) : fmtARS(value) }}
    </p>
  </div>
</template>
