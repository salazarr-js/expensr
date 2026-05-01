<script setup lang="ts">
import { ref, computed, watch } from "vue";

const modelValue = defineModel<string>({ required: true }); // "YYYY-MM"

/** Optional max month (inclusive). Defaults to current month — no future months. */
const props = withDefaults(defineProps<{ max?: string }>(), {
  max: () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  },
});

const open = ref(false);
const pickerYear = ref(new Date().getFullYear());

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const label = computed(() => {
  const [y, m] = modelValue.value.split("-").map(Number);
  return new Date(y!, m! - 1, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });
});

const selectedIdx = computed(() => {
  const [y, m] = modelValue.value.split("-").map(Number);
  return pickerYear.value === y! ? m! - 1 : -1;
});

/** Max year/month parsed for comparison. */
const maxYear = computed(() => Number(props.max.split("-")[0]));
const maxMonth = computed(() => Number(props.max.split("-")[1]));

/** Whether a month button should be disabled (future). */
function isDisabled(monthIdx: number): boolean {
  if (pickerYear.value < maxYear.value) return false;
  if (pickerYear.value > maxYear.value) return true;
  return monthIdx + 1 > maxMonth.value;
}

/** Block navigating to a year beyond the max. */
const canGoForward = computed(() => pickerYear.value < maxYear.value);

function pick(monthIdx: number) {
  if (isDisabled(monthIdx)) return;
  modelValue.value = `${pickerYear.value}-${String(monthIdx + 1).padStart(2, "0")}`;
  open.value = false;
}

watch(open, (isOpen) => {
  if (isOpen) pickerYear.value = Number(modelValue.value.split("-")[0]);
});
</script>

<template>
  <UPopover v-model:open="open" :content="{ side: 'bottom', align: 'start' }">
    <UButton :label="label" icon="i-lucide-calendar" color="neutral" variant="outline" class="w-full justify-start" />

    <template #content>
      <div class="p-3 w-56">
        <!-- Year nav -->
        <div class="flex items-center justify-between mb-3">
          <UButton icon="i-lucide-chevron-left" size="xs" variant="ghost" color="neutral" @click="pickerYear--" />
          <span class="text-sm font-semibold text-highlighted">{{ pickerYear }}</span>
          <UButton icon="i-lucide-chevron-right" size="xs" variant="ghost" color="neutral" :disabled="!canGoForward" @click="pickerYear++" />
        </div>
        <!-- Month grid -->
        <div class="grid grid-cols-3 gap-1">
          <UButton
            v-for="(lbl, idx) in MONTH_LABELS"
            :key="idx"
            :label="lbl"
            size="sm"
            :variant="idx === selectedIdx ? 'solid' : 'ghost'"
            :color="idx === selectedIdx ? 'primary' : 'neutral'"
            :disabled="isDisabled(idx)"
            class="justify-center"
            @click="pick(idx)"
          />
        </div>
      </div>
    </template>
  </UPopover>
</template>
