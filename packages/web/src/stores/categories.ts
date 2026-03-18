import { ref } from "vue";
import { defineStore } from "pinia";
import type {
  CategoryWithTagCount,
  CreateCategory,
  UpdateCategory,
  Tag,
  TagWithCategory,
  CreateTag,
  UpdateTag,
} from "@slzr/expensr-shared";
import { useApi } from "@/composables/useApi";

export const useCategoriesStore = defineStore("categories", () => {
  const categories = ref<CategoryWithTagCount[]>([]);
  /** All tags grouped by categoryId for inline display. */
  const tagsByCategory = ref<Record<number, Tag[]>>({});
  const loading = ref(false);
  const error = ref(false);
  const api = useApi();

  /** Loads all categories from the API, sorted by name, with tag counts. */
  async function fetchCategories() {
    loading.value = true;
    error.value = false;
    try {
      categories.value = await api.get<CategoryWithTagCount[]>("/categories");
    } catch {
      error.value = true;
      useToast().add({ title: "Failed to load categories", color: "error" });
    } finally {
      loading.value = false;
    }
  }

  /** Fetches all tags and groups them by categoryId. */
  async function fetchTags() {
    try {
      const allTags = await api.get<TagWithCategory[]>("/categories/tags");
      const grouped: Record<number, Tag[]> = {};
      for (const tag of allTags) {
        const catId = tag.categoryId;
        if (catId == null) continue;
        if (!grouped[catId]) grouped[catId] = [];
        grouped[catId].push(tag);
      }
      tagsByCategory.value = grouped;
    } catch {
      // Tags are supplementary — silent fail, categories still show
    }
  }

  /** Fetches both categories and tags concurrently. */
  async function fetchAll() {
    await Promise.all([fetchCategories(), fetchTags()]);
  }

  /** Creates a new category and appends it to the local list. */
  async function createCategory(data: CreateCategory) {
    const category = await api.post<CategoryWithTagCount>("/categories", data);
    // New category has no tags
    category.tagCount = category.tagCount ?? 0;
    categories.value.push(category);
    return category;
  }

  /** Patches a category and replaces it in the local list. */
  async function updateCategory(id: number, data: UpdateCategory) {
    const updated = await api.put<CategoryWithTagCount>(`/categories/${id}`, data);
    const index = categories.value.findIndex((c) => c.id === id);
    const existing = categories.value[index];
    if (index !== -1 && existing) {
      // Preserve the tag count since the update endpoint doesn't return it
      updated.tagCount = updated.tagCount ?? existing.tagCount;
      categories.value[index] = updated;
    }
    return updated;
  }

  /** Deletes a category and removes it from the local list. */
  async function deleteCategory(id: number) {
    await api.del(`/categories/${id}`);
    categories.value = categories.value.filter((c) => c.id !== id);
  }

  /** Creates a tag under a category. */
  async function createTag(categoryId: number, data: Omit<CreateTag, "categoryId">) {
    const tag = await api.post<Tag>(`/categories/${categoryId}/tags`, data);
    // Increment tag count on the parent category
    const cat = categories.value.find((c) => c.id === categoryId);
    if (cat) cat.tagCount++;
    return tag;
  }

  /** Updates a tag by ID. */
  async function updateTag(id: number, data: UpdateTag) {
    const tag = await api.put<Tag>(`/categories/tags/${id}`, data);
    return tag;
  }

  /** Deletes a tag and decrements the parent category tag count. */
  async function deleteTag(id: number, categoryId: number) {
    await api.del(`/categories/tags/${id}`);
    const cat = categories.value.find((c) => c.id === categoryId);
    if (cat && cat.tagCount > 0) cat.tagCount--;
  }

  return {
    categories,
    tagsByCategory,
    loading,
    error,
    fetchAll,
    fetchCategories,
    fetchTags,
    createCategory,
    updateCategory,
    deleteCategory,
    createTag,
    updateTag,
    deleteTag,
  };
});
