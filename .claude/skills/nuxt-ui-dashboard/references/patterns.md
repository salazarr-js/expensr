# Dashboard Patterns

Practical, copy-pasteable patterns for building dashboards with Nuxt UI 4 in Vue (Vite).

## Navigation menu

Use grouped arrays (`NavigationMenuItem[][]`) for visual sections with automatic spacing:

```ts
import { computed } from 'vue'
import type { NavigationMenuItem } from '@nuxt/ui'

const links = computed<NavigationMenuItem[][]>(() => [
  // Primary nav
  [
    { label: 'Home', icon: 'i-lucide-house', to: '/' },
    { label: 'Inbox', icon: 'i-lucide-inbox', to: '/inbox', badge: '4' },
    { label: 'Customers', icon: 'i-lucide-users', to: '/customers' },
    {
      label: 'Settings',
      icon: 'i-lucide-settings',
      to: '/settings',
      defaultOpen: true,
      type: 'trigger',
      children: [
        { label: 'General', to: '/settings', exact: true },
        { label: 'Members', to: '/settings/members' },
        { label: 'Notifications', to: '/settings/notifications' },
      ],
    },
  ],
  // External links (pushed to bottom with mt-auto)
  [
    { label: 'Feedback', icon: 'i-lucide-message-circle', to: 'https://example.com', target: '_blank' },
    { label: 'Help & Support', icon: 'i-lucide-info', to: 'https://example.com', target: '_blank' },
  ],
])
```

Render multiple groups in the sidebar with `mt-auto` on the last to push it down:

```vue
<template #default="{ collapsed }">
  <UDashboardSearchButton :collapsed="collapsed" />

  <UNavigationMenu
    :collapsed="collapsed"
    :items="links[0]"
    orientation="vertical"
    tooltip
    popover
  />

  <UNavigationMenu
    :collapsed="collapsed"
    :items="links[1]"
    orientation="vertical"
    tooltip
    class="mt-auto"
  />
</template>
```

Key props on `UNavigationMenu`:
- `:collapsed` — pass sidebar's collapsed state (shows icons only)
- `orientation="vertical"` — required for sidebar layout
- `tooltip` — shows label tooltip when collapsed
- `popover` — shows children in popover when collapsed

## User menu (sidebar footer)

`UDropdownMenu` wrapping a `UButton` with avatar, name, and chevron:

```vue
<script setup lang="ts">
import { computed } from 'vue'
import type { DropdownMenuItem } from '@nuxt/ui'

const user = { name: 'Jane Doe', avatar: { src: '/avatar.jpg', alt: 'Jane Doe' } }

const userMenuItems = computed<DropdownMenuItem[][]>(() => [
  [{ type: 'label', label: user.name, avatar: user.avatar }],
  [
    { label: 'Profile', icon: 'i-lucide-user' },
    { label: 'Billing', icon: 'i-lucide-credit-card' },
    { label: 'Settings', icon: 'i-lucide-settings', to: '/settings' },
  ],
  [{ label: 'Log out', icon: 'i-lucide-log-out' }],
])
</script>
```

```vue
<template #footer="{ collapsed }">
  <UDropdownMenu
    :items="userMenuItems"
    :content="{ align: 'center', collisionPadding: 12 }"
    :ui="{ content: collapsed ? 'w-48' : 'w-(--reka-dropdown-menu-trigger-width)' }"
  >
    <UButton
      :label="collapsed ? undefined : user.name"
      :trailing-icon="collapsed ? undefined : 'i-lucide-chevrons-up-down'"
      color="neutral"
      variant="ghost"
      block
      :square="collapsed"
      class="data-[state=open]:bg-elevated"
      :ui="{ trailingIcon: 'text-dimmed' }"
    >
      <template #leading>
        <UAvatar v-bind="user.avatar" size="2xs" />
      </template>
    </UButton>
  </UDropdownMenu>
</template>
```

Key details:
- `w-(--reka-dropdown-menu-trigger-width)` matches dropdown width to button width when expanded
- `w-48` is a fixed width when collapsed (button is square)
- `data-[state=open]:bg-elevated` highlights button when menu is open
- Nested arrays in items create groups with automatic separators
- `type: 'label'` creates a non-interactive header item

## Multi-panel (list-detail)

Two panels side by side. Left panel is resizable, right shows detail:

```vue
<template>
  <!-- List panel -->
  <UDashboardPanel id="list" :default-size="25" :min-size="20" :max-size="30" resizable>
    <template #header>
      <UDashboardNavbar title="Inbox">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div
        v-for="item in items"
        :key="item.id"
        class="p-4 border-b border-default cursor-pointer hover:bg-elevated/50"
        :class="{ 'bg-elevated': selected?.id === item.id }"
        @click="selected = item"
      >
        {{ item.title }}
      </div>
    </template>
  </UDashboardPanel>

  <!-- Detail panel -->
  <UDashboardPanel id="detail" class="hidden lg:flex">
    <template #header>
      <UDashboardNavbar :title="selected?.title || 'Select an item'" />
    </template>

    <template #body>
      <div v-if="selected">
        <!-- Detail content -->
      </div>
      <div v-else class="flex items-center justify-center h-full">
        <UIcon name="i-lucide-inbox" class="size-12 text-dimmed" />
      </div>
    </template>
  </UDashboardPanel>
</template>
```

