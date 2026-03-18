<script setup lang="ts">
import { reactive, ref, computed, watch, nextTick } from "vue";
import type { CategoryWithTagCount, Tag, CreateCategory } from "@slzr/expensr-shared";
import { createCategorySchema } from "@slzr/expensr-shared";
import { useCategoriesStore } from "@/stores/categories";
import { ApiError } from "@/composables/useApi";
import { IconPicker } from "@/components/IconPicker";
import { ColorPicker } from "@/components/ColorPicker";
import { DEFAULT_COLOR } from "@/utils/colors";
import { useAlertDialog } from "@/composables/useAlertDialog";

const props = defineProps<{
  category?: CategoryWithTagCount;
  /** Tags for this category, passed from the parent page. */
  tags?: Tag[];
}>();

const open = defineModel<boolean>("open", { required: true });

const categoriesStore = useCategoriesStore();
const alert = useAlertDialog();

const DEFAULT_ICON = "i-lucide-tag";

const defaultState = (): CreateCategory => ({
  name: "",
  color: null,
  icon: null,
});

const state = reactive<CreateCategory>(defaultState());

const emit = defineEmits<{ delete: [category: CategoryWithTagCount] }>();

const form = ref<{ submit: () => Promise<void>; errors: { message: string }[]; dirty: boolean }>();
const loading = ref(false);
const nameError = ref("");

const hasErrors = computed(() => !!form.value?.errors?.length);

/** Tracks whether any category field has changed from its original value. */
const initialState = ref<CreateCategory>(defaultState());
const formChanged = computed(() => {
  return state.name !== initialState.value.name
    || state.color !== initialState.value.color
    || state.icon !== initialState.value.icon;
});

/** Local copy of tags for this category, updated as tags are added/deleted. */
const localTags = ref<Tag[]>([]);

/** New tag input state. */
const newTagName = ref("");
const newTagIcon = ref<string | null>(null);
const addingTag = ref(false);
const tagError = ref("");
const tagInputRef = ref<{ $el: HTMLElement } | null>(null);
const tagsChanged = ref(false);

watch(open, (isOpen) => {
  if (!isOpen) return;
  nameError.value = "";
  tagError.value = "";
  newTagName.value = "";
  newTagIcon.value = null;
  tagsChanged.value = false;
  editingTagId.value = null;
  localTags.value = props.tags ? [...props.tags] : [];
  if (props.category) {
    const values = {
      name: props.category.name,
      color: props.category.color,
      icon: props.category.icon,
    };
    Object.assign(state, values);
    initialState.value = { ...values };
  } else {
    const values = defaultState();
    Object.assign(state, values);
    initialState.value = { ...values };
  }
});

const isEditing = computed(() => !!props.category);

/** Validates, applies defaults for missing color/icon, then creates or updates. */
async function onSubmit() {
  loading.value = true;
  nameError.value = "";
  try {
    if (props.category) {
      await categoriesStore.updateCategory(props.category.id, { ...state });
    } else {
      const payload = {
        ...state,
        color: state.color || DEFAULT_COLOR,
        icon: state.icon || DEFAULT_ICON,
      };
      await categoriesStore.createCategory(payload);
    }
    open.value = false;
    useToast().add({
      title: props.category ? "Category updated" : "Category created",
      color: "success",
    });
  } catch (e: unknown) {
    if (e instanceof ApiError && e.code === "DUPLICATE_NAME") {
      nameError.value = e.message;
      return;
    }
    useToast().add({
      title: e instanceof Error ? e.message : "Something went wrong",
      color: "error",
    });
  } finally {
    loading.value = false;
  }
}

/** Tag currently being edited, null when adding new. */
const editingTagId = ref<number | null>(null);
const isEditingTag = computed(() => editingTagId.value !== null);

/** Populates the tag input with the selected tag's data for editing. */
function startEditTag(tag: Tag) {
  editingTagId.value = tag.id;
  newTagName.value = tag.name;
  newTagIcon.value = tag.icon;
  tagError.value = "";
  nextTick(() => {
    tagInputRef.value?.$el?.querySelector("input")?.focus();
  });
}

/** Clears the edit state and resets the tag input. */
function cancelEditTag() {
  editingTagId.value = null;
  newTagName.value = "";
  newTagIcon.value = null;
  tagError.value = "";
}

/** Saves the edited tag name/icon via API. */
async function saveEditTag() {
  const tag = localTags.value.find((t) => t.id === editingTagId.value);
  if (!tag || !newTagName.value.trim()) return;
  addingTag.value = true;
  tagError.value = "";
  try {
    const updated = await categoriesStore.updateTag(tag.id, {
      name: newTagName.value.trim(),
      icon: newTagIcon.value || null,
    });
    const idx = localTags.value.findIndex((t) => t.id === tag.id);
    if (idx !== -1) localTags.value[idx] = { ...localTags.value[idx], ...updated };
    editingTagId.value = null;
    newTagName.value = "";
    newTagIcon.value = null;
    tagsChanged.value = true;
  } catch (e: unknown) {
    if (e instanceof ApiError && e.code === "DUPLICATE_NAME") {
      tagError.value = e.message;
      return;
    }
    useToast().add({
      title: e instanceof Error ? e.message : "Failed to update tag",
      color: "error",
    });
  } finally {
    addingTag.value = false;
  }
}

