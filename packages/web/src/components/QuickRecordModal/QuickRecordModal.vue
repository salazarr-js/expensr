<script setup lang="ts">
import { ref, watch, computed, nextTick } from "vue";
import { storeToRefs } from "pinia";
import type { ParsedRecord, CreateRecord, RecordWithRelations } from "@slzr/expensr-shared";
import { useAccountsStore } from "@/stores/accounts";
import { useCategoriesStore } from "@/stores/categories";
import { useRecordsStore } from "@/stores/records";
import { useApi, ApiError } from "@/composables/useApi";
import { getColor } from "@/utils/colors";
import { RecordFormModal } from "@/components/RecordFormModal";

const open = defineModel<boolean>("open", { required: true });

const accountsStore = useAccountsStore();
const categoriesStore = useCategoriesStore();
const recordsStore = useRecordsStore();
const api = useApi();

const { categories, tagsByCategory } = storeToRefs(categoriesStore);

/** Tag options for batch result editing. */
const batchTagOptions = computed(() => {
  const opts: { label: string; value: number; icon: string; color: string | null; suffix: string }[] = [
    { label: "None", value: 0, icon: "i-lucide-x", color: null, suffix: "" },
  ];
  for (const cat of categories.value) {
    for (const tag of tagsByCategory.value[cat.id] ?? []) {
      opts.push({ label: tag.name, value: tag.id, icon: tag.icon || "i-lucide-hash", color: cat.color, suffix: cat.name });
    }
  }
  return opts;
});

// ── Mode toggle ─────────────────────────────────────────────────────

const mode = ref<"single" | "batch">("single");

// ── Single mode state ───────────────────────────────────────────────

const text = ref("");
const parsing = ref(false);
const parseError = ref("");

const showEditModal = ref(false);
const prefillData = ref<Partial<CreateRecord> | undefined>();
const lastParseLogId = ref<number | null>(null);
const autoSavedRecord = ref<RecordWithRelations | undefined>();

// ── Batch mode state ────────────────────────────────────────────────

const batchText = ref("");
const batchParsing = ref(false);
const batchSaving = ref(false);
const batchResults = ref<(ParsedRecord & { input: string })[]>([]);

watch(open, (isOpen) => {
  if (!isOpen) return;
  text.value = "";
  batchText.value = "";
  parseError.value = "";
  parsing.value = false;
  batchResults.value = [];
  accountsStore.fetchAccountsByUsage();
  categoriesStore.fetchAll();
});

/** Update tag on a batch result. */
function updateBatchTag(index: number, tagId: number) {
  const result = batchResults.value[index];
  if (!result) return;
  if (tagId === 0) {
    result.tagId = null;
    result.tagName = null;
    result.categoryId = null;
    result.categoryName = null;
  } else {
    result.tagId = tagId;
    const opt = batchTagOptions.value.find((t) => t.value === tagId);
    result.tagName = opt?.label ?? null;
    // Find category from tag
    for (const cat of categories.value) {
      const tag = (tagsByCategory.value[cat.id] ?? []).find((t) => t.id === tagId);
      if (tag) { result.categoryId = cat.id; result.categoryName = cat.name; break; }
    }
  }
}

// ── Single mode logic ───────────────────────────────────────────────

/** Auto-save when: high confidence match OR needsReview (save now, review later). */
function canAutoSave(result: ParsedRecord): boolean {
  if (!result.amount || !result.accountId) return false;
  if (result.needsReview) return true;
  return !!(result.tagId && (result.resolvedBy === "name_match" || result.resolvedBy === "keyword"));
}

/** Build CreateRecord payload from parse result. */
function buildPayload(result: ParsedRecord): CreateRecord {
  return {
    type: result.type,
    amount: result.amount ?? 0,
    date: result.date ?? new Date().toISOString().slice(0, 10),
    accountId: result.accountId ?? 0,
    categoryId: result.categoryId,
    tagId: result.tagId,
    personIds: result.personIds?.length ? result.personIds : undefined,
    myShares: result.myShares > 1 ? result.myShares : undefined,
    note: result.note ?? null,
    needsReview: result.needsReview || undefined,
  };
}

async function autoSave(result: ParsedRecord) {
  const payload = buildPayload(result);
  try {
    await recordsStore.createRecord(payload);
    open.value = false;

    if (result.parseLogId) {
      api.post("/records/parse/feedback", {
        parseLogId: result.parseLogId,
        finalResponse: payload,
      }).catch(() => {});
    }

    useToast().add({
      title: "Record saved",
      description: `${result.amount} ${result.tagName ?? ""} → ${result.accountName}`,
      color: "success",
      actions: [{ label: "Edit", onClick: () => editAutoSavedRecord(result) }],
    });
  } catch {
    prefillData.value = buildPayload(result);
    lastParseLogId.value = result.parseLogId;
    open.value = false;
    showEditModal.value = true;
  }
}

