<script setup lang="ts">
import { ref, computed, watch, onMounted, h } from "vue";
import { storeToRefs } from "pinia";
import { useRoute, useRouter } from "vue-router";
import type { RecordWithRelations } from "@slzr/expensr-shared";
import type { TableColumn } from "@nuxt/ui";
import { useRecordsStore, type RecordFilters } from "@/stores/records";
import { useAccountsStore } from "@/stores/accounts";
import { useCategoriesStore } from "@/stores/categories";
import { formatMoneyParts } from "@/utils/money";
import { getColor } from "@/utils/colors";
import { RecordFormModal } from "@/components/RecordFormModal";
import { useAlertDialog } from "@/composables/useAlertDialog";

const route = useRoute();
const router = useRouter();
const recordsStore = useRecordsStore();
const accountsStore = useAccountsStore();
const categoriesStore = useCategoriesStore();
const alert = useAlertDialog();

const { records, loading, error } = storeToRefs(recordsStore);
const { accounts } = storeToRefs(accountsStore);

const showFormModal = ref(false);
const selectedRecord = ref<RecordWithRelations | undefined>();

// ── Filters (synced to URL query params) ────────────────────────────

const filterDateFrom = ref(route.query.dateFrom as string ?? "");
const filterDateTo = ref(route.query.dateTo as string ?? "");

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
    dateFrom: filterDateFrom.value || undefined,
    dateTo: filterDateTo.value || undefined,
  };
});

/** Sync filters to URL and re-fetch. */
watch(currentFilters, (filters) => {
  const query: Record<string, string> = {};
  if (filters.accountIds?.length) query.account = filters.accountIds.join(",");
  if (filters.dateFrom) query.dateFrom = filters.dateFrom;
  if (filters.dateTo) query.dateTo = filters.dateTo;
  router.replace({ query });
  recordsStore.fetchRecords(filters);
});

// ── Table columns ───────────────────────────────────────────────────

const columns: TableColumn<RecordWithRelations>[] = [
  { id: "reorder", header: "", size: 60, enableSorting: false },
  { accessorKey: "date", header: "Date", enableSorting: false },
  { accessorKey: "accountName", header: "Account", enableSorting: false },
  { accessorKey: "categoryName", header: "Category", enableSorting: false },
  { accessorKey: "tagName", header: "Tag", enableSorting: false },
  { accessorKey: "note", header: "Note", enableSorting: false },
  { accessorKey: "amount", header: "Amount", enableSorting: false, meta: { class: { th: "text-right", td: "text-right" } } },
];

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
          <UButton icon="i-lucide-plus" label="New record" @click="openCreate" />
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
            class="w-full sm:w-56"
            @update:model-value="onAccountFilterUpdate"
          >
            <template #default>
              <span class="truncate">{{ accountFilterLabel }}</span>
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

          <UInput
            v-model="filterDateFrom"
            type="date"
            placeholder="From"
            class="w-full sm:w-40"
          />

          <UInput
            v-model="filterDateTo"
            type="date"
            placeholder="To"
            class="w-full sm:w-40"
          />
        </template>
      </UDashboardToolbar>
    </template>

    <template #body>
      <!-- Loading -->
      <div v-if="loading && !records.length" class="flex items-center justify-center mt-[25vh]">
        <UIcon name="i-lucide-loader-circle" class="size-8 text-dimmed animate-spin" />
      </div>

      <!-- Error state -->
      <div v-else-if="error && !records.length" class="flex flex-col items-center text-center mt-[25vh]">
        <UIcon name="i-lucide-wifi-off" class="mb-4 size-16 text-dimmed/40" />
        <h2 class="text-lg font-semibold text-highlighted">Failed to load records</h2>
        <p class="mt-1 text-sm text-muted">Something went wrong. Check your connection and try again.</p>
        <UButton icon="i-lucide-refresh-cw" label="Retry" class="mt-6" :loading="loading" @click="() => recordsStore.fetchRecords(currentFilters)" />
      </div>

      <!-- Empty state -->
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
            @click="openEdit(record)"
          >
            <!-- Category icon -->
            <div
              class="flex items-center justify-center size-9 rounded-lg shrink-0"
              :style="{
                backgroundColor: getColor(record.categoryColor)[100],
                color: getColor(record.categoryColor)[500],
              }"
            >
              <UIcon :name="record.categoryIcon || 'i-lucide-receipt'" class="size-4" />
            </div>

            <!-- Info -->
            <div class="min-w-0 flex-1">
              <p class="text-sm font-medium text-highlighted truncate">
                {{ record.tagName || record.categoryName || record.note || 'Record' }}
              </p>
              <p class="text-xs text-muted truncate">
                {{ formatDate(record.date) }} · {{ record.accountName }}
              </p>
            </div>

            <!-- Amount -->
            <div class="text-right shrink-0 font-mono">
              <p class="text-sm font-semibold" :class="record.type === 'income' ? 'text-green-600 dark:text-green-400' : 'text-highlighted'">
                {{ record.type === 'income' ? '+' : '-' }}{{ formatMoneyParts(record.amount).integer }}<span class="text-xs text-muted">{{ formatMoneyParts(record.amount).decimal }}</span>
              </p>
              <p class="text-[11px] text-muted">{{ record.accountCurrency }}</p>
            </div>
          </div>
        </div>

        <!-- Desktop table -->
        <UTable
          :columns="columns"
          :data="records"
          class="w-full overflow-visible! hidden md:table"
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

          <template #category-name-cell="{ row }">
            <div v-if="row.original.categoryName" class="flex items-center gap-1.5">
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

          <template #tag-name-cell="{ row }">
            {{ row.original.tagName ?? "—" }}
          </template>

          <template #note-cell="{ row }">
            <span class="truncate max-w-48 inline-block">{{ row.original.note ?? "—" }}</span>
          </template>

          <template #amount-cell="{ row }">
            <div class="text-right font-mono">
              <span :class="row.original.type === 'income' ? 'text-green-600 dark:text-green-400' : ''">
                {{ row.original.type === 'income' ? '+' : '-' }}{{ formatMoneyParts(row.original.amount).integer }}<span class="text-muted">{{ formatMoneyParts(row.original.amount).decimal }}</span>
              </span>
              <span class="ml-1 text-xs text-muted">{{ row.original.accountCurrency }}</span>
            </div>
          </template>
        </UTable>
      </template>
    </template>
  </UDashboardPanel>

  <RecordFormModal v-model:open="showFormModal" :record="selectedRecord" @delete="deleteRecord" />
</template>
