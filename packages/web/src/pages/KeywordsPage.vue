<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from "vue";
import { storeToRefs } from "pinia";
import { useCategoriesStore } from "@/stores/categories";
import { useApi } from "@/composables/useApi";
import { useAlertDialog } from "@/composables/useAlertDialog";
import { getColor } from "@/utils/colors";

interface KeywordMapping {
  id: number;
  keyword: string;
  tagId: number | null;
  tagName: string | null;
  tagIcon: string | null;
  categoryColor: string | null;
  usageCount: number;
}

const api = useApi();
const alert = useAlertDialog();
const categoriesStore = useCategoriesStore();
const { categories, tagsByCategory } = storeToRefs(categoriesStore);

const mappings = ref<KeywordMapping[]>([]);
const loading = ref(false);
const error = ref(false);
const search = ref("");

// Inline add state
const addingToTag = ref<string | null>(null);
const newKeyword = ref("");
const addingKeyword = ref(false);

// Top-level add form
const showAddForm = ref(false);
const addFormKeyword = ref("");
const addFormTagId = ref<number | undefined>();

async function fetchMappings() {
  loading.value = true;
  error.value = false;
  try {
    mappings.value = await api.get<KeywordMapping[]>("/records/parse/keywords");
  } catch {
    error.value = true;
    useToast().add({ title: "Failed to load keywords", color: "error" });
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  fetchMappings();
  categoriesStore.fetchAll();
});

const tagOptions = computed(() => {
  const opts: { label: string; value: number }[] = [];
  for (const cat of categories.value) {
    for (const tag of tagsByCategory.value[cat.id] ?? []) {
      opts.push({ label: `${tag.name} (${cat.name})`, value: tag.id });
    }
  }
  return opts;
});

const filtered = computed(() => {
  if (!search.value) return mappings.value;
  const q = search.value.toLowerCase();
  return mappings.value.filter((m) =>
    m.keyword.includes(q) || m.tagName?.toLowerCase().includes(q),
  );
});

const groupedByTag = computed(() => {
  const groups = new Map<string, { color: string | null; icon: string | null; tagId: number; items: KeywordMapping[] }>();
  for (const m of filtered.value) {
    const key = m.tagName ?? "No tag";
    const group = groups.get(key) ?? { color: m.categoryColor, icon: m.tagIcon, tagId: m.tagId!, items: [] };
    group.items.push(m);
    groups.set(key, group);
  }
  return [...groups.entries()].sort(([a], [b]) => {
    if (a === "No tag") return 1;
    if (b === "No tag") return -1;
    return a.localeCompare(b);
  });
});

const totalCount = computed(() => mappings.value.length);

async function deleteMapping(mapping: KeywordMapping) {
  const confirmed = await alert.destructive({
    title: "Delete keyword?",
    message: `Remove "${mapping.keyword}" → ${mapping.tagName ?? "?"}`,
    description: mapping.usageCount > 1 ? `Used <b>${mapping.usageCount}</b> times to match records.` : undefined,
    confirmLabel: "Delete",
  });
  if (!confirmed) return;
  try {
    await api.del(`/records/parse/keywords/${mapping.id}`);
    mappings.value = mappings.value.filter((m) => m.id !== mapping.id);
    useToast().add({ title: "Keyword deleted", color: "success" });
  } catch {
    useToast().add({ title: "Failed to delete", color: "error" });
  }
}

async function addKeywordToTag(tagId: number) {
  if (!newKeyword.value.trim()) return;
  addingKeyword.value = true;
  try {
    await api.post("/records/parse/keywords", { keyword: newKeyword.value.trim(), tagId });
    await fetchMappings();
    newKeyword.value = "";
    addingToTag.value = null;
    useToast().add({ title: "Keyword added", color: "success" });
  } catch {
    useToast().add({ title: "Failed to add keyword", color: "error" });
  } finally {
    addingKeyword.value = false;
  }
}

async function addKeywordFromForm() {
  if (!addFormKeyword.value.trim() || !addFormTagId.value) return;
  addingKeyword.value = true;
  try {
    await api.post("/records/parse/keywords", { keyword: addFormKeyword.value.trim(), tagId: addFormTagId.value });
    await fetchMappings();
    addFormKeyword.value = "";
    addFormTagId.value = undefined;
    showAddForm.value = false;
    useToast().add({ title: "Keyword added", color: "success" });
  } catch {
    useToast().add({ title: "Failed to add keyword", color: "error" });
  } finally {
    addingKeyword.value = false;
  }
}

function startInlineAdd(tagName: string) {
  addingToTag.value = tagName;
  newKeyword.value = "";
  nextTick(() => {
    document.querySelector<HTMLInputElement>("[data-inline-add]")?.focus();
  });
}
</script>

