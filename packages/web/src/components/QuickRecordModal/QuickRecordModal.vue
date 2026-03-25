<script setup lang="ts">
import { ref, watch } from "vue";
import type { ParsedRecord, CreateRecord } from "@slzr/expensr-shared";
import { useAccountsStore } from "@/stores/accounts";
import { useApi, ApiError } from "@/composables/useApi";
import { RecordFormModal } from "@/components/RecordFormModal";

const open = defineModel<boolean>("open", { required: true });

const accountsStore = useAccountsStore();
const api = useApi();

const text = ref("");
const parsing = ref(false);
const parseError = ref("");

// State for handing off to RecordFormModal
const showEditModal = ref(false);
const prefillData = ref<Partial<CreateRecord> | undefined>();
const lastParsed = ref<ParsedRecord | null>(null);
const lastText = ref("");

watch(open, (isOpen) => {
  if (!isOpen) return;
  text.value = "";
  parseError.value = "";
  parsing.value = false;
  accountsStore.fetchAccountsByUsage();
});

async function parse() {
  text.value = text.value.trim();
  if (!text.value) return;
  parsing.value = true;
  parseError.value = "";
  try {
    const result = await api.post<ParsedRecord>("/records/parse", { text: text.value });
    lastParsed.value = result;
    lastText.value = text.value;

    // Always open edit modal for review/training
    prefillData.value = {
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
    open.value = false;
    showEditModal.value = true;
  } catch (e: unknown) {
    parseError.value = e instanceof ApiError ? e.message : "Failed to parse";
  } finally {
    parsing.value = false;
  }
}

/** Send feedback when user saves from the edit modal (corrections path). */
function onEditModalClose() {
  prefillData.value = undefined;
  lastParsed.value = null;
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

  <!-- Edit modal for incomplete parses -->
  <RecordFormModal
    v-model:open="showEditModal"
    :initial-data="prefillData"
    @update:open="!$event && onEditModalClose()"
  />
</template>
