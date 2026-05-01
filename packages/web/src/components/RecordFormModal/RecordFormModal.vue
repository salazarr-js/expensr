<script setup lang="ts">
import { reactive, ref, computed, watch } from "vue";
import { useDebounceFn } from "@vueuse/core";
import { storeToRefs } from "pinia";
import type { RecordWithRelations, CreateRecord, Tag } from "@slzr/expensr-shared";
import { createRecordSchema } from "@slzr/expensr-shared";
import { useRecordsStore } from "@/stores/records";
import { useAccountsStore } from "@/stores/accounts";
import { useCategoriesStore } from "@/stores/categories";
import { usePeopleStore } from "@/stores/people";
import { useApi, ApiError } from "@/composables/useApi";
import { getColor, APP_COLORS } from "@/utils/colors";
import { formatMoneyParts } from "@/utils/money";

const props = defineProps<{
  record?: RecordWithRelations;
  initialData?: Partial<CreateRecord>;
  parseLogId?: number; // from QuickRecordModal — triggers feedback on save
}>();

const api = useApi();

const open = defineModel<boolean>("open", { required: true });

const recordsStore = useRecordsStore();
const accountsStore = useAccountsStore();
const categoriesStore = useCategoriesStore();
const peopleStore = usePeopleStore();
const { accounts } = storeToRefs(accountsStore);
const { categories, tagsByCategory } = storeToRefs(categoriesStore);
const { people } = storeToRefs(peopleStore);

const INCOME_CATEGORY = "Income";

/** Suppress watchers during programmatic state changes (form init, auto-assign). */
let suppressTagWatch = false;
let suppressCategoryWatch = false;
let tagAutoMatched = false; // note watcher is driving the tag — can keep updating
let noteJustSetTag = false; // consumed by tagId watcher to distinguish note vs manual change
let suppressReviewWatch = false; // suppress during form init

const accountOptions = computed(() =>
  accounts.value.map((a) => ({
    label: `${a.name} (${a.currency})`,
    value: a.id,
    icon: a.icon || "i-lucide-wallet",
    color: a.color as string | null,
  })),
);

const categoryOptions = computed(() => [
  { label: "None", value: 0, icon: "i-lucide-x", color: null as string | null },
  ...categories.value.map((c) => ({
    label: c.name,
    value: c.id,
    icon: c.icon || "i-lucide-tag",
    color: c.color as string | null,
  })),
]);

/** Learned keyword→tag mappings from parse feedback. Used as fallback in note→tag matching. */
const keywordMappings = ref<{ keyword: string; tagId: number | null; tagName: string | null }[]>([]);
async function fetchKeywordMappings() {
  try {
    keywordMappings.value = await api.get("/records/parse/keywords");
  } catch {
    keywordMappings.value = [];
  }
}

/** Flat list of all tags across all categories, with category info for display. */
const allTags = computed(() => {
  const result: (Tag & { categoryName: string; categoryColor: string | null; categoryIcon: string | null })[] = [];
  for (const cat of categories.value) {
    const tags = tagsByCategory.value[cat.id] ?? [];
    for (const tag of tags) {
      result.push({
        ...tag,
        categoryName: cat.name,
        categoryColor: cat.color,
        categoryIcon: cat.icon,
      });
    }
  }
  return result;
});

/** Tag options: if category is selected, show only that category's tags. Otherwise show all. */
const tagOptions = computed(() => {
  const source = state.categoryId
    ? allTags.value.filter((t) => t.categoryId === state.categoryId)
    : allTags.value;

  return [
    { label: "None", value: 0, icon: "i-lucide-x", color: null as string | null, suffix: "" },
    ...source.map((t) => ({
      label: t.name,
      value: t.id,
      icon: t.icon || "i-lucide-hash",
      color: t.categoryColor as string | null,
      suffix: state.categoryId ? "" : t.categoryName,
    })),
  ];
});

const peopleOptions = computed(() => [
  ...(people.value.length ? [{ label: "None", value: 0, color: null as string | null }] : []),
  ...people.value.map((p) => ({
    label: p.name,
    value: p.id,
    color: p.color as string | null,
  })),
]);

/** Hue colors for random assignment (excludes grays: Stone, Zinc, Gray, Neutral, Slate). */
const PEOPLE_COLORS = APP_COLORS.filter((c) => !["Stone", "Zinc", "Gray", "Neutral", "Slate"].includes(c.name));
const peopleSearch = ref("");
const peopleOpen = ref(false);

