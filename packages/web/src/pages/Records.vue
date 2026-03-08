<template>
  <UDashboardPanel>
    <template #header>
      <UDashboardNavbar title="Records">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>

        <template #right>
          <UButton icon="i-lucide-plus" label="New record" />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="flex flex-col items-center text-center mt-[25vh]">
        <UIcon name="i-lucide-receipt" class="mb-4 size-16 text-dimmed/40" />
        <h2 class="text-lg font-semibold text-highlighted">No records yet</h2>
        <p class="mt-1 text-sm text-muted">Start by adding your first expense or income record.</p>
        <UButton icon="i-lucide-plus" label="New record" class="mt-6" />
      </div>
    </template>
  </UDashboardPanel>
</template>