async function editAutoSavedRecord(result: ParsedRecord) {
  try {
    const match = recordsStore.records.find((r) =>
      r.amount === result.amount && r.tagId === result.tagId
      && r.accountId === result.accountId && r.note === result.note,
    );
    if (match) { autoSavedRecord.value = match; showEditModal.value = true; }
  } catch {
    useToast().add({ title: "Could not load record", color: "error" });
  }
}

/** Validate single-line input. */
function isValidInput(input: string): string | null {
  if (!input) return "Type something";
  if (!/(?:^|\s)\d+(?:\.\d+)?(?:\s|$)/.test(input)) return "Include a valid amount";
  if (!/(?:^|\s)[a-záéíóúñü]{3,}(?:\s|$)/i.test(input)) return "Include a description";
  return null;
}

async function parseSingle() {
  text.value = text.value.trim();
  const error = isValidInput(text.value);
  if (error) { parseError.value = error; return; }
  parsing.value = true;
  parseError.value = "";
  try {
    const result = await api.post<ParsedRecord>("/records/parse", { text: text.value });
    if (canAutoSave(result)) {
      await autoSave(result);
    } else {
      const payload = buildPayload(result);
      // No tag resolved → mark for review by default
      if (!payload.tagId) payload.needsReview = true;
      prefillData.value = payload;
      lastParseLogId.value = result.parseLogId;
      open.value = false;
      showEditModal.value = true;
    }
  } catch (e: unknown) {
    parseError.value = e instanceof ApiError ? e.message : "Failed to parse";
  } finally {
    parsing.value = false;
  }
}

// ── Batch mode logic ────────────────────────────────────────────────

async function parseBatch() {
  const lines = batchText.value.split("\n").map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return;
  batchParsing.value = true;
  batchResults.value = [];
  try {
    for (const line of lines) {
      try {
        const result = await api.post<ParsedRecord>("/records/parse", { text: line });
        batchResults.value.push({ ...result, input: line });
      } catch {
        batchResults.value.push({
          input: line, amount: null, tagId: null, tagName: null, categoryId: null,
          categoryName: null, accountId: null, accountName: null, note: line,
          date: null, personIds: [], personNames: [], myShares: 1,
          splitType: "equal", type: "expense", needsReview: false,
          resolvedBy: "none", parseLogId: 0,
        });
      }
    }
  } finally {
    batchParsing.value = false;
  }
}

const batchValidCount = computed(() => batchResults.value.filter((r) => r.amount && r.accountId).length);

function removeBatchResult(index: number) {
  batchResults.value.splice(index, 1);
}

async function saveBatch() {
  const valid = batchResults.value.filter((r) => r.amount && r.accountId);
  if (!valid.length) return;
  batchSaving.value = true;
  try {
    const payloads = valid.map((r) => {
      const p = buildPayload(r);
      if (!p.tagId) p.needsReview = true; // no tag → needs review
      return p;
    });
    const result = await recordsStore.batchCreateRecords(payloads);
    useToast().add({
      title: `${result.created} records created`,
      description: result.errors.length ? `${result.errors.length} failed` : undefined,
      color: result.errors.length ? "warning" : "success",
    });
    // Send feedback for each parsed record (fire-and-forget)
    for (const r of valid) {
      if (r.parseLogId) {
        api.post("/records/parse/feedback", {
          parseLogId: r.parseLogId,
          finalResponse: buildPayload(r),
        }).catch(() => {});
      }
    }
    if (!result.errors.length) open.value = false;
  } catch {
    useToast().add({ title: "Failed to save records", color: "error" });
  } finally {
    batchSaving.value = false;
  }
}

// Focus the input when switching modes
watch(mode, () => {
  nextTick(() => {
    // Find the visible input/textarea inside the modal body
    const modal = document.querySelector("[data-quick-modal]");
    const el = modal?.querySelector<HTMLElement>("input:not([type=hidden]), textarea");
    el?.focus();
  });
});

/** Handle keyboard: Enter to send in single mode. In batch textarea, Enter is newline naturally. */
function onTextareaKeydown(e: KeyboardEvent) {
  // Desktop: Shift+Enter = newline (default), Enter alone = parse
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    parseBatch();
  }
}

function onEditModalClose() {
  prefillData.value = undefined;
  lastParseLogId.value = null;
  autoSavedRecord.value = undefined;
}
</script>

