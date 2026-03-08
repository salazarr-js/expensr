<template>
  <UDashboardPanel>
    <template #header>
      <UDashboardNavbar title="People">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <UButton icon="i-lucide-plus" label="New person" />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="flex flex-col items-center text-center mt-[25vh]">
        <UIcon name="i-lucide-users" class="mb-4 size-16 text-dimmed/40" />
        <h2 class="text-lg font-semibold text-highlighted">No people yet</h2>
        <p class="mt-1 text-sm text-muted">Add people to track shared expenses.</p>
        <UButton icon="i-lucide-plus" label="New person" class="mt-6" />
      </div>
    </template>
  </UDashboardPanel>
</template>
