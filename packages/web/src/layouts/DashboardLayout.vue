<script setup lang="ts">
import { computed } from 'vue'
import type { NavigationMenuItem } from '@nuxt/ui'

/** Sidebar navigation links for the dashboard. */
const items = computed<NavigationMenuItem[]>(() => [
  {
    label: 'Dashboard',
    icon: 'i-lucide-layout-dashboard',
    to: '/dashboard',
    exact: true,
  },
  {
    label: 'Records',
    icon: 'i-lucide-receipt',
    to: '/dashboard/records',
  },
  {
    label: 'Accounts',
    icon: 'i-lucide-wallet',
    to: '/dashboard/accounts',
  },
  {
    label: 'Categories',
    icon: 'i-lucide-tags',
    to: '/dashboard/categories',
  },
  {
    label: 'People',
    icon: 'i-lucide-users',
    to: '/dashboard/people',
  },
  {
    label: 'Keywords',
    icon: 'i-lucide-book-open',
    to: '/dashboard/keywords',
  },
  {
    label: 'Settings',
    icon: 'i-lucide-settings',
    to: '/dashboard/settings',
  },
])

</script>

<template>
  <UDashboardGroup unit="rem" storage="local">
    <UDashboardSidebar
      id="default"
      collapsible
    >
      <template #header="{ collapsed }">
        <div class="flex items-center gap-2">
          <div class="flex items-center justify-center size-8 rounded-lg bg-primary shrink-0">
            <UIcon name="i-lucide-wallet" class="size-5 text-white" />
          </div>
          <span v-if="!collapsed" class="font-heading text-lg font-bold text-highlighted">
            Expensr
          </span>
        </div>
      </template>

      <template #default="{ collapsed }">
        <UNavigationMenu
          :collapsed="collapsed"
          :items="items"
          orientation="vertical"
          tooltip
          popover
        />
      </template>

      <template #footer="{ collapsed }">
        <div v-if="collapsed" class="flex justify-center">
          <UColorModeButton />
        </div>
        <UColorModeSelect v-else class="w-full" />
      </template>
    </UDashboardSidebar>

    <RouterView />
  </UDashboardGroup>
</template>
