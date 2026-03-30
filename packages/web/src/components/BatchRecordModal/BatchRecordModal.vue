<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { useDebounceFn, useLocalStorage } from "@vueuse/core";
import { storeToRefs } from "pinia";
import type { DateValue } from "@internationalized/date";
import type { Tag, CreateRecord, ParsedRecord } from "@slzr/expensr-shared";
import { useAccountsStore } from "@/stores/accounts";
import { useCategoriesStore } from "@/stores/categories";
import { useRecordsStore } from "@/stores/records";
import { useAlertDialog } from "@/composables/useAlertDialog";
import { useApi } from "@/composables/useApi";
import { getColor } from "@/utils/colors";
import { toCalendarDate, toISODate } from "@/utils/dates";

const open = defineModel<boolean>("open", { required: true });

const accountsStore = useAccountsStore();
const categoriesStore = useCategoriesStore();
const recordsStore = useRecordsStore();
const alert = useAlertDialog();
const api = useApi();

const { accounts } = storeToRefs(accountsStore);
const { categories, tagsByCategory } = storeToRefs(categoriesStore);

const saving = ref(false);
const parsing = ref(false); // true when running parse API on unmatched rows before save

// Keyword dictionary for client-side fallback matching
const keywordMappings = ref<{ keyword: string; tagId: number | null }[]>([]);
async function fetchKeywordMappings() {
  try { keywordMappings.value = await api.get("/records/parse/keywords"); }
  catch { keywordMappings.value = []; }
}

const todayISO = () => new Date().toISOString().slice(0, 10);

// ── LocalStorage persistence ────────────────────────────────────────

interface BatchRow {
  id: number;
  note: string;
  tagId: number | undefined;
  tagAutoMatched: boolean;
  amount: number | undefined;
}

interface DateGroup {
  date: string;
  rows: BatchRow[];
}

interface BatchState {
  accountId: number;
  dateGroups: DateGroup[];
  nextRowId: number;
}

const stored = useLocalStorage<BatchState>("expensr-batch-draft", {
  accountId: 0,
  dateGroups: [{ date: todayISO(), rows: [mkRow(1), mkRow(2), mkRow(3)] }],
  nextRowId: 4,
});

function mkRow(id: number): BatchRow {
  return { id, note: "", tagId: undefined, tagAutoMatched: false, amount: undefined };
}

function newRow(): BatchRow {
  const row = mkRow(stored.value.nextRowId);
  stored.value.nextRowId++;
  return row;
}

// Bind to stored state
const selectedAccountId = computed({
  get: () => stored.value.accountId,
  set: (v) => { stored.value.accountId = v; },
});
const dateGroups = computed({
  get: () => stored.value.dateGroups,
  set: (v) => { stored.value.dateGroups = v; },
});

// Fetch data when modal opens, restore account if needed
watch(open, (isOpen) => {
  if (!isOpen) return;
  accountsStore.fetchAccountsByUsage();
  categoriesStore.fetchAll();
  fetchKeywordMappings();
  if (!selectedAccountId.value && accounts.value.length) {
    selectedAccountId.value = accounts.value[0]!.id;
  }
});

watch(accounts, (accs) => {
  if (!selectedAccountId.value && accs.length) selectedAccountId.value = accs[0]!.id;
}, { immediate: true });

/** Reset the entire batch — confirm if there are filled rows. */
async function resetBatch() {
  const count = filledRows.value.length;
  if (count > 0) {
    const confirmed = await alert.destructive({
      title: "Clear all records?",
      message: `This will discard ${count} record${count > 1 ? "s" : ""} you've entered.`,
      confirmLabel: "Clear all",
    });
    if (!confirmed) return;
  }
  clearDraft();
}

/** Clear the draft after successful save. */
function clearDraft() {
  stored.value = {
    accountId: selectedAccountId.value,
    dateGroups: [{ date: todayISO(), rows: [newRow(), newRow(), newRow()] }],
    nextRowId: stored.value.nextRowId,
  };
}

// ── Global account ──────────────────────────────────────────────────

