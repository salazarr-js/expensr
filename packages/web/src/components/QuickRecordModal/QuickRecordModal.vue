<script setup lang="ts">
import { ref, watch } from "vue";
import type { ParsedRecord, CreateRecord, RecordWithRelations } from "@slzr/expensr-shared";
import { useAccountsStore } from "@/stores/accounts";
import { useCategoriesStore } from "@/stores/categories";
import { useRecordsStore } from "@/stores/records";
import { useApi, ApiError } from "@/composables/useApi";
import { RecordFormModal } from "@/components/RecordFormModal";

const open = defineModel<boolean>("open", { required: true });

const accountsStore = useAccountsStore();
const categoriesStore = useCategoriesStore();
const recordsStore = useRecordsStore();
const api = useApi();

// ── State ───────────────────────────────────────────────────────────

const text = ref("");
const parsing = ref(false);
const parseError = ref("");

const showEditModal = ref(false);
const prefillData = ref<Partial<CreateRecord> | undefined>();
const lastParseLogId = ref<number | null>(null);
const autoSavedRecord = ref<RecordWithRelations | undefined>();

watch(open, (isOpen) => {
  if (!isOpen) return;
  text.value = "";
  parseError.value = "";
  parsing.value = false;
  accountsStore.fetchAccountsByUsage();
  categoriesStore.fetchAll();
});

// ── Parse & auto-save logic ─────────────────────────────────────────

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

function onEditModalClose() {
  prefillData.value = undefined;
  lastParseLogId.value = null;
  autoSavedRecord.value = undefined;
}
</script>

<template>
  <UModal v-model:open="open" title="Quick Record" data-quick-modal>
    <template #body>
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

    <template #footer>
      <UButton label="Cancel" variant="ghost" color="neutral" class="ml-auto" @click="open = false" />
      <UButton
        label="Parse"
        icon="i-lucide-sparkles"
        :loading="parsing"
        :disabled="!text.trim()"
        @click="parseSingle"
      />
    </template>
  </UModal>

  <!-- Edit modal for parsed record review -->
  <RecordFormModal
    v-model:open="showEditModal"
    :record="autoSavedRecord"
    :initial-data="autoSavedRecord ? undefined : prefillData"
    :parse-log-id="autoSavedRecord ? undefined : (lastParseLogId ?? undefined)"
    @update:open="!$event && onEditModalClose()"
  />
</template>
