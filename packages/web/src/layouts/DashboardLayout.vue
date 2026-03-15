<script setup lang="ts">
import { computed } from 'vue'
import type { NavigationMenuItem, DropdownMenuItem } from '@nuxt/ui'

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
    label: 'Settings',
    icon: 'i-lucide-settings',
    to: '/dashboard/settings',
  },
])

/** Dropdown menu items for the user avatar button in the sidebar footer. */
const userMenuItems = computed<DropdownMenuItem[][]>(() => [
  [{ type: 'label', label: 'User' }],
  [
    { label: 'Profile', icon: 'i-lucide-user' },
    { label: 'Settings', icon: 'i-lucide-settings', to: '/dashboard/settings' },
  ],
  [
    { label: 'Log out', icon: 'i-lucide-log-out' },
  ],
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
        />
      </template>

      <template #footer="{ collapsed }">
        <UDropdownMenu
          :items="userMenuItems"
          :content="{ align: 'center', collisionPadding: 12 }"
          :ui="{ content: collapsed ? 'w-48' : 'w-(--reka-dropdown-menu-trigger-width)' }"
        >
          <UButton
            :label="collapsed ? undefined : 'User'"
            :trailing-icon="collapsed ? undefined : 'i-lucide-chevrons-up-down'"
            color="neutral"
            variant="ghost"
            block
            :square="collapsed"
            class="data-[state=open]:bg-elevated"
            :ui="{ trailingIcon: 'text-dimmed' }"
          >
            <template #leading>
              <UAvatar src="" alt="User" icon="i-lucide-user" size="2xs" />
            </template>
          </UButton>
        </UDropdownMenu>
      </template>
    </UDashboardSidebar>

    <RouterView />
  </UDashboardGroup>
</template>