For mobile, use a `USlideover` instead of the second panel:

```vue
<USlideover v-model:open="isDetailOpen">
  <template #body>
    <!-- Same detail content -->
  </template>
</USlideover>
```

## Page with toolbar

Navbar + toolbar combo for pages with search and filters:

```vue
<UDashboardPanel>
  <template #header>
    <UDashboardNavbar title="Customers">
      <template #leading>
        <UDashboardSidebarCollapse />
      </template>
      <template #right>
        <UButton icon="i-lucide-plus" label="New" />
      </template>
    </UDashboardNavbar>

    <UDashboardToolbar>
      <template #left>
        <UInput icon="i-lucide-search" placeholder="Search customers..." class="-ms-1" />
      </template>
      <template #right>
        <USelect
          :items="['All', 'Active', 'Inactive']"
          placeholder="Status"
        />
      </template>
    </UDashboardToolbar>
  </template>

  <template #body>
    <!-- Table or content -->
  </template>
</UDashboardPanel>
```

Note: `-ms-1` on the first toolbar item aligns it with the `UDashboardSidebarCollapse` button.

## Slideover pattern

For notifications, detail views, or forms:

```vue
<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRoute } from 'vue-router'

const isOpen = ref(false)

// Close on route change
const route = useRoute()
watch(() => route.fullPath, () => {
  isOpen.value = false
})
</script>

<template>
  <USlideover v-model:open="isOpen" title="Notifications">
    <template #body>
      <div
        v-for="notification in notifications"
        :key="notification.id"
        class="px-3 py-2.5 rounded-md hover:bg-elevated/50 flex items-center gap-3"
      >
        <UAvatar :src="notification.avatar" size="md" />
        <div class="text-sm flex-1">
          <p class="text-highlighted font-medium">{{ notification.title }}</p>
          <p class="text-dimmed">{{ notification.body }}</p>
        </div>
      </div>
    </template>
  </USlideover>
</template>
```

Place the slideover in the layout (alongside `<slot />`) for global access, or in a page component for page-specific panels.

## Shared composable

For shared dashboard state (slideover toggles, global shortcuts). Simple pattern without extra dependencies:

```ts
// src/composables/useDashboard.ts
import { ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

// Module-level state — shared across all imports
const isNotificationsOpen = ref(false)

export function useDashboard() {
  const route = useRoute()
  const router = useRouter()

  // Close overlays on navigation
  watch(() => route.fullPath, () => {
    isNotificationsOpen.value = false
  })

  return {
    isNotificationsOpen,
  }
}
```

## Keyboard shortcuts

Use `defineShortcuts` (auto-imported by Nuxt UI) for navigation and actions:

```ts
// In a composable or component setup
defineShortcuts({
  'g-h': () => router.push('/'),
  'g-r': () => router.push('/records'),
  'g-a': () => router.push('/accounts'),
  'g-s': () => router.push('/settings'),
  'n': () => { isNotificationsOpen.value = !isNotificationsOpen.value },
  meta_k: () => { /* open search */ },
})
```

Show shortcuts in tooltips:

```vue
<UTooltip text="Notifications" :shortcuts="['N']">
  <UButton icon="i-lucide-bell" color="neutral" variant="ghost" />
</UTooltip>
```

## Empty states

Pattern for pages with no data:

```vue
<template #body>
  <div class="flex flex-col items-center justify-center py-24 text-center">
    <UIcon name="i-lucide-inbox" class="mb-4 size-12 text-dimmed" />
    <h2 class="text-lg font-semibold text-highlighted">No records yet</h2>
    <p class="mt-1 text-sm text-muted">Start by adding your first record.</p>
    <UButton icon="i-lucide-plus" label="New record" class="mt-6" />
  </div>
</template>
```

Use semantic color utilities: `text-highlighted` (primary text), `text-muted` (secondary), `text-dimmed` (tertiary), `bg-elevated` (raised surfaces).

## Right sidebar

Add a second sidebar on the right:

```vue
<UDashboardGroup>
  <UDashboardSidebar collapsible resizable>
    <!-- Left sidebar (navigation) -->
  </UDashboardSidebar>

  <slot />

  <UDashboardSidebar side="right" resizable>
    <!-- Right sidebar (details, activity, etc.) -->
  </UDashboardSidebar>
</UDashboardGroup>
```

## Settings page with sub-navigation

Use `UNavigationMenu` inside a panel for settings sections:

```vue
<template>
  <UDashboardPanel>
    <template #header>
      <UDashboardNavbar title="Settings">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="flex gap-8">
        <UNavigationMenu
          :items="[
            { label: 'General', to: '/settings', exact: true },
            { label: 'Members', to: '/settings/members' },
            { label: 'Notifications', to: '/settings/notifications' },
            { label: 'Security', to: '/settings/security' },
          ]"
          orientation="vertical"
          class="w-48 shrink-0"
        />

        <div class="flex-1 min-w-0">
          <RouterView />
        </div>
      </div>
    </template>
  </UDashboardPanel>
</template>
```