<template>
  <UDashboardPanel>
    <template #header>
      <UDashboardNavbar title="Keywords">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
      </UDashboardNavbar>

      <UDashboardToolbar v-if="mappings.length || showAddForm">
        <template #left>
          <UInput
            v-if="mappings.length"
            v-model="search"
            icon="i-lucide-search"
            placeholder="Search keywords..."
          />
        </template>
        <template #right>
          <UButton icon="i-lucide-plus" label="Add keyword" variant="soft" @click="showAddForm = !showAddForm" />
        </template>
      </UDashboardToolbar>
    </template>

    <template #body>
      <!-- Loading -->
      <div v-if="loading" class="flex items-center justify-center mt-[25vh]">
        <UIcon name="i-lucide-loader-circle" class="size-8 text-dimmed animate-spin" />
      </div>

      <!-- Error -->
      <div v-else-if="error" class="flex flex-col items-center text-center mt-[25vh]">
        <UIcon name="i-lucide-wifi-off" class="mb-4 size-16 text-dimmed/40" />
        <h2 class="text-lg font-semibold text-highlighted">Failed to load keywords</h2>
        <UButton icon="i-lucide-refresh-cw" label="Retry" class="mt-6" @click="fetchMappings" />
      </div>

      <!-- Empty -->
      <div v-else-if="!mappings.length && !showAddForm" class="flex flex-col items-center text-center mt-[25vh]">
        <UIcon name="i-lucide-book-open" class="mb-4 size-16 text-dimmed/40" />
        <h2 class="text-lg font-semibold text-highlighted">No keywords yet</h2>
        <p class="mt-1 text-sm text-muted">Keywords are learned when you correct parsed records or add them manually.</p>
        <UButton icon="i-lucide-plus" label="Add keyword" class="mt-6" @click="showAddForm = true" />
      </div>

      <!-- Content -->
      <template v-else>
        <h3 class="text-[18px] text-muted/60 font-light leading-relaxed">
          Keywords connect what you type to the right tag. Type "rappi" and it knows you mean Delivery.
        </h3>

        <!-- Search no results -->
        <div v-if="search && !filtered.length" class="text-center py-8">
          <p class="text-sm text-muted">No keywords match "{{ search }}"</p>
        </div>

        <!-- Grid -->
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div
            v-for="([tagName, group]) in groupedByTag"
            :key="tagName"
            class="border border-default rounded-lg overflow-hidden"
          >
            <!-- Tag header -->
            <div class="flex items-center gap-2 px-3 py-2.5 bg-elevated/50 border-b border-default">
              <div
                class="flex items-center justify-center size-7 rounded-lg shrink-0"
                :style="{ backgroundColor: getColor(group.color)[100], color: getColor(group.color)[500], border: `2px solid ${getColor(group.color)[200]}` }"
              >
                <UIcon :name="group.icon || 'i-lucide-tag'" class="size-4" />
              </div>
              <span class="text-sm font-semibold text-highlighted flex-1">{{ tagName }}</span>
              <span class="text-xs text-muted">{{ group.items.length }}</span>
            </div>

            <!-- Keywords -->
            <div class="p-3 flex flex-wrap gap-2">
              <div
                v-for="mapping in group.items"
                :key="mapping.id"
                class="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-elevated text-sm hover:bg-accented transition-colors"
              >
                <span class="font-mono text-xs">{{ mapping.keyword }}</span>
                <span v-if="mapping.usageCount > 1" class="text-[10px] text-muted">{{ mapping.usageCount }}x</span>
                <button class="p-0.5 ml-1 rounded-sm bg-muted/10 hover:bg-error/15 hover:text-error transition-colors" @click="deleteMapping(mapping)">
                  <UIcon name="i-lucide-x" class="size-3.5" />
                </button>
              </div>

              <!-- Inline add -->
              <div v-if="addingToTag === tagName" class="inline-flex items-center gap-1">
                <input
                  v-model="newKeyword"
                  data-inline-add
                  class="w-24 px-2 py-1 text-xs rounded-md border border-default bg-default font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder="keyword"
                  @keydown.enter="addKeywordToTag(group.tagId)"
                  @keydown.escape="addingToTag = null"
                />
                <button class="p-1 rounded hover:bg-elevated text-muted hover:text-default" @click="addKeywordToTag(group.tagId)">
                  <UIcon name="i-lucide-check" class="size-3.5" />
                </button>
                <button class="p-1 rounded hover:bg-elevated text-muted hover:text-default" @click="addingToTag = null">
                  <UIcon name="i-lucide-x" class="size-3.5" />
                </button>
              </div>
              <button
                v-else
                class="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs text-muted hover:text-default hover:bg-elevated transition-colors border border-dashed border-default"
                @click="startInlineAdd(tagName)"
              >
                <UIcon name="i-lucide-plus" class="size-3.5" />
              </button>
            </div>
          </div>
        </div>
      </template>
    </template>
  </UDashboardPanel>

  <!-- Add keyword modal -->
  <UModal v-model:open="showAddForm" title="Add keyword">
    <template #body>
      <div class="space-y-4">
        <UFormField label="Tag" required>
          <USelectMenu v-model="addFormTagId" :items="tagOptions" value-key="value" placeholder="Select tag" class="w-full" />
        </UFormField>
        <UFormField label="Keyword" required>
          <UInput v-model="addFormKeyword" placeholder="e.g. sushi, rappi, carrefour..." class="w-full" />
        </UFormField>
        <p v-if="addFormTagId && addFormKeyword.trim()" class="text-sm text-muted">
          Typing <b class="text-highlighted">"{{ addFormKeyword.trim() }}"</b> will match to <b class="text-highlighted">{{ tagOptions.find(t => t.value === addFormTagId)?.label ?? '' }}</b>
        </p>
      </div>
    </template>
    <template #footer>
      <UButton label="Cancel" variant="ghost" color="neutral" class="ml-auto" @click="showAddForm = false" />
      <UButton label="Add keyword" icon="i-lucide-plus" :loading="addingKeyword" :disabled="!addFormKeyword.trim() || !addFormTagId" @click="addKeywordFromForm" />
    </template>
  </UModal>
</template>
