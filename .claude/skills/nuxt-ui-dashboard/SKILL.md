---
name: nuxt-ui-dashboard
description: Build dashboard admin UIs with Nuxt UI 4 dashboard components in Vue (Vite) projects. Covers UDashboardGroup, UDashboardSidebar, UDashboardPanel, UDashboardNavbar, UDashboardToolbar, UDashboardSearch, sidebar navigation, user menus, multi-panel layouts, and command palettes. Trigger when building admin interfaces, dashboard layouts, sidebar navigation, resizable panels, or using any UDashboard* component. Vue (Vite) context, NOT Nuxt framework.
---

# Nuxt UI Dashboard

Dashboard components for admin interfaces in Vue (Vite) projects. Resizable sidebars, multi-panel layouts, toolbars, search, and navigation.

Based on the official [dashboard-vue template](https://github.com/nuxt-ui-templates/dashboard-vue).

## Vue (Vite) context

This skill targets **Vue + Vite** projects (not Nuxt framework):

- **No auto-imports** — import `computed`, `ref`, `watch` from `'vue'`
- **No `definePageMeta`** — use standard Vue Router with `<RouterView />`
- **No `NuxtLayout`/`NuxtPage`** — import layout component directly, wrap `<RouterView />`
- **Types** — import `NavigationMenuItem`, `DropdownMenuItem` from `'@nuxt/ui'`
- **Theme files** — `node_modules/.nuxt-ui/ui/<component>.ts` for slot names and variants

## Component tree

```
UApp (App.vue)
└── DashboardLayout.vue
    └── UDashboardGroup
        ├── UDashboardSidebar (collapsible, resizable)
        │   ├── #header → logo / team selector
        │   ├── #default → UDashboardSearchButton + UNavigationMenu
        │   └── #footer → UDropdownMenu (user menu)
        ├── UDashboardSearch (command palette — outside sidebar)
        └── <slot /> → <RouterView />
            └── UDashboardPanel (per page)
                ├── #header → UDashboardNavbar + UDashboardToolbar
                ├── #body (scrollable content)
                └── #footer (optional)
```

## Quick start: App.vue

```vue
<script setup lang="ts">
import DashboardLayout from '@/layouts/DashboardLayout.vue'
</script>

<template>
  <UApp>
    <DashboardLayout>
      <RouterView />
    </DashboardLayout>
  </UApp>
</template>
```

## Quick start: Layout

```vue
<!-- src/layouts/DashboardLayout.vue -->
<script setup lang="ts">
import { computed, ref } from 'vue'
import type { NavigationMenuItem, DropdownMenuItem } from '@nuxt/ui'

const open = ref(false)

const navItems = computed<NavigationMenuItem[][]>(() => [
  [
    { label: 'Home', icon: 'i-lucide-house', to: '/' },
    { label: 'Users', icon: 'i-lucide-users', to: '/users' },
    { label: 'Settings', icon: 'i-lucide-settings', to: '/settings' },
  ],
])

const userMenuItems = computed<DropdownMenuItem[][]>(() => [
  [{ type: 'label', label: 'User Name', icon: 'i-lucide-user' }],
  [
    { label: 'Profile', icon: 'i-lucide-user' },
    { label: 'Settings', icon: 'i-lucide-settings', to: '/settings' },
  ],
  [{ label: 'Log out', icon: 'i-lucide-log-out' }],
])
</script>

<template>
  <UDashboardGroup unit="rem" storage="local">
    <UDashboardSidebar
      v-model:open="open"
      collapsible
      resizable
      :ui="{ footer: 'lg:border-t lg:border-default' }"
    >
      <template #header="{ collapsed }">
        <div class="flex items-center gap-2">
          <span v-if="!collapsed" class="font-heading text-lg font-bold text-highlighted">App</span>
          <span v-else class="font-heading text-lg font-bold text-highlighted">A</span>
        </div>
      </template>

      <template #default="{ collapsed }">
        <UNavigationMenu
          :collapsed="collapsed"
          :items="navItems[0]"
          orientation="vertical"
          tooltip
        />
      </template>

      <template #footer="{ collapsed }">
        <UDropdownMenu
          :items="userMenuItems"
          :content="{ align: 'center', collisionPadding: 12 }"
          :ui="{ content: collapsed ? 'w-48' : 'w-(--reka-dropdown-menu-trigger-width)' }"
        >
          <UButton
            :label="collapsed ? undefined : 'User Name'"
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

    <slot />
  </UDashboardGroup>
</template>
```

## Quick start: Page

```vue
<!-- src/pages/Home.vue -->
<template>
  <UDashboardPanel>
    <template #header>
      <UDashboardNavbar title="Home">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <UButton icon="i-lucide-plus" label="New" />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <!-- Scrollable page content -->
    </template>
  </UDashboardPanel>
</template>
```

## Component quick reference

| Component | Purpose |
|---|---|
| `UDashboardGroup` | Root wrapper. Manages sidebar state persistence |
| `UDashboardSidebar` | Collapsible, resizable sidebar with header/nav/footer |
| `UDashboardPanel` | Page content wrapper with header/body/footer |
| `UDashboardNavbar` | Page header bar with title and action slots |
| `UDashboardToolbar` | Filter/action bar below navbar |
| `UDashboardSearch` | Command palette (place outside sidebar) |
| `UDashboardSearchButton` | Triggers search (place in sidebar) |
| `UDashboardSidebarCollapse` | Desktop sidebar toggle (place in navbar `#leading`) |
| `UDashboardSidebarToggle` | Mobile sidebar toggle (`lg:hidden`, auto-rendered) |

## References

Load based on your task:

- [references/components.md](references/components.md) — Full props, slots, and customization for each dashboard component
- [references/patterns.md](references/patterns.md) — Navigation, user menus, multi-panel, search, composables, empty states
- `nuxt-ui` skill's `references/theming.md` — CSS variables, semantic colors, component overrides
- `nuxt-ui` skill's `references/components.md` — Non-dashboard components (UTable, UButton, UInput, etc.)
- Generated theme files — `node_modules/.nuxt-ui/ui/dashboard-*.ts` for all slots and variants
