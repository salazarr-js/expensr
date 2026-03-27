<script setup lang="ts">
import { ref, computed, watch, onMounted, h, resolveComponent } from "vue";
import { useDebounceFn } from "@vueuse/core";
import { storeToRefs } from "pinia";
import { useRoute, useRouter } from "vue-router";
import type { RecordWithRelations } from "@slzr/expensr-shared";
import type { TableColumn } from "@nuxt/ui";
import { useRecordsStore, type RecordFilters } from "@/stores/records";
import { useAccountsStore } from "@/stores/accounts";
import { useCategoriesStore } from "@/stores/categories";
import { usePeopleStore } from "@/stores/people";
import { formatMoneyParts } from "@/utils/money";
import { getColor } from "@/utils/colors";
import { RecordFormModal } from "@/components/RecordFormModal";
import { QuickRecordModal } from "@/components/QuickRecordModal";
import { DateRangePicker } from "@/components/DateRangePicker";
import { useAlertDialog } from "@/composables/useAlertDialog";
import { getDefaultRange } from "@/utils/dates";

const route = useRoute();
const router = useRouter();
const recordsStore = useRecordsStore();
const accountsStore = useAccountsStore();
const categoriesStore = useCategoriesStore();
const peopleStore = usePeopleStore();
const alert = useAlertDialog();

const { records, loading, error } = storeToRefs(recordsStore);
const { accounts } = storeToRefs(accountsStore);
const { categories, tagsByCategory } = storeToRefs(categoriesStore);
const { people } = storeToRefs(peopleStore);

const showFormModal = ref(false);
const showQuickRecord = ref(false);
const selectedRecord = ref<RecordWithRelations | undefined>();

// ── Filters (synced to URL query params) ────────────────────────────

// Default to "This month" when no URL params
const defaults = getDefaultRange();
const filterDateFrom = ref<string | undefined>(
  route.query.dateFrom ? String(route.query.dateFrom) : defaults.dateFrom,
);
const filterDateTo = ref<string | undefined>(
  route.query.dateTo ? String(route.query.dateTo) : defaults.dateTo,
);
const searchQuery = ref(route.query.search ? String(route.query.search) : "");
const debouncedSearch = ref(searchQuery.value);
const searching = ref(false); // true while typing, before debounce fires
const onSearchInput = useDebounceFn((val: string) => { debouncedSearch.value = val; searching.value = false; }, 500);
watch(searchQuery, (val) => { searching.value = val !== debouncedSearch.value; onSearchInput(val); });

const personFilterOptions = computed(() => [
  { label: "All people", value: "all", color: null as string | null },
  ...people.value.map((p) => ({ label: p.name, value: String(p.id), color: p.color })),
]);

const selectedPerson = ref(route.query.person ? String(route.query.person) : "all");

const filterPersonId = computed(() => {
  const val = selectedPerson.value;
  if (val === "all") return undefined;
  return Number(val);
});

// Category/tag cascading menu — categories at top level, tags expand as submenus
const categoryTagItems = computed(() => {
  const allItem = {
    label: "All categories",
    icon: "i-lucide-layers",
    onSelect: () => { selectedCategoryTag.value = "all"; },
  };
  const catItems = categories.value.map((cat) => {
    const catTags = tagsByCategory.value[cat.id] ?? [];
    // Category with tag children — clicking category filters all its tags
    return {
      label: cat.name,
      icon: cat.icon || "i-lucide-tag",
      onSelect: () => { selectedCategoryTag.value = `cat:${cat.id}`; },
      children: catTags.length
        ? catTags.map((tag) => ({
            label: tag.name,
            icon: tag.icon || "i-lucide-hash",
            onSelect: () => { selectedCategoryTag.value = `tag:${tag.id}`; },
          }))
        : undefined,
    };
  });
  return [[allItem], catItems];
});

// Init from URL: ?categoryId=5 → "cat:5", ?tagId=42 → "tag:42"
const selectedCategoryTag = ref(
  route.query.tagId ? `tag:${route.query.tagId}`
    : route.query.categoryId ? `cat:${route.query.categoryId}`
      : "all",
);