const accountOptions = computed(() =>
  accounts.value.map((a) => ({
    label: `${a.name} (${a.currency})`,
    value: a.id,
    icon: a.icon || "i-lucide-wallet",
    color: a.color as string | null,
  })),
);

// ── Tags ────────────────────────────────────────────────────────────

const INCOME_CATEGORY = "Income";

const allTags = computed(() => {
  const result: (Tag & { categoryName: string; categoryId: number })[] = [];
  for (const cat of categories.value) {
    for (const tag of tagsByCategory.value[cat.id] ?? []) {
      result.push({ ...tag, categoryName: cat.name, categoryId: cat.id });
    }
  }
  return result;
});

/** O(1) tag lookup by ID — avoids linear scans in templates. */
const tagMap = computed(() => new Map(allTags.value.map((t) => [t.id, t])));

/** Tag options for select — same style as RecordFormModal. */
const tagOptions = computed(() => {
  // Build a color map from categories
  const catColorMap = new Map(categories.value.map((c) => [c.id, c.color]));
  return [
    { label: "None", value: 0, icon: "i-lucide-x", color: null as string | null, suffix: "" },
    ...allTags.value.map((t) => ({
      label: t.name,
      value: t.id,
      icon: t.icon || "i-lucide-hash",
      color: catColorMap.get(t.categoryId) as string | null,
      suffix: t.categoryName,
    })),
  ];
});

function tagLabel(tagId: number | undefined): string {
  if (!tagId) return "";
  return tagMap.value.get(tagId)?.name ?? "";
}

/** Client-side tag matching: tag name (exact → partial) → keyword dictionary. */
function matchTagFromNote(note: string): number | undefined {
  const keywords = note.toLowerCase().split(/\s+/).filter((w) => w.length >= 3);
  if (!keywords.length) return undefined;
  // 1. Exact tag name match
  for (const kw of keywords) {
    const exact = allTags.value.find((t) => t.name.toLowerCase() === kw);
    if (exact) return exact.id;
  }
  // 2. Partial tag name match
  for (const kw of keywords) {
    const partial = allTags.value.find((t) =>
      t.name.toLowerCase().includes(kw) || kw.includes(t.name.toLowerCase()),
    );
    if (partial) return partial.id;
  }
  // 3. Keyword dictionary fallback (learned from parse feedback)
  if (keywordMappings.value.length) {
    for (const kw of keywords) {
      const mapped = keywordMappings.value.find((m) => m.keyword === kw);
      if (mapped?.tagId) return mapped.tagId;
    }
  }
  return undefined;
}

// ── Row / group operations ──────────────────────────────────────────

function addDateGroup() {
  const lastDate = dateGroups.value[dateGroups.value.length - 1]?.date ?? todayISO();
  const prev = new Date(lastDate);
  prev.setDate(prev.getDate() - 1);
  dateGroups.value.push({ date: prev.toISOString().slice(0, 10), rows: [newRow(), newRow(), newRow()] });
}

function onDateChange(gi: number, val: DateValue | undefined) {
  if (val) dateGroups.value[gi]!.date = toISODate(val);
}

function addRow(gi: number) { dateGroups.value[gi]!.rows.push(newRow()); }

function removeRow(gi: number, ri: number) { dateGroups.value[gi]!.rows.splice(ri, 1); }

/** Count filled rows in a date group. */
function filledInGroup(gi: number): number {
  return dateGroups.value[gi]!.rows.filter((r) => (r.amount && r.amount > 0) || r.note).length;
}

/** Remove date group — confirm if it has filled rows. */
async function confirmRemoveDateGroup(gi: number) {
  const filled = filledInGroup(gi);
  if (filled > 0) {
    const confirmed = await alert.destructive({
      title: "Delete date group?",
      message: `This will remove ${filled} record${filled > 1 ? "s" : ""} for ${formatGroupDate(dateGroups.value[gi]!.date)}.`,
      confirmLabel: `Delete ${filled} record${filled > 1 ? "s" : ""}`,
    });
    if (!confirmed) return;
  }
  dateGroups.value.splice(gi, 1);
}

function moveRow(gi: number, ri: number, dir: -1 | 1) {
  const rows = dateGroups.value[gi]!.rows;
  const target = ri + dir;
  if (target < 0 || target >= rows.length) return;
  [rows[ri], rows[target]] = [rows[target]!, rows[ri]!];
}

