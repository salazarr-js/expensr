<script setup lang="ts">
import { ref, watch } from "vue";
import type { ParsedRecord, CreateRecord, RecordWithRelations } from "@slzr/expensr-shared";
import { useAccountsStore } from "@/stores/accounts";
import { useRecordsStore } from "@/stores/records";
import { useApi, ApiError } from "@/composables/useApi";
import { RecordFormModal } from "@/components/RecordFormModal";

const open = defineModel<boolean>("open", { required: true });

const accountsStore = useAccountsStore();
const recordsStore = useRecordsStore();
const api = useApi();

const text = ref("");
const parsing = ref(false);
const parseError = ref("");

// State for handing off to RecordFormModal
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
});

/** High confidence = all key fields resolved via deterministic path. */
/** Auto-save when: high confidence match OR needsReview (save now, review later). */
function canAutoSave(result: ParsedRecord): boolean {
  if (!result.amount || !result.accountId) return false;
  // ?? marker = save immediately for later review, tag not required
  if (result.needsReview) return true;
  // High confidence = tag resolved via deterministic path
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

/** Save directly without form review — fires feedback as fire-and-forget. */
async function autoSave(result: ParsedRecord) {
  const payload = buildPayload(result);
  try {
    await recordsStore.createRecord(payload);
    open.value = false;

    // Fire-and-forget feedback (confirms the parse was correct — no correction)
    if (result.parseLogId) {
      api.post("/records/parse/feedback", {
        parseLogId: result.parseLogId,
        finalResponse: payload,
      }).catch(() => {});
    }

    const toast = useToast();
    toast.add({
      title: "Record saved",
      description: `${result.amount} ${result.tagName ?? ""} → ${result.accountName}`,
      color: "success",
      actions: [{
        label: "Edit",
        onClick: () => editAutoSavedRecord(result),
      }],
    });
  } catch {
    // Auto-save failed — fall back to form review
    prefillData.value = buildPayload(result);
    lastParseLogId.value = result.parseLogId;
    open.value = false;
    showEditModal.value = true;
  }
}

/** Open the most recently auto-saved record for editing via toast action. */
async function editAutoSavedRecord(result: ParsedRecord) {
  // Fetch latest records to find the one we just created (by matching fields)
  try {
    const records = recordsStore.records;
    const match = records.find((r) =>
      r.amount === result.amount
      && r.tagId === result.tagId
      && r.accountId === result.accountId
      && r.note === result.note,
    );
    if (match) {
      autoSavedRecord.value = match;
      showEditModal.value = true;
    }
  } catch {
    useToast().add({ title: "Could not load record", color: "error" });
  }
}

/** Validate input has a standalone number and at least one word with 3+ letters. */
function isValidInput(input: string): string | null {
  if (!input) return "Type something";
  // Amount must be a standalone number (not embedded in a word like "asd123sd")
  if (!/(?:^|\s)\d+(?:\.\d+)?(?:\s|$)/.test(input)) return "Include a valid amount";
  // At least one standalone word with 3+ letters
  if (!/(?:^|\s)[a-záéíóúñü]{3,}(?:\s|$)/i.test(input)) return "Include a description";
  return null;
}

async function parse() {
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
      // Open edit modal for review
      prefillData.value = buildPayload(result);
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

/** Clean up state when edit modal closes. */
function onEditModalClose() {
  prefillData.value = undefined;
  lastParseLogId.value = null;
  autoSavedRecord.value = undefined;
}
</script>

<template>
  <!-- Quick input modal -->
  <UModal v-model:open="open" title="Quick Record">
    <template #body>
      <p class="text-sm text-muted mb-3">Type a natural description of your expense or income.</p>
      <form @submit.prevent="parse">
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
      <UButton label="Parse" icon="i-lucide-sparkles" :loading="parsing" :disabled="!text.trim()" @click="parse" />
    </template>
  </UModal>

  <!-- Edit modal for review or editing auto-saved records -->
  <RecordFormModal
    v-model:open="showEditModal"
    :record="autoSavedRecord"
    :initial-data="autoSavedRecord ? undefined : prefillData"
    :parse-log-id="autoSavedRecord ? undefined : (lastParseLogId ?? undefined)"
    @update:open="!$event && onEditModalClose()"
  />
</template>
