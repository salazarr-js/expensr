<script setup lang="ts">
import { ref } from "vue";
import { QuickRecordModal } from "@/components/QuickRecordModal";

const showQuickRecord = ref(false);
</script>

<template>
  <UDashboardPanel>
    <template #header>
      <UDashboardNavbar title="Dashboard">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <UButton icon="i-lucide-sparkles" label="Quick record" @click="showQuickRecord = true" />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="flex flex-col items-center text-center mt-[25vh]">
        <UIcon name="i-lucide-layout-dashboard" class="mb-4 size-16 text-dimmed/40" />
        <h2 class="text-lg font-semibold text-highlighted">Welcome to Expensr</h2>
        <p class="mt-1 text-sm text-muted">Your dashboard will show account balances, spending summaries, and recent activity.</p>
      </div>
    </template>
  </UDashboardPanel>

  <QuickRecordModal v-model:open="showQuickRecord" />
</template>