// Debounced note → tag auto-match
const debouncedMatch = useDebounceFn((row: BatchRow) => {
  if (row.tagId && !row.tagAutoMatched) return;
  const matched = matchTagFromNote(row.note);
  if (matched) { row.tagId = matched; row.tagAutoMatched = true; }
  else if (row.tagAutoMatched) { row.tagId = undefined; row.tagAutoMatched = false; }
}, 400);

function onNoteInput(row: BatchRow) { debouncedMatch(row); }

// ── Arrow key navigation ────────────────────────────────────────────

function flatRowIndex(gi: number, ri: number): number {
  let idx = 0;
  for (let g = 0; g < gi; g++) idx += dateGroups.value[g]!.rows.length;
  return idx + ri;
}

function onCellKeydown(e: KeyboardEvent) {
  const target = e.target as HTMLElement;
  const input = target.closest("[data-row]") as HTMLElement | null;
  if (!input) return;
  const row = Number(input.dataset.row);
  const col = Number(input.dataset.col);
  let nextRow = row;
  let nextCol = col;
  if (e.key === "ArrowUp") { nextRow = row - 1; e.preventDefault(); }
  else if (e.key === "ArrowDown") { nextRow = row + 1; e.preventDefault(); }
  else if (e.key === "ArrowLeft" && target instanceof HTMLInputElement && target.selectionStart === 0) { nextCol = col - 1; e.preventDefault(); }
  else if (e.key === "ArrowRight" && target instanceof HTMLInputElement && target.selectionStart === target.value.length) { nextCol = col + 1; e.preventDefault(); }
  else return;
  const next = document.querySelector(`[data-row="${nextRow}"][data-col="${nextCol}"] input`) as HTMLElement | null;
  next?.focus();
}

// ── Summary + save ──────────────────────────────────────────────────

const filledRows = computed(() => {
  const result: { note: string; tagId: number | undefined; amount: number; date: string }[] = [];
  for (const g of dateGroups.value) {
    for (const r of g.rows) {
      if (r.amount && r.amount > 0 && r.note) result.push({ note: r.note, tagId: r.tagId, amount: r.amount, date: g.date });
    }
  }
  return result;
});

function buildPayloads(): CreateRecord[] {
  return filledRows.value.map((r) => {
    const tag = r.tagId ? tagMap.value.get(r.tagId) : undefined;
    const isIncome = tag?.categoryName === INCOME_CATEGORY;
    return {
      type: isIncome ? "income" as const : "expense" as const,
      amount: r.amount,
      date: r.date,
      accountId: selectedAccountId.value,
      tagId: r.tagId ?? null,
      categoryId: tag?.categoryId ?? null,
      note: r.note,
      needsReview: !r.tagId || undefined, // no tag resolved → needs review
    };
  });
}

/** Run parse API on rows missing a tag to fill gaps with AI/keyword matching. */
async function parseUnmatchedRows() {
  const unmatched: BatchRow[] = [];
  for (const g of dateGroups.value) {
    for (const r of g.rows) {
      if (r.note && !r.tagId) unmatched.push(r);
    }
  }
  if (!unmatched.length) return;

  parsing.value = true;
  try {
    // Parse sequentially to avoid overwhelming the API
    for (const row of unmatched) {
      try {
        const result = await api.post<ParsedRecord>("/records/parse", { text: `${row.note} ${row.amount ?? ""}` });
        if (result.tagId) {
          row.tagId = result.tagId;
          row.tagAutoMatched = true;
        }
      } catch {
        // Parse failed for this row — skip, user can pick manually
      }
    }
  } finally {
    parsing.value = false;
  }
}

async function saveAll() {
  // First: fill tag gaps via parse API on unmatched rows
  await parseUnmatchedRows();

  const payloads = buildPayloads();
  if (!payloads.length) return;
  saving.value = true;
  try {
    const result = await recordsStore.batchCreateRecords(payloads);
    useToast().add({
      title: `${result.created} records created`,
      description: result.errors.length ? `${result.errors.length} failed` : undefined,
      color: result.errors.length ? "warning" : "success",
    });
    if (!result.errors.length) {
      clearDraft();
      open.value = false;
    }
  } catch {
    useToast().add({ title: "Failed to save records", color: "error" });
  } finally {
    saving.value = false;
  }
}

