<template>
  <UDashboardPanel>
    <template #header>
      <UDashboardNavbar title="Accounts">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>

        <template #right>
          <UButton icon="i-lucide-plus" label="New account" />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="flex flex-col items-center text-center mt-[25vh]">
        <UIcon name="i-lucide-wallet" class="mb-4 size-16 text-dimmed/40" />
        <h2 class="text-lg font-semibold text-highlighted">No accounts yet</h2>
        <p class="mt-1 text-sm text-muted">Create your first account to start tracking expenses.</p>
        <UButton icon="i-lucide-plus" label="New account" class="mt-6" />
      </div>
    </template>
  </UDashboardPanel>
</template>