/** Handles Escape on the tag input — cancels edit or lets modal close. */
function onTagInputEscape(e: KeyboardEvent) {
  if (isEditingTag.value) {
    e.stopPropagation();
    cancelEditTag();
  }
}

/** Handles Enter on the tag input — adds, saves edit, or submits form. */
function onTagInputEnter() {
  if (!newTagName.value.trim()) {
    form?.value?.submit();
  } else if (isEditingTag.value) {
    saveEditTag();
  } else {
    addTag();
  }
}

/** Creates a tag under this category via API and adds it to the local list. */
async function addTag() {
  if (!props.category || !newTagName.value.trim()) return;
  addingTag.value = true;
  tagError.value = "";
  try {
    const tag = await categoriesStore.createTag(props.category.id, {
      name: newTagName.value.trim(),
      icon: newTagIcon.value || null,
    });
    localTags.value.push(tag);
    newTagName.value = "";
    newTagIcon.value = null;
    tagsChanged.value = true;
  } catch (e: unknown) {
    if (e instanceof ApiError && e.code === "DUPLICATE_NAME") {
      tagError.value = e.message;
      return;
    }
    useToast().add({
      title: e instanceof Error ? e.message : "Failed to create tag",
      color: "error",
    });
  } finally {
    addingTag.value = false;
  }
}

/** Confirms then deletes a tag. */
async function deleteTag(tag: Tag) {
  const confirmed = await alert.destructive({
    title: `Delete "${tag.name}"?`,
    message: "This tag will be removed from all records.",
    onConfirm: () => categoriesStore.deleteTag(tag.id, props.category!.id),
  });
  if (confirmed) {
    localTags.value = localTags.value.filter((t) => t.id !== tag.id);
    tagsChanged.value = true;
  }
}
</script>

<template>
  <UModal v-model:open="open" :title="category ? 'Edit category' : 'New category'">
    <template #body>
      <UForm ref="form" :schema="createCategorySchema" :state="state" class="space-y-4" @submit="onSubmit">
        <UFormField label="Name" name="name" :error="nameError || undefined">
          <UInput v-model="state.name" placeholder="Food & Dining" class="w-full" @input="nameError = ''" />
        </UFormField>

        <div class="grid grid-cols-2 gap-4">
          <UFormField label="Color" name="color">
            <ColorPicker v-model="state.color" />
          </UFormField>

          <UFormField label="Icon" name="icon">
            <IconPicker v-model="state.icon" />
          </UFormField>
        </div>
      </UForm>

      <!-- Tags section (edit mode only) -->
      <div v-if="isEditing" class="mt-5 pt-5 border-t border-muted">
        <h4 class="text-xs uppercase tracking-wider text-muted font-medium mb-2">Tags</h4>

        <!-- Tag input (shared for add & edit) -->
        <div class="flex items-center gap-1.5">
          <UInput
            ref="tagInputRef"
            v-model="newTagName"
            :placeholder="isEditingTag ? 'Edit tag...' : 'Add tag...'"
            size="sm"
            class="flex-1 min-w-0"
            :error="!!tagError"
            @keydown.enter.prevent="onTagInputEnter"
            @keydown.escape="onTagInputEscape"
            @input="tagError = ''"
          />
          <IconPicker v-model="newTagIcon" compact class="shrink-0" />
          <UButton
            :icon="isEditingTag ? 'i-lucide-check' : 'i-lucide-plus'"
            size="sm"
            square
            :loading="addingTag"
            :disabled="!newTagName.trim()"
            @click="isEditingTag ? saveEditTag() : addTag()"
          />
          <UButton
            v-if="isEditingTag"
            icon="i-lucide-x"
            size="sm"
            square
            variant="ghost"
            color="neutral"
            @click="cancelEditTag"
          />
        </div>
        <p v-if="tagError" class="text-xs text-error mt-1">{{ tagError }}</p>

        <!-- Tag list -->
        <div v-if="localTags.length" class="flex flex-wrap gap-1.5 mt-3">
          <UBadge
            v-for="tag in localTags"
            :key="tag.id"
            variant="subtle"
            :color="editingTagId === tag.id ? 'primary' : 'neutral'"
            size="md"
            class="cursor-pointer"
            @click="startEditTag(tag)"
          >
            <UIcon :name="tag.icon || 'i-lucide-hash'" class="size-3" />
            {{ tag.name }}
            <UTooltip text="Remove tag" :portal="false">
              <UButton
                icon="i-lucide-x"
                size="xs"
                variant="ghost"
                color="neutral"
                square
                class="rounded-full size-4"
                @click.stop="deleteTag(tag)"
              />
            </UTooltip>
          </UBadge>
        </div>

        <p v-else class="text-xs text-muted mt-2">No tags yet.</p>
      </div>
    </template>

    <template #footer>
      <UButton v-if="category" label="Delete" icon="i-lucide-trash-2" variant="outline" color="error" @click="emit('delete', category)" />
      <UButton label="Cancel" variant="ghost" color="neutral" @click="open = false" class="ml-auto" />
      <UButton :label="category ? 'Save changes' : 'Create category'" :loading="loading" :disabled="hasErrors || !(formChanged || tagsChanged)" @click="form?.submit()" />
    </template>
  </UModal>
</template>