function formatGroupDate(iso: string): string {
  const d = new Date(iso + "T12:00:00");
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}
</script>

<template>
  <UModal v-model:open="open" title="Batch Create" :ui="{ content: 'sm:max-w-2xl' }">
    <template #body>
      <div class="max-w-3xl mx-auto space-y-4 text-[14px]">
        <!-- Account selector -->
        <USelectMenu
          v-model="selectedAccountId"
          :items="accountOptions"
          value-key="value"
          placeholder="Select account"
        >
          <template #item="{ item }">
            <div
              class="flex items-center justify-center size-5 rounded shrink-0"
              :style="{ backgroundColor: getColor(item.color ?? null)[100], color: getColor(item.color ?? null)[500] }"
            >
              <UIcon :name="item.icon" class="size-3" />
            </div>
            <span>{{ item.label }}</span>
          </template>
        </USelectMenu>

        <!-- Spreadsheet grid -->
        <div class="border border-default rounded-md overflow-hidden">
          <!-- Column headers -->
          <div class="grid grid-cols-[1.5rem_1fr_5.5rem_2rem] sm:grid-cols-[1.5rem_1fr_8rem_5.5rem_2rem] bg-accented border-b-2 border-default text-xs text-highlighted font-semibold">
            <span />
            <span class="px-3 py-2.5 border-r border-default">Note</span>
            <span class="px-3 py-2.5 border-r border-default hidden sm:block">Tag</span>
            <span class="px-3 py-2.5 text-right pr-4 border-r border-default">Amount</span>
            <span />
          </div>

          <!-- Date groups -->
          <template v-for="(group, gi) in dateGroups" :key="'g' + gi">
            <!-- Date header row -->
            <div class="grid grid-cols-[1.5rem_1fr_2rem] bg-elevated border-b border-default">
              <div class="flex items-center justify-center border-r border-default">
                <UIcon name="i-lucide-calendar" class="size-3.5 text-muted" />
              </div>
              <div class="flex items-center gap-2 px-2 py-1.5">
                <UPopover :content="{ side: 'bottom', align: 'start' }">
                  <UButton size="sm" variant="ghost" color="neutral" icon="i-lucide-calendar">
                    {{ formatGroupDate(group.date) }}
                  </UButton>
                  <template #content>
                    <div class="p-2">
                      <UCalendar
                        :model-value="toCalendarDate(group.date) as any"
                        @update:model-value="onDateChange(gi, $event as DateValue)"
                      />
                    </div>
                  </template>
                </UPopover>
              </div>
              <div class="flex items-center justify-center">
                <UTooltip v-if="dateGroups.length > 1" text="Delete date group">
                  <UButton
                    icon="i-lucide-trash-2"
                    size="xs"
                    variant="ghost"
                    color="error"
                    @click="confirmRemoveDateGroup(gi)"
                  />
                </UTooltip>
              </div>
            </div>

            <!-- Data rows -->
            <div
              v-for="(row, ri) in group.rows"
              :key="row.id"
              class="grid grid-cols-[1.5rem_1fr_5.5rem_2rem] sm:grid-cols-[1.5rem_1fr_8rem_5.5rem_2rem] items-center border-b border-default last:border-b-0 group/row hover:bg-primary/5"
              :class="ri % 2 === 1 ? 'bg-muted/5' : ''"
              @keydown="onCellKeydown"
            >
              <!-- Row number / reorder — fixed height to prevent jump on hover -->
              <div class="relative flex items-center justify-center h-full border-r border-default bg-muted/5 text-[10px] text-muted">
                <span class="group-hover/row:invisible">{{ ri + 1 }}</span>
                <div class="absolute inset-0 flex-col items-center justify-center hidden group-hover/row:flex">
                  <button class="hover:text-default flex-1 flex items-center" :disabled="ri === 0" @click="moveRow(gi, ri, -1)">
                    <UIcon name="i-lucide-chevron-up" class="size-3" />
                  </button>
                  <button class="hover:text-default flex-1 flex items-center" :disabled="ri === group.rows.length - 1" @click="moveRow(gi, ri, 1)">
                    <UIcon name="i-lucide-chevron-down" class="size-3" />
                  </button>
                </div>
              </div>

              <!-- Note + mobile tag indicator -->
              <div class="border-r border-default h-full flex items-center gap-0.5" :data-row="flatRowIndex(gi, ri)" data-col="0">
                <UInput
                  v-model="row.note"
                  placeholder="uber, sushi, padel..."
                  size="sm"
                  variant="ghost"
                  class="w-full"
                  @update:model-value="onNoteInput(row)"
                />
                <!-- Tag indicator on mobile (tag column hidden) -->
                <UTooltip v-if="row.tagId" :text="tagLabel(row.tagId)" class="sm:hidden shrink-0 mr-1">
                  <UIcon :name="tagMap.get(row.tagId)?.icon || 'i-lucide-hash'" class="size-3.5 text-primary" />
                </UTooltip>
              </div>

              <!-- Tag (hidden on mobile) -->
              <div class="border-r border-default h-full items-center hidden sm:flex">
                <USelectMenu
                  :model-value="row.tagId ?? 0"
                  :items="tagOptions"
                  value-key="value"
                  size="sm"
                  variant="ghost"
                  :ui="{ content: 'min-w-fit' }"
                  class="w-full"
                  @update:model-value="row.tagId = $event === 0 ? undefined : $event; row.tagAutoMatched = false"
                >
                  <template #item="{ item }">
                    <div
                      v-if="item.color"
                      class="flex items-center justify-center size-5 rounded shrink-0"
                      :style="{ backgroundColor: getColor(item.color ?? null)[100], color: getColor(item.color ?? null)[500] }"
                    >
                      <UIcon :name="item.icon" class="size-3" />
                    </div>
                    <UIcon v-else :name="item.icon" class="size-4 shrink-0 text-muted" />
                    <span>{{ item.label }}</span>
                    <span v-if="item.suffix" class="ml-auto text-xs text-muted">{{ item.suffix }}</span>
                  </template>
                </USelectMenu>
              </div>

              <!-- Amount -->
              <div class="h-full flex items-center border-r border-default" :data-row="flatRowIndex(gi, ri)" data-col="1">
                <UInput v-model.number="row.amount" type="number" placeholder="0" size="sm" variant="ghost" class="w-full text-right [&_input]:text-right [&_input]:appearance-none [&_input::-webkit-inner-spin-button]:appearance-none [&_input::-webkit-outer-spin-button]:appearance-none" />
              </div>

              <!-- Delete row -->
              <div class="flex justify-center">
                <UTooltip text="Remove row">
                  <UButton icon="i-lucide-minus-circle" size="xs" variant="ghost" color="neutral" @click="removeRow(gi, ri)" />
                </UTooltip>
              </div>
            </div>

            <!-- Add row for this date -->
            <div class="flex items-center px-2 py-1 border-b border-default last:border-b-0">
              <UButton label="Add row" icon="i-lucide-plus" size="xs" variant="ghost" color="neutral" @click="addRow(gi)" />
            </div>
          </template>

          <!-- Add date -->
          <div class="flex items-center px-2 py-1 border-t border-default">
            <UButton label="Add date" icon="i-lucide-calendar-plus" size="xs" variant="ghost" color="neutral" @click="addDateGroup" />
          </div>
        </div>

        <p class="text-xs text-muted text-right">{{ filledRows.length }} records ready</p>
      </div>
    </template>

    <template #footer>
      <UButton label="Clear all" icon="i-lucide-trash-2" variant="outline" color="error" size="sm" @click="resetBatch" />
      <div class="mr-auto" />
      <UButton label="Cancel" variant="ghost" color="neutral" @click="open = false" />
      <UButton :label="parsing ? 'Parsing...' : 'Save All'" icon="i-lucide-check" :loading="saving || parsing" :disabled="!filledRows.length" @click="saveAll" />
    </template>
  </UModal>
</template>