const filterCategoryId = computed(() => {
  const val = selectedCategoryTag.value;
  return val.startsWith("cat:") ? Number(val.slice(4)) : undefined;
});

const filterTagId = computed(() => {
  const val = selectedCategoryTag.value;
  return val.startsWith("tag:") ? Number(val.slice(4)) : undefined;
});

/** Display label for the category/tag filter button. */
const categoryTagLabel = computed(() => {
  const val = selectedCategoryTag.value;
  if (val === "all") return "All categories";
  if (val.startsWith("cat:")) {
    const cat = categories.value.find((c) => c.id === Number(val.slice(4)));
    return cat?.name ?? "Category";
  }
  if (val.startsWith("tag:")) {
    const tagId = Number(val.slice(4));
    for (const cat of categories.value) {
      const tag = (tagsByCategory.value[cat.id] ?? []).find((t) => t.id === tagId);
      if (tag) return tag.name;
    }
    return "Tag";
  }
  return "All categories";
});

const accountFilterOptions = computed(() => [
  { label: "All", value: "all", icon: null as string | null, color: null as string | null },
  ...accounts.value.map((a) => ({ label: a.name, value: String(a.id), icon: a.icon, color: a.color })),
]);

const selectedAccounts = ref<string[]>(
  route.query.account ? String(route.query.account).split(",") : ["all"],
);

/** Handles "All" toggle logic: selecting "All" clears others, selecting a specific account removes "All". */
function onAccountFilterUpdate(value: string[]) {
  const hadAll = selectedAccounts.value.includes("all");
  const hasAll = value.includes("all");

  if (hasAll && !hadAll) {
    selectedAccounts.value = ["all"];
  } else if (hadAll && value.length > 1) {
    selectedAccounts.value = value.filter((v) => v !== "all");
  } else if (!hasAll && value.length === 0) {
    selectedAccounts.value = ["all"];
  } else {
    selectedAccounts.value = value;
  }

  // All individual accounts selected — collapse to "All"
  const idsOnly = selectedAccounts.value.filter((v) => v !== "all");
  if (idsOnly.length === accounts.value.length) {
    selectedAccounts.value = ["all"];
  }
}

const accountFilterLabel = computed(() => {
  if (selectedAccounts.value.includes("all")) return "All accounts";
  const selected = selectedAccounts.value
    .map((id) => accounts.value.find((a) => a.id === Number(id)))
    .filter(Boolean);
  if (selected.length === 1) return selected[0]!.name;
  return `${selected.length} accounts`;
});

const currentFilters = computed<RecordFilters>(() => {
  const idsOnly = selectedAccounts.value.filter((v) => v !== "all").map(Number);
  return {
    accountIds: idsOnly.length ? idsOnly : undefined,
    personId: filterPersonId.value,
    dateFrom: filterDateFrom.value || undefined,
    dateTo: filterDateTo.value || undefined,
    search: debouncedSearch.value || undefined,
    categoryId: filterCategoryId.value,
    tagId: filterTagId.value,
  };
});

/** Whether any non-default filter is active (account, person, search, or non-default date). */
const hasActiveFilters = computed(() => {
  const f = currentFilters.value;
  const d = defaults;
  return !!(f.accountIds?.length || f.personId || f.search || f.categoryId || f.tagId
    || (f.dateFrom !== d.dateFrom) || (f.dateTo !== d.dateTo));
});

/** Reset all filters to defaults. */
function clearFilters() {
  selectedAccounts.value = ["all"];
  selectedPerson.value = "all";
  searchQuery.value = "";
  debouncedSearch.value = "";
  selectedCategoryTag.value = "all";
  filterDateFrom.value = defaults.dateFrom;
  filterDateTo.value = defaults.dateTo;
}

