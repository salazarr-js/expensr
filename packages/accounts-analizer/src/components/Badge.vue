<script setup lang="ts">
defineProps<{
  variant?: "mp" | "galicia" | "favor" | "success" | "danger" | "muted";
}>();

const classes: Record<string, string> = {
  mp: "bg-mp-bg text-mp",
  galicia: "bg-galicia-bg text-galicia",
  favor: "bg-favor-bg text-favor",
  success: "bg-success-bg text-success",
  danger: "bg-danger-bg text-danger",
  muted: "bg-bg-input text-text-muted",
};
</script>

<template>
  <span
    class="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold"
    :class="classes[variant ?? 'muted']"
  >
    <slot />
  </span>
</template>
