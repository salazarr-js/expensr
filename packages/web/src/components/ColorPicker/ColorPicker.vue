<script setup lang="ts">
import { ref, computed } from "vue";
import { APP_COLORS, getColor } from "@/utils/colors";

withDefaults(
  defineProps<{
    placeholder?: string;
  }>(),
  { placeholder: "Pick color" }
);

const modelValue = defineModel<string | null>({ default: null });
const open = ref(false);

/** Resolved color palette for the current selection. */
const selected = computed(() => getColor(modelValue.value));

function select(name: string) {
  modelValue.value = name;
  open.value = false;
}

function clear() {
  modelValue.value = null;
  open.value = false;
}
</script>

<template>
  <UPopover v-model:open="open" :content="{ side: 'bottom', align: 'start' }">
    <UButton
      color="neutral"
      variant="outline"
      class="w-full justify-start"
    >
      <template #leading>
        <span
          v-if="selected"
          class="size-4 rounded-full"
          :style="{ backgroundColor: selected[500] }"
        />
        <UIcon v-else name="i-lucide-palette" class="size-4 text-dimmed" />
      </template>
      <span :class="selected ? '' : 'text-dimmed'">
        {{ selected?.name ?? placeholder }}
      </span>
    </UButton>

    <template #content>
      <div class="w-60 p-2">
        <div class="grid grid-cols-6 gap-1.5">
          <template
            v-for="color in APP_COLORS"
            :key="color.name"
          >
            <UTooltip
              :text="color.name"
              :portal="false"
              :default-open="false"
            >
              <button
                class="size-8 rounded-full flex items-center justify-center cursor-pointer transition-transform hover:scale-110"
                :style="{ backgroundColor: color[500] }"
                @click="select(color.name)"
              >
                <UIcon
                  v-if="modelValue === color.name"
                  name="i-lucide-check"
                  class="size-4 text-white"
                />
              </button>
            </UTooltip>
          </template>
        </div>

        <button
          v-if="modelValue"
          class="mt-2 w-full flex items-center justify-center gap-1.5 rounded-md py-1.5 text-xs text-dimmed bg-muted/50 hover:bg-muted cursor-pointer transition-colors"
          @click="clear"
        >
          <UIcon name="i-lucide-x" class="size-3" />
          Clear selection
        </button>
      </div>
    </template>
  </UPopover>
</template>