/** Capitalize first letter of each word. */
function capitalizeName(s: string): string {
  return s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Create a person inline from the selector's "Create X" option. */
async function onCreatePerson(name: string) {
  const color = PEOPLE_COLORS[Math.floor(Math.random() * PEOPLE_COLORS.length)]?.name ?? "Blue";
  try {
    const person = await peopleStore.createPerson({ name: capitalizeName(name), color });
    state.personIds = [...(state.personIds ?? []), person.id];
    peopleSearch.value = "";
  } catch {
    useToast().add({ title: "Failed to create person", color: "error" });
  }
}

/** Handle "None" toggle: selecting None clears others, selecting a person removes None. */
function onPeopleUpdate(value: number[]) {
  const wasEmpty = !state.personIds?.length; // None was displayed (0 is never in state)
  const hasNone = value.includes(0);
  if (hasNone && !wasEmpty) {
    // User clicked None while people were selected → clear all and close dropdown
    state.personIds = [];
    state.myShares = 1;
    peopleOpen.value = false;
  } else {
    // User selected/deselected a person
    const selected = value.filter((v) => v !== 0);
    // Settlements: only one person allowed — keep the latest pick and close
    state.personIds = isSettlement.value ? selected.slice(-1) : selected;
    if (isSettlement.value && state.personIds.length) {
      peopleOpen.value = false;
    }
  }
}

/** Whether the shares split section is visible (people selected + amount > 0). */
const showSplitControls = computed(() => !!state.personIds?.length && state.amount > 0 && state.type !== "settlement");

/** Split mode: 'auto' (equal/weighted) or 'manual' (per-person amounts). */
const splitMode = ref<"auto" | "manual">("auto");

/** Per-person manual amounts, keyed by person ID. 0 = "me" (the user). */
const manualAmounts = reactive<Record<number, number>>({});

/** Sum of all manual amounts including "me" (key 0). */
const manualTotal = computed(() => Object.values(manualAmounts).reduce((sum, v) => sum + (v || 0), 0));

/** Whether manual amounts exceed the record total. */
const manualOverflow = computed(() => manualTotal.value > state.amount);

/** Pre-fill manual amounts from current equal/weighted calculation, including "me". */
function prefillManualAmounts() {
  const peopleCount = state.personIds?.length ?? 0;
  if (!peopleCount) return;
  const perShare = state.amount / (peopleCount + (state.myShares ?? 1));
  const myShare = perShare * (state.myShares ?? 1);
  manualAmounts[0] = Math.round(myShare * 100) / 100; // "me"
  for (const pid of state.personIds ?? []) {
    manualAmounts[pid] = Math.round(perShare * 100) / 100;
  }
}

/** Switch between auto and manual split modes. */
function setSplitMode(mode: "auto" | "manual") {
  if (mode === "manual" && splitMode.value === "auto") {
    prefillManualAmounts();
  }
  splitMode.value = mode;
}

/** Currency code for the selected account. */
const selectedCurrency = computed(() => {
  const account = accounts.value.find((a) => a.id === state.accountId);
  return account?.currency ?? "";
});

/** Split summary: derived amounts for the split controls UI. */
const splitSummary = computed(() => {
  const peopleCount = state.personIds?.length ?? 0;
  const myShares = state.myShares ?? 1;
  const totalShares = peopleCount + myShares;
  const perShare = state.amount / totalShares;
  const userPays = perShare * myShares;
  return { perShare, userPays, totalShares };
});

/** Update myShares from the /N (total shares) stepper. */
function setTotalShares(n: number) {
  const peopleCount = state.personIds?.length ?? 0;
  state.myShares = Math.max(1, n - peopleCount);
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

const defaultState = (): CreateRecord => ({
  type: "expense",
  amount: 0,
  date: todayISO(),
  accountId: accounts.value[0]?.id ?? 0,
  tagId: null,
  categoryId: null,
  personIds: [],
  myShares: 1,
  note: null,
});

const state = reactive<CreateRecord>(defaultState());

watch(open, (isOpen) => {
  if (!isOpen) return;
  tagAutoMatched = false;
  noteJustSetTag = false;
  suppressReviewWatch = true;
  // Fetch data, then set default account to most-used for new records
  accountsStore.fetchAccountsByUsage().then(() => {
    if (!props.record && !props.initialData && accounts.value.length) {
      state.accountId = accounts.value[0]!.id;
    }
  });
  categoriesStore.fetchAll();
  peopleStore.fetchPeople();
  fetchKeywordMappings();
  // Reset manual split state
  splitMode.value = "auto";
  Object.keys(manualAmounts).forEach((k) => delete manualAmounts[Number(k)]);

  if (props.record) {
    suppressTagWatch = true;
    suppressCategoryWatch = true;
    Object.assign(state, {
      type: props.record.type,
      amount: props.record.amount,
      date: props.record.date.split("T")[0],
      accountId: props.record.accountId,
      tagId: props.record.tagId,
      categoryId: props.record.categoryId,
      personIds: props.record.people?.map((p) => p.id) ?? [],
      myShares: props.record.myShares ?? 1,
      note: props.record.note,
      needsReview: props.record.needsReview,
    });
    // Load manual amounts from record if split was manual
    if (props.record.splitType === "manual" && props.record.people?.length) {
      splitMode.value = "manual";
      let othersTotal = 0;
      for (const p of props.record.people) {
        manualAmounts[p.id] = p.shareAmount;
        othersTotal += p.shareAmount;
      }
      // "Me" = total minus others' shares
      manualAmounts[0] = props.record.amount - othersTotal;
    }
  } else if (props.initialData) {
    suppressTagWatch = true;
    suppressCategoryWatch = true;
    Object.assign(state, { ...defaultState(), ...props.initialData });
  } else {
    Object.assign(state, defaultState());
  }
});

/** When category changes (user-initiated), clear the tag. */
watch(() => state.categoryId, () => {
  if (suppressCategoryWatch) {
    suppressCategoryWatch = false;
    return;
  }
  state.tagId = null;
});

/** When tag changes, auto-assign category from the tag's parent. */
watch(() => state.tagId, (tagId) => {
  if (suppressTagWatch) {
    suppressTagWatch = false;
    return;
  }
  if (noteJustSetTag) {
    // Note watcher triggered this — keep auto-matching active
    noteJustSetTag = false;
    tagAutoMatched = true;
  } else {
    // User manually picked a tag — stop note auto-matching
    tagAutoMatched = false;
  }

  if (!tagId) return;
  // Find tag in allTags — if categories haven't loaded yet, watch for them
  const assignCategory = () => {
    const tag = allTags.value.find((t) => t.id === tagId);
    if (tag?.categoryId) {
      suppressCategoryWatch = true;
      state.categoryId = tag.categoryId;
      return true;
    }
    return false;
  };
  if (!assignCategory() && !allTags.value.length) {
    // Categories not loaded yet — retry once when they load
    const stop = watch(allTags, () => { assignCategory(); stop(); }, { once: true });
  }
});

/** Auto-compute needsReview: true if ?? in note OR no tag. Tag clears it (unless ?? present). */
watch([() => state.tagId, () => state.note], () => {
  if (suppressReviewWatch) { suppressReviewWatch = false; return; }
  const hasDoubleQuestion = state.note?.includes("??") ?? false;
  const hasTag = !!state.tagId;
  // ?? always means needs review, even with a tag
  // No tag means needs review (unless user manually unchecks)
  // Tag assigned without ?? means resolved
  if (hasDoubleQuestion) { state.needsReview = true; }
  else if (hasTag) { state.needsReview = false; }
});

/** Debounced note → tag matching. Tag name match → keyword dictionary → give up. */
const matchTagFromNote = useDebounceFn((note: string) => {
  if (state.tagId && !tagAutoMatched) return; // user manually picked — don't override
  const keywords = note.toLowerCase().split(/\s+/).filter((w) => w.length >= 3);
  if (!keywords.length) return;

  // 1. Tag name match — exact first, then partial
  let matchId: number | null = null;
  for (const kw of keywords) {
    const exact = allTags.value.find((t) => t.name.toLowerCase() === kw);
    if (exact) { matchId = exact.id; break; }
  }
  if (!matchId) {
    for (const kw of keywords) {
      const partial = allTags.value.find((t) => t.name.toLowerCase().includes(kw) || kw.includes(t.name.toLowerCase()));
      if (partial) { matchId = partial.id; break; }
    }
  }

  // 2. Keyword dictionary fallback — learned from parse feedback
  if (!matchId && keywordMappings.value.length) {
    for (const kw of keywords) {
      const mapped = keywordMappings.value.find((m) => m.keyword === kw);
      if (mapped?.tagId) { matchId = mapped.tagId; break; }
    }
  }

  if (matchId) {
    noteJustSetTag = true; // consumed by tagId watcher to keep tagAutoMatched = true
    state.tagId = matchId;
  }
}, 400);
watch(() => state.note, (note) => {
  if (note) {
    matchTagFromNote(note);
  } else if (tagAutoMatched) {
    // Note cleared — remove auto-matched tag + its auto-assigned category
    tagAutoMatched = false;
    suppressTagWatch = true;
    suppressCategoryWatch = true;
    state.tagId = null;
    state.categoryId = null;
  }
});

const emit = defineEmits<{ delete: [record: RecordWithRelations] }>();

const form = ref<{ submit: () => Promise<void>; errors: { message: string }[]; dirty: boolean }>();
const loading = ref(false);

const hasErrors = computed(() => !!form.value?.errors?.length);

/** Whether the form is in settlement mode (debt payment). */
const isSettlement = computed(() => state.type === "settlement");



/** Auto-assigns type based on category, then creates or updates. */
async function onSubmit() {
  loading.value = true;
  try {
    // Determine record type
    let type: CreateRecord["type"];
    if (isSettlement.value) {
      type = "settlement";
    } else {
      const selectedCategory = categories.value.find((c) => c.id === state.categoryId);
      type = selectedCategory?.name === INCOME_CATEGORY ? "income" : "expense";
    }

    // Clean up nullable fields: convert 0 to null for optional FKs
    const hasPeople = !!state.personIds?.length;
    const isManual = hasPeople && splitMode.value === "manual";

    // Auto-clear needsReview when a tag is assigned
    const resolvedTagId = isSettlement.value ? null : (state.tagId || null);
    const payload: CreateRecord = {
      ...state,
      type,
      categoryId: isSettlement.value ? null : (state.categoryId || null),
      tagId: resolvedTagId,
      needsReview: state.needsReview,
      personIds: hasPeople ? state.personIds : undefined,
      myShares: hasPeople && !isManual && !isSettlement.value ? (state.myShares ?? 1) : undefined,
      personShares: isManual
        ? (state.personIds ?? []).map((pid) => ({ personId: pid, amount: manualAmounts[pid] || 0 }))
        : undefined,
      note: state.note?.trim() || null,
    };

    if (props.record) {
      await recordsStore.updateRecord(props.record.id, payload);
    } else {
      await recordsStore.createRecord(payload);
      // Fire-and-forget feedback for keyword learning when created via parse
      if (props.parseLogId) {
        api.post("/records/parse/feedback", {
          parseLogId: props.parseLogId,
          finalResponse: payload,
        }).catch(() => {});
      }
    }
    open.value = false;
    useToast().add({
      title: props.record ? "Record updated" : "Record created",
      color: "success",
    });
  } catch (e: unknown) {
    useToast().add({
      title: e instanceof ApiError ? e.message : "Something went wrong",
      color: "error",
    });
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <UModal v-model:open="open" :title="isSettlement ? 'Record payment' : (record ? 'Edit record' : 'New record')">
    <template #body>
      <UForm ref="form" :schema="createRecordSchema" :state="state" class="space-y-4" @submit="onSubmit">
        <!-- Record type toggle -->
        <div class="flex gap-1">
          <UButton
            size="xs"
            :variant="!isSettlement ? 'solid' : 'ghost'"
            :color="!isSettlement ? 'primary' : 'neutral'"
            label="Expense"
            icon="i-lucide-receipt"
            @click="state.type = 'expense'"
          />
          <UButton
            size="xs"
            :variant="isSettlement ? 'solid' : 'ghost'"
            :color="isSettlement ? 'primary' : 'neutral'"
            label="Payment"
            icon="i-lucide-banknote"
            @click="state.type = 'settlement'"
          />
        </div>

        <div class="grid grid-cols-2 gap-4">
          <UFormField label="Amount" name="amount">
            <UInput v-model.number="state.amount" type="number" step="0.01" min="0" placeholder="0.00" class="w-full" />
          </UFormField>

          <UFormField label="Date" name="date">
            <UInput v-model="state.date" type="date" class="w-full" />
          </UFormField>
        </div>

        <UFormField label="Account" name="accountId">
          <USelectMenu
            v-model="state.accountId"
            :items="accountOptions"
            value-key="value"
            placeholder="Select account"
            class="w-full"
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
        </UFormField>

        <div v-if="!isSettlement" class="grid grid-cols-2 gap-4">
          <UFormField label="Category" name="categoryId">
            <USelectMenu
              :model-value="state.categoryId ?? 0"
              :items="categoryOptions"
              value-key="value"
              placeholder="None"
              class="w-full"
              @update:model-value="state.categoryId = $event === 0 ? null : $event"
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
              </template>
            </USelectMenu>
          </UFormField>

          <UFormField label="Tag" name="tagId">
            <USelectMenu
              :model-value="state.tagId ?? 0"
              :items="tagOptions"
              value-key="value"
              placeholder="None"
              class="w-full"
              @update:model-value="state.tagId = $event === 0 ? null : $event"
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
          </UFormField>
        </div>

        <UFormField label="Note" name="note">
          <UTextarea :model-value="state.note ?? undefined" placeholder="Optional note..." :rows="2" class="w-full" @update:model-value="state.note = $event || null" />
        </UFormField>

        <UCheckbox v-model="state.needsReview" label="Needs review" color="warning" />

        <UFormField :label="isSettlement ? 'Person' : 'People'" name="personIds" :required="isSettlement">
          <USelectMenu
            :model-value="state.personIds?.length ? state.personIds : (people.length ? [0] : [])"
            v-model:open="peopleOpen"
            v-model:search-term="peopleSearch"
            :items="peopleOptions"
            value-key="value"
            multiple
            :create-item="{ position: 'bottom' }"
            :placeholder="isSettlement ? 'Who paid you?' : 'Shared with...'"
            class="w-full"
            @update:model-value="onPeopleUpdate"
            @create="onCreatePerson"
          >
            <template #item-leading="{ item }">
              <div
                v-if="item.color"
                class="flex items-center justify-center size-5 rounded-full shrink-0 text-[10px] font-semibold"
                :style="{ backgroundColor: getColor(item.color ?? null)[100], color: getColor(item.color ?? null)[500] }"
              >
                {{ item.label.charAt(0) }}
              </div>
              <UIcon v-else name="i-lucide-x" class="size-4 text-muted shrink-0" />
            </template>
            <template #empty>
              <span class="text-sm text-dimmed">Type a name to add someone...</span>
            </template>
          </USelectMenu>
        </UFormField>

        <!-- Split controls (v-show keeps DOM stable, avoids closing people dropdown) -->
        <div v-show="showSplitControls" class="rounded-lg border border-default bg-muted/30 px-3 py-2.5 space-y-2.5">
          <!-- Mode toggle -->
          <div class="flex gap-1">
            <UButton
              size="xs"
              :variant="splitMode === 'auto' ? 'solid' : 'ghost'"
              :color="splitMode === 'auto' ? 'primary' : 'neutral'"
              label="Equal"
              @click="setSplitMode('auto')"
            />
            <UButton
              size="xs"
              :variant="splitMode === 'manual' ? 'solid' : 'ghost'"
              :color="splitMode === 'manual' ? 'primary' : 'neutral'"
              label="Manual"
              @click="setSplitMode('manual')"
            />
          </div>

          <!-- Auto mode: equal/weighted steppers -->
          <template v-if="splitMode === 'auto'">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <span class="text-xs text-muted uppercase tracking-wide">I cover</span>
                <div class="flex items-center gap-0.5">
                  <UButton
                    icon="i-lucide-minus"
                    size="xs"
                    variant="ghost"
                    color="neutral"
                    :disabled="(state.myShares ?? 1) <= 1"
                    @click="state.myShares = Math.max(1, (state.myShares ?? 1) - 1)"
                  />
                  <span class="w-5 text-center text-sm font-semibold tabular-nums">{{ state.myShares ?? 1 }}</span>
                  <UButton
                    icon="i-lucide-plus"
                    size="xs"
                    variant="ghost"
                    color="neutral"
                    @click="state.myShares = (state.myShares ?? 1) + 1"
                  />
                </div>
              </div>
              <div class="flex items-center gap-2">
                <span class="text-xs text-muted uppercase tracking-wide">Split</span>
                <div class="flex items-center gap-0.5">
                  <UButton
                    icon="i-lucide-minus"
                    size="xs"
                    variant="ghost"
                    color="neutral"
                    :disabled="splitSummary.totalShares <= (state.personIds?.length ?? 0) + 1"
                    @click="setTotalShares(splitSummary.totalShares - 1)"
                  />
                  <span class="w-5 text-center text-sm font-semibold tabular-nums">/{{ splitSummary.totalShares }}</span>
                  <UButton
                    icon="i-lucide-plus"
                    size="xs"
                    variant="ghost"
                    color="neutral"
                    @click="setTotalShares(splitSummary.totalShares + 1)"
                  />
                </div>
              </div>
            </div>
            <div class="flex items-center justify-between text-xs">
              <span class="text-muted">
                Each pays
                <span class="font-bold text-highlighted">{{ formatMoneyParts(splitSummary.perShare).integer }}{{ formatMoneyParts(splitSummary.perShare).decimal }}</span>
                {{ selectedCurrency }}
              </span>
              <span class="text-muted">
                You pay
                <span
                  class="font-bold"
                  :class="splitSummary.userPays > splitSummary.perShare ? 'text-red-600 dark:text-red-400' : splitSummary.userPays < splitSummary.perShare ? 'text-teal-600 dark:text-teal-400' : 'text-highlighted'"
                >
                  {{ formatMoneyParts(splitSummary.userPays).integer }}{{ formatMoneyParts(splitSummary.userPays).decimal }}
                </span>
                {{ selectedCurrency }}
                <span v-if="(state.myShares ?? 1) > 1" class="text-red-600 dark:text-red-400 font-bold">&times;{{ (state.myShares ?? 1) }}</span>
              </span>
            </div>
          </template>

          <!-- Manual mode: per-person amount inputs including "Me" -->
          <template v-else>
            <div class="space-y-1.5">
              <!-- "Me" row -->
              <div class="flex items-center gap-2">
                <span class="text-sm text-default w-24 truncate font-medium">Me</span>
                <UInput
                  :model-value="manualAmounts[0] ?? 0"
                  type="number"
                  step="0.01"
                  min="0"
                  size="xs"
                  class="flex-1"
                  @update:model-value="manualAmounts[0] = Number($event) || 0"
                />
                <span class="text-xs text-muted w-10">{{ selectedCurrency }}</span>
              </div>
              <!-- Other people rows -->
              <div
                v-for="pid in (state.personIds ?? [])"
                :key="pid"
                class="flex items-center gap-2"
              >
                <span class="text-sm text-default w-24 truncate">{{ people.find((p) => p.id === pid)?.name }}</span>
                <UInput
                  :model-value="manualAmounts[pid] ?? 0"
                  type="number"
                  step="0.01"
                  min="0"
                  size="xs"
                  class="flex-1"
                  @update:model-value="manualAmounts[pid] = Number($event) || 0"
                />
                <span class="text-xs text-muted w-10">{{ selectedCurrency }}</span>
              </div>
            </div>
            <!-- Total vs record amount -->
            <div class="flex items-center justify-between text-xs">
              <span :class="manualOverflow ? 'text-error' : 'text-muted'">
                Total: <span class="font-bold" :class="manualOverflow ? '' : 'text-highlighted'">{{ formatMoneyParts(manualTotal).integer }}{{ formatMoneyParts(manualTotal).decimal }}</span>
                / {{ formatMoneyParts(state.amount).integer }}{{ formatMoneyParts(state.amount).decimal }} {{ selectedCurrency }}
              </span>
              <span v-if="manualTotal !== state.amount && !manualOverflow" class="text-amber-600 dark:text-amber-400">
                {{ formatMoneyParts(state.amount - manualTotal).integer }}{{ formatMoneyParts(state.amount - manualTotal).decimal }} remaining
              </span>
            </div>
          </template>
        </div>

        <button type="submit" hidden />
      </UForm>
    </template>

    <template #footer>
      <UButton v-if="record" label="Delete" icon="i-lucide-trash-2" variant="outline" color="error" @click="emit('delete', record)" />
      <UButton label="Cancel" variant="ghost" color="neutral" class="ml-auto" @click="open = false" />
      <UButton
        :label="isSettlement ? 'Record payment' : (record ? 'Save changes' : 'Create record')"
        :loading="loading"
        :disabled="hasErrors || (!form?.dirty && splitMode !== 'manual' && state.needsReview === props.record?.needsReview) || (isSettlement && !state.personIds?.length) || (splitMode === 'manual' && manualTotal !== state.amount)"
        @click="form?.submit()"
      />
    </template>
  </UModal>
</template>
