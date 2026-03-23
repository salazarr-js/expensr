<script setup lang="ts">
import { reactive, ref, computed, watch } from "vue";
import { storeToRefs } from "pinia";
import type { RecordWithRelations, CreateRecord, Tag } from "@slzr/expensr-shared";
import { createRecordSchema } from "@slzr/expensr-shared";
import { useRecordsStore } from "@/stores/records";
import { useAccountsStore } from "@/stores/accounts";
import { useCategoriesStore } from "@/stores/categories";
import { ApiError } from "@/composables/useApi";
import { getColor } from "@/utils/colors";

const props = defineProps<{
  record?: RecordWithRelations;
  initialData?: Partial<CreateRecord>;
}>();

const open = defineModel<boolean>("open", { required: true });

const recordsStore = useRecordsStore();
const accountsStore = useAccountsStore();
const categoriesStore = useCategoriesStore();
const { accounts } = storeToRefs(accountsStore);
const { categories, tagsByCategory } = storeToRefs(categoriesStore);

const INCOME_CATEGORY = "Income";

/** Suppress watchers during programmatic state changes (form init, auto-assign). */
let suppressTagWatch = false;
let suppressCategoryWatch = false;

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
  personId: null,
  note: null,
});

const state = reactive<CreateRecord>(defaultState());

watch(open, (isOpen) => {
  if (!isOpen) return;
  accountsStore.fetchAccountsByUsage();
  categoriesStore.fetchAll();
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
      personId: props.record.personId,
      note: props.record.note,
    });
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
  if (!tagId) return;
  const tag = allTags.value.find((t) => t.id === tagId);
  if (tag?.categoryId) {
    suppressCategoryWatch = true;
    state.categoryId = tag.categoryId;
  }
});

const emit = defineEmits<{ delete: [record: RecordWithRelations] }>();

const form = ref<{ submit: () => Promise<void>; errors: { message: string }[]; dirty: boolean }>();
const loading = ref(false);

const hasErrors = computed(() => !!form.value?.errors?.length);

function getCategoryColor(colorName: string | null | undefined) {
  return getColor(colorName ?? null);
}

/** Auto-assigns type based on category, then creates or updates. */
async function onSubmit() {
  loading.value = true;
  try {
    // Auto-assign type based on category
    const selectedCategory = categories.value.find((c) => c.id === state.categoryId);
    const type = selectedCategory?.name === INCOME_CATEGORY ? "income" : "expense";

    // Clean up nullable fields: convert 0 to null for optional FKs
    const payload: CreateRecord = {
      ...state,
      type,
      categoryId: state.categoryId || null,
      tagId: state.tagId || null,
      personId: state.personId || null,
      note: state.note?.trim() || null,
    };

    if (props.record) {
      await recordsStore.updateRecord(props.record.id, payload);
    } else {
      await recordsStore.createRecord(payload);
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
  <UModal v-model:open="open" :title="record ? 'Edit record' : 'New record'">
    <template #body>
      <UForm ref="form" :schema="createRecordSchema" :state="state" class="space-y-4" @submit="onSubmit">
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
                :style="{ backgroundColor: getCategoryColor(item.color)[100], color: getCategoryColor(item.color)[500] }"
              >
                <UIcon :name="item.icon" class="size-3" />
              </div>
              <span>{{ item.label }}</span>
            </template>
          </USelectMenu>
        </UFormField>

        <div class="grid grid-cols-2 gap-4">
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
                  :style="{ backgroundColor: getCategoryColor(item.color)[100], color: getCategoryColor(item.color)[500] }"
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
                  :style="{ backgroundColor: getCategoryColor(item.color)[100], color: getCategoryColor(item.color)[500] }"
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

        <button type="submit" hidden />
      </UForm>
    </template>

    <template #footer>
      <UButton v-if="record" label="Delete" icon="i-lucide-trash-2" variant="outline" color="error" @click="emit('delete', record)" />
      <UButton label="Cancel" variant="ghost" color="neutral" class="ml-auto" @click="open = false" />
      <UButton :label="record ? 'Save changes' : 'Create record'" :loading="loading" :disabled="hasErrors || !form?.dirty" @click="form?.submit()" />
    </template>
  </UModal>
</template>
