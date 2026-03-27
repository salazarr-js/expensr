<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { useMediaQuery } from "@vueuse/core";
import { DATE_PRESETS, toCalendarDate, formatRangeLabel, type DatePreset } from "@/utils/dates";

// Show 2 months on md+ screens, 1 on small
const isWide = useMediaQuery("(min-width: 640px)");
const numberOfMonths = computed(() => isWide.value ? 2 : 1);

const dateFrom = defineModel<string | undefined>("dateFrom");
const dateTo = defineModel<string | undefined>("dateTo");

const open = ref(false);

// Internal calendar state — may be partial during range selection (first click = start only)
const internalRange = ref<{ start: any; end: any }>({
  start: undefined,
  end: undefined,
});

// Sync external models → internal calendar state
watch([dateFrom, dateTo], ([from, to]) => {
  internalRange.value = {
    start: from ? toCalendarDate(from) : undefined,
    end: to ? toCalendarDate(to) : undefined,
  };
}, { immediate: true });

/** Bridge between internalRange and UCalendar v-model. Closes popover when range is complete. */
const calendarModel = computed({
  get: () => internalRange.value,
  set: (val: { start: any; end: any }) => {
    internalRange.value = val;
    // Complete range selected — emit and close
    if (val.start && val.end) {
      dateFrom.value = val.start.toString();
      dateTo.value = val.end.toString();
      open.value = false;
    }
  },
});

/** Which preset matches the current selection (if any). */
const activePreset = computed(() => {
  for (const preset of DATE_PRESETS) {
    const range = preset.range();
    if (!range && !dateFrom.value && !dateTo.value) return preset.key;
    if (range && dateFrom.value === range.start.toString() && dateTo.value === range.end.toString()) {
      return preset.key;
    }
  }
  return null;
});

/** Button label — preset name or formatted date range. */
const buttonLabel = computed(() => formatRangeLabel(dateFrom.value, dateTo.value));

/** Select a preset: set models, update calendar, close popover. */
function selectPreset(preset: DatePreset) {
  const range = preset.range();
  if (range) {
    dateFrom.value = range.start.toString();
    dateTo.value = range.end.toString();
    internalRange.value = { start: range.start, end: range.end };
  } else {
    // "All time" — clear filter
    dateFrom.value = undefined;
    dateTo.value = undefined;
    internalRange.value = { start: undefined, end: undefined };
  }
  open.value = false;
}
</script>

<template>
  <UPopover v-model:open="open" :content="{ side: 'bottom', align: 'start' }">
    <UButton color="neutral" variant="outline" icon="i-lucide-calendar" trailing-icon="i-lucide-chevron-down" class="whitespace-nowrap">
      <span class="hidden sm:inline">{{ buttonLabel }}</span>
    </UButton>

    <template #content>
      <div class="p-3" style="max-width: calc(100vw - 16px)">
        <!-- Preset chips -->
        <div class="flex flex-wrap justify-center gap-1.5 mb-3">
          <button
            v-for="preset in DATE_PRESETS"
            :key="preset.key"
            class="px-2.5 py-1 text-xs rounded-full cursor-pointer transition-colors"
            :class="activePreset === preset.key
              ? 'bg-primary/10 text-primary font-medium'
              : 'bg-elevated text-muted hover:text-default'"
            @click="selectPreset(preset)"
          >
            {{ preset.label }}
          </button>
        </div>

        <!-- Range calendar -->
        <UCalendar v-model="calendarModel" range :number-of-months="numberOfMonths" />
      </div>
    </template>
  </UPopover>
</template>
