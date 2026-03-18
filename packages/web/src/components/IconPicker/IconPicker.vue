<script setup lang="ts">
import { ref, computed, watch, nextTick } from "vue";
import { useDebounceFn } from "@vueuse/core";
import Fuse from "fuse.js";
import { ICON_SECTIONS, ALL_ICONS, type IconOption } from "./icons";

/** Fuzzy search index over icon names, labels, and keywords. */
const fuse = new Fuse(ALL_ICONS, {
  keys: ["label", "keywords", "name"],
  threshold: 0.4,
});

const props = withDefaults(
  defineProps<{
    placeholder?: string;
    /** When true, shows only the icon with no label text. */
    compact?: boolean;
  }>(),
  { placeholder: "Pick icon", compact: false }
);

const modelValue = defineModel<string | null>({ default: null });

const open = ref(false);
const searchInput = ref("");
const searchQuery = ref("");
const searchInputRef = ref<{ $el: HTMLElement } | null>(null);

/** Debounces keystrokes so fuse runs at most every 200ms. */
const debouncedSearch = useDebounceFn((val: string) => {
  searchQuery.value = val;
}, 200);

watch(searchInput, (val) => debouncedSearch(val));

const isSearching = computed(() => !!searchQuery.value);

const searchResults = computed(() => {
  if (!searchQuery.value) return [];
  return fuse.search(searchQuery.value).map((r) => r.item);
});

const selectedLabel = computed(() => {
  if (!modelValue.value) return null;
  return ALL_ICONS.find((i) => i.name === modelValue.value)?.label ?? null;
});

watch(open, (isOpen) => {
  if (isOpen) {
    searchInput.value = "";
    searchQuery.value = "";
    nextTick(() => {
      searchInputRef.value?.$el?.querySelector("input")?.focus();
    });
  }
});

function select(icon: IconOption) {
  modelValue.value = icon.name;
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
      :icon="modelValue ?? 'i-lucide-image-plus'"
      :label="compact ? undefined : (selectedLabel ?? placeholder)"
      :square="compact"
      color="neutral"
      variant="outline"
      :class="compact ? '' : 'w-full justify-start'"
    />

    <template #content>
      <div class="w-[320px] p-2">
        <UInput
          ref="searchInputRef"
          v-model="searchInput"
          icon="i-lucide-search"
          placeholder="Search icons..."
          size="sm"
          class="mb-2 w-full"
        />

        <div class="max-h-56 overflow-y-auto">
          <!-- Search results (flat) -->
          <template v-if="isSearching">
            <div v-if="searchResults.length" class="grid grid-cols-6 gap-1 justify-items-center">
              <UTooltip v-for="icon in searchResults" :key="icon.name" :text="icon.label" :portal="false">
                <UButton
                  :icon="icon.name"
                  square
                  size="md"
                  :variant="modelValue === icon.name ? 'soft' : 'ghost'"
                  :color="modelValue === icon.name ? 'primary' : 'neutral'"
                  @click="select(icon)"
                />
              </UTooltip>
            </div>
            <p v-else class="py-4 text-center text-sm text-dimmed">No icons found</p>
          </template>

          <!-- Sections (default) -->
          <template v-else>
            <div v-for="(section, idx) in ICON_SECTIONS" :key="section.title">
              <USeparator v-if="idx > 0" :label="section.title" class="my-2" />
              <div class="grid grid-cols-6 gap-1 justify-items-center">
                <UTooltip v-for="icon in section.icons" :key="icon.name" :text="icon.label" :portal="false">
                  <UButton
                    :icon="icon.name"
                    square
                    size="md"
                    :variant="modelValue === icon.name ? 'soft' : 'ghost'"
                    :color="modelValue === icon.name ? 'primary' : 'neutral'"
                    @click="select(icon)"
                  />
                </UTooltip>
              </div>
            </div>
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
