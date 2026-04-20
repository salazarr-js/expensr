<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import { useApi } from "@/composables/useApi";
import { useAlertDialog } from "@/composables/useAlertDialog";

interface DraftRecord {
  id: number;
  dateTime: string;
  text: string;
  amount: number | null;
  createdAt: string;
}

const api = useApi();
const alert = useAlertDialog();

const drafts = ref<DraftRecord[]>([]);
const loading = ref(false);
const error = ref(false);
const showAddModal = ref(false);
const newText = ref("");
const adding = ref(false);

async function addDraft() {
  const text = newText.value.trim();
  if (!text) return;
  adding.value = true;
  try {
    await api.post("/records/quick", { text });
    newText.value = "";
    showAddModal.value = false;
    await fetchDrafts();
    useToast().add({ title: "Draft saved", color: "success" });
  } catch {
    useToast().add({ title: "Failed to save draft", color: "error" });
  } finally {
    adding.value = false;
  }
}

async function fetchDrafts() {
  loading.value = true;
  error.value = false;
  try {
    drafts.value = await api.get<DraftRecord[]>("/records/drafts");
  } catch {
    error.value = true;
    useToast().add({ title: "Failed to load drafts", color: "error" });
  } finally {
    loading.value = false;
  }
}

async function deleteDraft(draft: DraftRecord) {
  const ok = await alert.destructive({
    title: "Delete draft?",
    description: `"${draft.text}" — this can't be undone.`,
    confirmLabel: "Delete",
  });
  if (!ok) return;
  try {
    await api.del(`/records/drafts/${draft.id}`);
    drafts.value = drafts.value.filter((d) => d.id !== draft.id);
    useToast().add({ title: "Draft deleted", color: "success" });
  } catch {
    useToast().add({ title: "Failed to delete", color: "error" });
  }
}

/** Format ISO datetime to a readable local string. */
function fmtDate(iso: string): string {
  const [datePart] = iso.split("T");
  const [y, m, d] = datePart!.split("-").map(Number);
  return new Date(y!, m! - 1, d!).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function fmtAmount(n: number | null): string {
  if (n === null) return "—";
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Width of the amount column — sized to the longest formatted amount. 8.5px matches JetBrains Mono at text-sm (14px). */
const amountColWidth = computed(() => {
  let maxLen = 1;
  for (const d of drafts.value) {
    const len = fmtAmount(d.amount).length;
    if (len > maxLen) maxLen = len;
  }
  return `${maxLen * 8.5}px`;
});

const grouped = computed(() => {
  const map = new Map<string, { date: string; label: string; drafts: DraftRecord[] }>();
  for (const d of drafts.value) {
    const date = d.dateTime.split("T")[0]!;
    let group = map.get(date);
    if (!group) {
      group = { date, label: fmtDate(d.dateTime), drafts: [] };
      map.set(date, group);
    }
    group.drafts.push(d);
  }
  return [...map.values()];
});

onMounted(fetchDrafts);
</script>

<template>
  <UDashboardPanel>
    <template #header>
      <UDashboardNavbar title="Drafts">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>

        <template #right>
          <UBadge v-if="drafts.length" :label="`${drafts.length}`" variant="subtle" color="neutral" />
          <UButton icon="i-lucide-plus" label="Add draft" @click="showAddModal = true" />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <!-- Loading -->
      <div v-if="loading && !drafts.length" class="flex items-center justify-center mt-[25vh]">
        <UIcon name="i-lucide-loader-circle" class="size-8 text-dimmed animate-spin" />
      </div>

      <!-- Error -->
      <div v-else-if="error && !drafts.length" class="flex flex-col items-center text-center mt-[25vh]">
        <UIcon name="i-lucide-wifi-off" class="mb-4 size-16 text-dimmed/40" />
        <h2 class="text-lg font-semibold text-highlighted">Failed to load drafts</h2>
        <UButton icon="i-lucide-refresh-cw" label="Retry" class="mt-6" @click="fetchDrafts" />
      </div>

      <!-- Empty -->
      <div v-else-if="!drafts.length" class="flex flex-col items-center text-center mt-[25vh]">
        <UIcon name="i-lucide-inbox" class="mb-4 size-16 text-dimmed/40" />
        <h2 class="text-lg font-semibold text-highlighted">No drafts yet</h2>
        <p class="mt-1 text-sm text-muted">Use the quick record shortcut to save drafts before the app is ready.</p>
      </div>

      <!-- Draft list grouped by date -->
      <div v-else class="max-w-2xl mx-auto space-y-6 py-2">
        <div v-for="group in grouped" :key="group.date">
          <!-- Date header -->
          <h3 class="text-xs font-semibold text-muted uppercase tracking-wide mb-2 px-1">{{ group.label }}</h3>

          <div class="space-y-1.5">
            <div
              v-for="draft in group.drafts"
              :key="draft.id"
              class="grid items-center gap-x-4 px-3 py-2.5 rounded-md border border-default bg-default hover:bg-elevated transition-colors"
              :style="{ gridTemplateColumns: `1fr auto ${amountColWidth} auto` }"
            >
              <!-- Text -->
              <UTooltip :text="draft.text" :ui="{ content: 'max-w-md whitespace-normal break-all' }">
                <span class="text-sm text-highlighted truncate block">{{ draft.text }}</span>
              </UTooltip>

              <!-- Dot -->
              <span class="text-highlighted text-lg leading-none">·</span>

              <!-- Amount -->
              <span class="text-sm font-mono font-semibold text-highlighted tabular-nums text-right block">
                {{ fmtAmount(draft.amount) }}
              </span>

              <!-- Delete -->
              <UButton
                icon="i-lucide-trash-2"
                size="xs"
                variant="ghost"
                color="error"
                @click="deleteDraft(draft)"
              />
            </div>
          </div>
        </div>
      </div>
    </template>
  </UDashboardPanel>

  <!-- Add draft modal -->
  <UModal v-model:open="showAddModal" title="Quick draft">
    <template #body>
      <form class="space-y-4" @submit.prevent="addDraft">
        <UFormField label="What did you spend?" hint="e.g. cafe 500 15/04">
          <UInput v-model="newText" autofocus placeholder="uber 3500" class="w-full" @keydown.enter.prevent="addDraft" />
        </UFormField>
      </form>
    </template>

    <template #footer>
      <UButton label="Cancel" variant="ghost" color="neutral" @click="showAddModal = false" class="ml-auto" />
      <UButton icon="i-lucide-plus" label="Save draft" :loading="adding" :disabled="!newText.trim()" @click="addDraft" />
    </template>
  </UModal>
</template>