/** Sync filters to URL and re-fetch. */
watch(currentFilters, (filters) => {
  const query: Record<string, string> = {};
  if (filters.accountIds?.length) query.account = filters.accountIds.join(",");
  if (filters.personId) query.person = String(filters.personId);
  if (filters.dateFrom) query.dateFrom = filters.dateFrom;
  if (filters.dateTo) query.dateTo = filters.dateTo;
  if (filters.search) query.search = filters.search;
  if (filters.categoryId) query.categoryId = String(filters.categoryId);
  if (filters.tagId) query.tagId = String(filters.tagId);
  router.replace({ query });
  recordsStore.fetchRecords(filters);
});

// ── Table columns ───────────────────────────────────────────────────

const columns: TableColumn<RecordWithRelations>[] = [
  { id: "reorder", header: "", size: 60, enableSorting: false },
  { accessorKey: "date", header: "Date", enableSorting: false },
  { accessorKey: "accountName", header: "Account", enableSorting: false },
  { id: "category", accessorKey: "categoryName", header: "Category", enableSorting: false },
  { id: "tag", accessorKey: "tagName", header: "Tag", enableSorting: false },
  { id: "people", header: "People", enableSorting: false, size: 100 },
  { accessorKey: "note", header: "Note", enableSorting: false },
  {
    accessorKey: "amount",
    header: ({ column }) => h(resolveComponent("UButton") as any, {
      color: "neutral",
      variant: "ghost",
      label: "Amount",
      icon: column.getIsSorted()
        ? (column.getIsSorted() === "asc" ? "i-lucide-arrow-up-narrow-wide" : "i-lucide-arrow-down-wide-narrow")
        : "i-lucide-arrow-up-down",
      class: "-mx-2.5",
      onClick: () => column.toggleSorting(column.getIsSorted() === "asc"),
    }),
    size: 150,
    meta: { class: { th: "text-right", td: "text-right" } },
  },
];

const sorting = ref<{ id: string; desc: boolean }[]>([]);

// Pin amount column to the right so it's always visible on horizontal scroll
const columnPinning = ref({ right: ["amount"] });

/** Row background: green for settlements, amber for needs review. */
const tableMeta = {
  class: {
    tr: (row: { original: RecordWithRelations }) => {
      if (row.original.type === "settlement") return "bg-green-50 dark:bg-green-950/20";
      if (row.original.needsReview) return "bg-amber-50 dark:bg-amber-950/20";
      return "";
    },
  },
};

// ── Actions ─────────────────────────────────────────────────────────

function openCreate() {
  selectedRecord.value = undefined;
  showFormModal.value = true;
}

function openEdit(record: RecordWithRelations) {
  selectedRecord.value = record;
  showFormModal.value = true;
}

function onSelectRow(_e: Event, row: { original: RecordWithRelations }) {
  openEdit(row.original);
}

async function deleteRecord(record: RecordWithRelations) {
  const confirmed = await alert.destructive({
    title: "Delete this record?",
    message: `${record.amount} on ${record.date}`,
    onConfirm: () => recordsStore.deleteRecord(record.id),
  });
  if (confirmed) {
    showFormModal.value = false;
    useToast().add({ title: "Record deleted", color: "success" });
  }
}

/** Move a record up (earlier in the list = swap with the previous record). */
async function moveUp(index: number) {
  const record = records.value[index];
  const prev = records.value[index - 1];
  if (!record || !prev) return;
  await recordsStore.reorderRecord(record.id, { beforeId: prev.id });
}

/** Move a record down (later in the list = swap with the next record). */
async function moveDown(index: number) {
  const record = records.value[index];
  const next = records.value[index + 1];
  if (!record || !next) return;
  await recordsStore.reorderRecord(record.id, { afterId: next.id });
}

function getPersonColor(personId: number): string | null {
  return people.value.find((p) => p.id === personId)?.color ?? null;
}