<template>
  <UModal v-model:open="open" title="Quick Record" data-quick-modal>
    <template #body>
      <!-- Mode toggle -->
      <div class="flex items-center gap-2 mb-3">
        <UButton
          label="Single"
          size="xs"
          :variant="mode === 'single' ? 'solid' : 'ghost'"
          :color="mode === 'single' ? 'primary' : 'neutral'"
          @click="mode = 'single'"
        />
        <UButton
          label="Batch"
          size="xs"
          :variant="mode === 'batch' ? 'solid' : 'ghost'"
          :color="mode === 'batch' ? 'primary' : 'neutral'"
          @click="mode = 'batch'"
        />
        <span class="text-xs text-muted ml-1">{{ mode === 'single' ? 'One record at a time' : 'One per line, parse all at once' }}</span>
      </div>

      <!-- Single mode -->
      <template v-if="mode === 'single'">
        <form @submit.prevent="parseSingle">
          <UInput
            v-model="text"

            placeholder='uber muniz 3500 (galicia)'
            size="lg"
            autofocus
            :disabled="parsing"
            class="w-full"
          />
        </form>
        <p v-if="parseError" class="text-sm text-error mt-2">{{ parseError }}</p>
      </template>

      <!-- Batch mode -->
      <template v-else>
        <UTextarea
          v-if="!batchResults.length"
          v-model="batchText"
          data-quick-input
          placeholder="uber 3500 (galicia)&#10;padel 8000 angy wilmer&#10;sushi 15000&#10;netflix 5000"
          :rows="5"
          autoresize
          :disabled="batchParsing"
          class="w-full"
          @keydown="onTextareaKeydown"
        />

        <!-- Batch results -->
        <div v-if="batchResults.length" class="space-y-2">
          <div class="flex items-center justify-between">
            <span class="text-sm text-muted">{{ batchValidCount }} of {{ batchResults.length }} ready</span>
            <UButton label="Re-parse" size="xs" variant="ghost" icon="i-lucide-refresh-cw" @click="batchResults = []" />
          </div>
          <div class="border border-default rounded-lg divide-y divide-default max-h-64 overflow-y-auto">
            <div
              v-for="(result, i) in batchResults"
              :key="i"
              class="flex items-center gap-2 px-3 py-1.5 text-sm"
              :class="result.amount && result.accountId ? '' : 'bg-amber-50 dark:bg-amber-950/20'"
            >
              <UIcon
                :name="result.amount && result.tagId ? 'i-lucide-check-circle' : result.amount ? 'i-lucide-alert-circle' : 'i-lucide-x-circle'"
                :class="result.amount && result.tagId ? 'text-green-500' : result.amount ? 'text-amber-500' : 'text-red-500'"
                class="size-3.5 shrink-0"
              />
              <span class="font-mono text-xs w-16 text-right">{{ result.amount?.toLocaleString() ?? '—' }}</span>
              <span class="truncate flex-1 text-xs">{{ result.note ?? result.input }}</span>
              <USelectMenu
                :model-value="result.tagId ?? 0"
                :items="batchTagOptions"
                value-key="value"
                size="xs"
                variant="ghost"
                :ui="{ content: 'min-w-fit' }"
                class="w-24"
                @update:model-value="updateBatchTag(i, $event as number)"
              >
                <template #item="{ item }">
                  <div
                    v-if="item.color"
                    class="flex items-center justify-center size-4 rounded shrink-0"
                    :style="{ backgroundColor: getColor(item.color ?? null)[100], color: getColor(item.color ?? null)[500] }"
                  >
                    <UIcon :name="item.icon" class="size-2.5" />
                  </div>
                  <UIcon v-else :name="item.icon" class="size-3.5 shrink-0 text-muted" />
                  <span class="text-xs">{{ item.label }}</span>
                </template>
              </USelectMenu>
              <span class="text-xs text-muted truncate w-20">{{ result.accountName ?? '?' }}</span>
              <UButton icon="i-lucide-x" size="xs" variant="ghost" color="neutral" @click="removeBatchResult(i)" />
            </div>
          </div>
        </div>
      </template>
    </template>

    <template #footer>
      <UButton label="Cancel" variant="ghost" color="neutral" class="ml-auto" @click="open = false" />
      <!-- Single mode -->
      <UButton
        v-if="mode === 'single'"
        label="Parse"
        icon="i-lucide-sparkles"
        :loading="parsing"
        :disabled="!text.trim()"
        @click="parseSingle"
      />
      <!-- Batch mode: parse or save -->
      <UButton
        v-else-if="!batchResults.length"
        label="Parse All"
        icon="i-lucide-sparkles"
        :loading="batchParsing"
        :disabled="!batchText.trim()"
        @click="parseBatch"
      />
      <UButton
        v-else
        label="Save All"
        icon="i-lucide-check"
        :loading="batchSaving"
        :disabled="!batchValidCount"
        @click="saveBatch"
      />
    </template>
  </UModal>

  <!-- Edit modal for single mode review -->
  <RecordFormModal
    v-model:open="showEditModal"
    :record="autoSavedRecord"
    :initial-data="autoSavedRecord ? undefined : prefillData"
    :parse-log-id="autoSavedRecord ? undefined : (lastParseLogId ?? undefined)"
    @update:open="!$event && onEditModalClose()"
  />
</template>
