<template>
  <UDashboardPanel>
    <template #header>
      <UDashboardNavbar title="Categories">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>

        <template #right>
          <UButton icon="i-lucide-plus" label="New category" />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="flex flex-col items-center text-center mt-[25vh]">
        <UIcon name="i-lucide-tags" class="mb-4 size-16 text-dimmed/40" />
        <h2 class="text-lg font-semibold text-highlighted">No categories yet</h2>
        <p class="mt-1 text-sm text-muted">Create categories to organize your expenses.</p>
        <UButton icon="i-lucide-plus" label="New category" class="mt-6" />
      </div>
    </template>
  </UDashboardPanel>
</template>