function formatDate(date: string): string {
  const dateOnly = date.split("T")[0];
  return new Date(dateOnly + "T00:00:00").toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

onMounted(() => {
  accountsStore.fetchAccounts();
  categoriesStore.fetchAll();
  peopleStore.fetchPeople();
  recordsStore.fetchRecords(currentFilters.value);
});
</script>

<template>
  <UDashboardPanel>
    <template #header>
      <UDashboardNavbar title="Records">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>

        <template #right>
          <UButton icon="i-lucide-plus" label="New record" variant="outline" @click="openCreate" />
          <UTooltip text="Quick record (AI)">
            <UButton icon="i-lucide-sparkles" @click="showQuickRecord = true" />
          </UTooltip>
        </template>
      </UDashboardNavbar>

      <UDashboardToolbar>
        <template #left>
          <USelectMenu
            :model-value="selectedAccounts"
            :items="accountFilterOptions"
            value-key="value"
            multiple
            icon="i-lucide-wallet"
            placeholder="All accounts"
            color="neutral"
            variant="outline"
            :ui="{ content: 'min-w-fit' }"
            @update:model-value="onAccountFilterUpdate"
          >
            <template #default>
              <span class="truncate hidden sm:inline">{{ accountFilterLabel }}</span><span class="sm:hidden">&#8203;</span>
            </template>
            <template #item-leading="{ item }">
              <div
                v-if="item.icon"
                class="flex items-center justify-center size-5 rounded shrink-0"
                :style="{ backgroundColor: getColor(item.color)[100], color: getColor(item.color)[500] }"
              >
                <UIcon :name="item.icon" class="size-3" />
              </div>
            </template>
          </USelectMenu>

          <DateRangePicker v-model:date-from="filterDateFrom" v-model:date-to="filterDateTo" />

          <USelectMenu
            v-model="selectedPerson"
            :items="personFilterOptions"
            value-key="value"
            icon="i-lucide-users"
            color="neutral"
            variant="outline"
            :ui="{ content: 'min-w-fit' }"
          >
            <template #default>
              <span class="truncate hidden sm:inline">{{ personFilterOptions.find(p => p.value === selectedPerson)?.label ?? 'All people' }}</span><span class="sm:hidden">&#8203;</span>
            </template>
            <template #item-leading="{ item }">
              <div
                v-if="item.color"
                class="flex items-center justify-center size-5 rounded-full shrink-0 text-[10px] font-semibold"
                :style="{ backgroundColor: getColor(item.color)[100], color: getColor(item.color)[500] }"
              >
                {{ item.label.charAt(0) }}
              </div>
            </template>
          </USelectMenu>

          <UDropdownMenu :items="categoryTagItems" :content="{ align: 'start' }" :ui="{ content: 'w-48' }">
            <UButton color="neutral" variant="outline" icon="i-lucide-tag" trailing-icon="i-lucide-chevron-down">
              <span class="hidden sm:inline truncate">{{ categoryTagLabel }}</span>
            </UButton>
          </UDropdownMenu>

          <UInput
            v-model="searchQuery"
            icon="i-lucide-search"
            placeholder="Search..."
            class="w-full"
          />
        </template>
      </UDashboardToolbar>
    </template>

    <template #body>
      <!-- Loading (first load only — subsequent loads use table loading indicator) -->
      <div v-if="loading && !records.length && !hasActiveFilters" class="flex items-center justify-center mt-[25vh]">
        <UIcon name="i-lucide-loader-circle" class="size-8 text-dimmed animate-spin" />
      </div>

      <!-- Error state -->
      <div v-else-if="error && !records.length" class="flex flex-col items-center text-center mt-[25vh]">
        <UIcon name="i-lucide-wifi-off" class="mb-4 size-16 text-dimmed/40" />
        <h2 class="text-lg font-semibold text-highlighted">Failed to load records</h2>
        <p class="mt-1 text-sm text-muted">Something went wrong. Check your connection and try again.</p>
        <UButton icon="i-lucide-refresh-cw" label="Retry" class="mt-6" :loading="loading" @click="() => recordsStore.fetchRecords(currentFilters)" />
      </div>

      <!-- No results for active filters -->
      <div v-else-if="!records.length && hasActiveFilters" class="flex flex-col items-center text-center mt-[25vh]">
        <UIcon name="i-lucide-search-x" class="mb-4 size-16 text-dimmed/40" />
        <h2 class="text-lg font-semibold text-highlighted">No records found</h2>
        <p class="mt-1 text-sm text-muted">Try adjusting your filters or search terms.</p>
        <UButton icon="i-lucide-x" label="Clear filters" variant="outline" class="mt-6" @click="clearFilters" />
      </div>

      <!-- Empty state (no records at all) -->
      <div v-else-if="!records.length" class="flex flex-col items-center text-center mt-[25vh]">
        <UIcon name="i-lucide-receipt" class="mb-4 size-16 text-dimmed/40" />
        <h2 class="text-lg font-semibold text-highlighted">No records yet</h2>
        <p class="mt-1 text-sm text-muted">Start by adding your first expense or income record.</p>
        <UButton icon="i-lucide-plus" label="New record" class="mt-6" @click="openCreate" />
      </div>

      <!-- Records: card list on mobile, table on md+ -->
      <template v-else>
        <!-- Mobile card list -->
        <div class="md:hidden divide-y divide-zinc-200 dark:divide-zinc-800">
          <div
            v-for="(record, index) in records"
            :key="record.id"
            class="flex items-center gap-3 px-4 py-3 cursor-pointer active:bg-default-50"
            :class="record.type === 'settlement' ? 'bg-green-50 dark:bg-green-950/20' : record.needsReview ? 'bg-amber-50 dark:bg-amber-950/20' : ''"
            @click="openEdit(record)"
          >
            <!-- Category icon (green for settlements) -->
            <div
              class="flex items-center justify-center size-9 rounded-lg shrink-0"
              :style="record.type === 'settlement' ? {} : {
                backgroundColor: getColor(record.categoryColor)[100],
                color: getColor(record.categoryColor)[500],
              }"
              :class="record.type === 'settlement' ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400' : ''"
            >
              <UIcon :name="record.type === 'settlement' ? 'i-lucide-hand-coins' : (record.categoryIcon || 'i-lucide-receipt')" class="size-4" />
            </div>

            <!-- Info -->
            <div class="min-w-0 flex-1">
              <p class="text-sm font-medium text-highlighted truncate">
                <UIcon v-if="record.needsReview" name="i-lucide-circle-alert" class="size-3.5 text-amber-500 align-text-bottom mr-0.5" />
                {{ record.type === 'settlement' ? 'Payment' : (record.tagName || record.categoryName || record.note || 'Record') }}
              </p>
              <div class="flex items-center gap-1 text-xs text-muted truncate">
                <span>{{ formatDate(record.date) }} · {{ record.accountName }}</span>
                <div v-if="record.people?.length" class="flex items-center -space-x-1 ml-1">
                  <div
                    v-for="person in record.people"
                    :key="person.id"
                    class="flex items-center justify-center size-4 rounded-full text-[8px] font-semibold ring-1 ring-white dark:ring-zinc-900"
                    :style="{ backgroundColor: getColor(getPersonColor(person.id))[100], color: getColor(getPersonColor(person.id))[500] }"
                  >
                    {{ person.name.charAt(0) }}
                  </div>
                </div>
              </div>
            </div>

            <!-- Amount -->
            <div class="text-right shrink-0 font-mono">
              <p class="text-sm font-semibold" :class="record.type === 'income' || record.type === 'settlement' ? 'text-green-600 dark:text-green-400' : 'text-highlighted'">
                {{ record.type === 'expense' ? '-' : '+' }}{{ formatMoneyParts(record.amount).integer }}<span class="text-xs text-muted">{{ formatMoneyParts(record.amount).decimal }}</span>
              </p>
              <p class="text-[11px] text-muted">{{ record.accountCurrency }}</p>
            </div>
          </div>
        </div>

        <!-- Desktop table -->
        <UTable
          v-model:sorting="sorting"
          v-model:column-pinning="columnPinning"
          :columns="columns"
          :data="records"
          :meta="tableMeta"
          :loading="loading || searching"
          sticky
          class="w-full overflow-x-auto hidden md:block"
          @select="onSelectRow"
        >
          <template #reorder-cell="{ row }">
            <div class="flex items-center gap-0.5" @click.stop>
              <UButton
                icon="i-lucide-chevron-up"
                variant="ghost"
                color="neutral"
                size="xs"
                :disabled="row.index === 0"
                @click="moveUp(row.index)"
              />
              <UButton
                icon="i-lucide-chevron-down"
                variant="ghost"
                color="neutral"
                size="xs"
                :disabled="row.index === records.length - 1"
                @click="moveDown(row.index)"
              />
            </div>
          </template>

          <template #date-cell="{ row }">
            {{ formatDate(row.original.date) }}
          </template>

          <template #category-cell="{ row }">
            <!-- Settlement: green payment badge -->
            <div v-if="row.original.type === 'settlement'" class="flex items-center gap-1.5">
              <div class="flex items-center justify-center size-5 rounded shrink-0 bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400">
                <UIcon name="i-lucide-hand-coins" class="size-3" />
              </div>
              <span class="text-green-600 dark:text-green-400">Payment</span>
            </div>
            <div v-else-if="row.original.categoryName" class="flex items-center gap-1.5">
              <div
                class="flex items-center justify-center size-5 rounded shrink-0"
                :style="{
                  backgroundColor: getColor(row.original.categoryColor)[100],
                  color: getColor(row.original.categoryColor)[500],
                }"
              >
                <UIcon :name="row.original.categoryIcon || 'i-lucide-tag'" class="size-3" />
              </div>
              <span>{{ row.original.categoryName }}</span>
            </div>
            <span v-else class="text-muted">—</span>
          </template>

          <template #tag-cell="{ row }">
            <div v-if="row.original.tagName" class="flex items-center gap-1.5">
              <UIcon name="i-lucide-hash" class="size-3.5 text-muted shrink-0" />
              <span>{{ row.original.tagName }}</span>
            </div>
            <span v-else class="text-muted">—</span>
          </template>

          <template #people-cell="{ row }">
            <div v-if="row.original.people?.length" class="flex items-center -space-x-1">
              <div
                v-for="person in row.original.people"
                :key="person.id"
                class="flex items-center justify-center size-6 rounded-full text-[10px] font-semibold ring-2 ring-white dark:ring-zinc-900"
                :style="{ backgroundColor: getColor(getPersonColor(person.id))[100], color: getColor(getPersonColor(person.id))[500] }"
                :title="person.name"
              >
                {{ person.name.charAt(0) }}
              </div>
            </div>
            <span v-else class="text-muted">—</span>
          </template>

          <template #note-cell="{ row }">
            <div class="flex items-center gap-1">
              <UIcon v-if="row.original.needsReview" name="i-lucide-circle-alert" class="size-3.5 text-amber-500 shrink-0" />
              <span class="truncate max-w-48 inline-block">{{ row.original.note ?? "—" }}</span>
            </div>
          </template>

          <template #amount-cell="{ row }">
            <div class="text-right font-mono">
              <span :class="row.original.type === 'income' || row.original.type === 'settlement' ? 'text-green-600 dark:text-green-400' : ''">
                {{ row.original.type === 'expense' ? '-' : '+' }}{{ formatMoneyParts(row.original.amount).integer }}<span class="text-muted">{{ formatMoneyParts(row.original.amount).decimal }}</span>
              </span>
              <span class="ml-1 text-xs text-muted">{{ row.original.accountCurrency }}</span>
            </div>
          </template>
        </UTable>
      </template>
    </template>
  </UDashboardPanel>

  <RecordFormModal v-model:open="showFormModal" :record="selectedRecord" @delete="deleteRecord" />
  <QuickRecordModal v-model:open="showQuickRecord" />
</template>
