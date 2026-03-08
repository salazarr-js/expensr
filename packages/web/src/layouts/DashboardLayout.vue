<script setup lang="ts">
import { computed } from 'vue'
import type { NavigationMenuItem, DropdownMenuItem } from '@nuxt/ui'

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
      class="bg-elevated/25"
      :ui="{ footer: 'lg:border-t lg:border-default' }"
    >
      <template #header="{ collapsed }">
        <div class="flex items-center w-full" :class="collapsed ? 'justify-center' : 'justify-between'">
          <span v-if="!collapsed" class="font-heading text-lg font-bold text-highlighted">
            Expensr
          </span>

          <span v-else class="font-heading text-lg font-bold text-highlighted">
            E
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
