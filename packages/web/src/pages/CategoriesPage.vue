<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { storeToRefs } from "pinia";
import type { CategoryWithTagCount, Tag } from "@slzr/expensr-shared";
import { useCategoriesStore } from "@/stores/categories";
import { getColor } from "@/utils/colors";
import { CategoryFormModal } from "@/components/CategoryFormModal";
import { useAlertDialog } from "@/composables/useAlertDialog";

const categoriesStore = useCategoriesStore();
const { categories, tagsByCategory, loading, error } = storeToRefs(categoriesStore);
const alert = useAlertDialog();

/** Total tag count across all categories. */
const totalTags = computed(() => categories.value.reduce((sum, c) => sum + c.tagCount, 0));

const showCategoryModal = ref(false);
const selectedCategory = ref<CategoryWithTagCount | undefined>();

/** Returns the category icon or a default fallback. */
function getCategoryIcon(category: CategoryWithTagCount) {
  return category.icon || "i-lucide-tag";
}

/** Returns the tags for a given category from the store map. */
function getTagsForCategory(categoryId: number): Tag[] {
  return tagsByCategory.value[categoryId] ?? [];
}

/** Opens the category modal in create mode. */
function openCreateCategory() {
  selectedCategory.value = undefined;
  showCategoryModal.value = true;
}

/** Opens the category modal in edit mode for the given category. */
function openEditCategory(category: CategoryWithTagCount) {
  selectedCategory.value = category;
  showCategoryModal.value = true;
}

/** Prompts for confirmation then deletes the category and its tags. */
async function deleteCategory(category: CategoryWithTagCount) {
  const categoryTags = getTagsForCategory(category.id);

  const message = category.tagCount > 0
    ? `This will also delete ${category.tagCount} tag${category.tagCount === 1 ? "" : "s"}:`
    : "This action cannot be undone.";

  const confirmed = await alert.destructive({
    title: `Delete ${category.name}?`,
    message,
    chips: categoryTags.map((t) => t.name),
    onConfirm: () => categoriesStore.deleteCategory(category.id),
  });
  if (confirmed) {
    showCategoryModal.value = false;
    useToast().add({ title: "Category deleted", color: "success" });
  }
}

/** Reload data after modal closes only if changes were made. */
function onCategoryModalClose(val: boolean) {
  showCategoryModal.value = val;
  if (!val) {
    categoriesStore.fetchAll();
  }
}

onMounted(categoriesStore.fetchAll);
</script>

<template>
  <UDashboardPanel>
    <template #header>
      <UDashboardNavbar title="Categories">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>

        <template #right>
          <UButton icon="i-lucide-plus" label="New category" @click="openCreateCategory" />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <!-- Loading -->
      <div v-if="loading && !categories.length" class="flex items-center justify-center mt-[25vh]">
        <UIcon name="i-lucide-loader-circle" class="size-8 text-dimmed animate-spin" />
      </div>

      <!-- Error state -->
      <div v-else-if="error && !categories.length" class="flex flex-col items-center text-center mt-[25vh]">
        <UIcon name="i-lucide-wifi-off" class="mb-4 size-16 text-dimmed/40" />
        <h2 class="text-lg font-semibold text-highlighted">Failed to load categories</h2>
        <p class="mt-1 text-sm text-muted">Something went wrong. Check your connection and try again.</p>
        <UButton icon="i-lucide-refresh-cw" label="Retry" class="mt-6" :loading="loading" @click="categoriesStore.fetchAll" />
      </div>

      <!-- Empty state -->
      <div v-else-if="!categories.length" class="flex flex-col items-center text-center mt-[25vh]">
        <UIcon name="i-lucide-tags" class="mb-4 size-16 text-dimmed/40" />
        <h2 class="text-lg font-semibold text-highlighted">No categories yet</h2>
        <p class="mt-1 text-sm text-muted">Create categories to organize your expenses.</p>
        <UButton icon="i-lucide-plus" label="New category" class="mt-6" @click="openCreateCategory" />
      </div>

      <!-- Category grid -->
      <div v-else>
        <!-- Summary -->
        <div class="flex justify-end items-center gap-2.5 mb-4">
          <div class="text-right">
            <p class="text-4xl leading-none font-heading font-extrabold tabular-nums text-zinc-500 dark:text-zinc-400">{{ categories.length }}</p>
            <p class="text-[10px] text-zinc-600 dark:text-zinc-300 uppercase tracking-wide -mt-0.5">categories</p>
          </div>
          <div class="size-1 rounded-full bg-zinc-400 dark:bg-zinc-500 shrink-0" />
          <div class="text-right">
            <p class="text-4xl leading-none font-heading font-extrabold tabular-nums text-zinc-500 dark:text-zinc-400">{{ totalTags }}</p>
            <p class="text-[10px] text-zinc-600 dark:text-zinc-300 uppercase tracking-wide -mt-0.5">tags</p>
          </div>
        </div>

        <div class="grid gap-4 lg:gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 3xl:grid-cols-5">
          <UCard
            v-for="category in categories"
            :key="category.id"
            tabindex="0"
            role="button"
            class="cursor-pointer hover:ring-1 hover:ring-default-border focus:ring-1 focus:ring-primary focus:outline-none transition-shadow"
            @click="openEditCategory(category)"
            @keydown.enter="openEditCategory(category)"
          >
            <div class="flex items-center gap-3">
              <div
                class="flex items-center justify-center size-10 rounded-lg shrink-0"
                :style="{ backgroundColor: getColor(category.color)[100], color: getColor(category.color)[500] }"
              >
                <UIcon :name="getCategoryIcon(category)" class="size-5" />
              </div>
              <div class="min-w-0 flex-1">
                <h3 class="text-sm font-semibold text-highlighted truncate">{{ category.name }}</h3>
                <p class="text-xs text-muted">{{ category.tagCount }} tag{{ category.tagCount === 1 ? '' : 's' }}</p>
              </div>
            </div>

            <!-- Tags -->
            <template v-if="tagsByCategory[category.id]?.length">
              <div class="mt-3 flex flex-wrap gap-1.5">
                <UBadge
                  v-for="tag in tagsByCategory[category.id]"
                  :key="tag.id"
                  variant="subtle"
                  color="neutral"
                >
                  <UIcon :name="tag.icon || 'i-lucide-hash'" class="size-3" />
                  {{ tag.name }}
                </UBadge>
              </div>
            </template>
          </UCard>
        </div>
      </div>
    </template>
  </UDashboardPanel>

  <CategoryFormModal
    :open="showCategoryModal"
    :category="selectedCategory"
    :tags="selectedCategory ? getTagsForCategory(selectedCategory.id) : []"
    @update:open="onCategoryModalClose"
    @delete="deleteCategory"
  />
</template>
