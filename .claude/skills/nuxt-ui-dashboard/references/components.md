# Dashboard Components API

Full reference for Nuxt UI 4 dashboard components in Vue (Vite) projects.

## UDashboardGroup

Root layout wrapper. Manages sidebar state persistence and sizing.

| Prop | Default | Description |
|---|---|---|
| `unit` | `'percentages'` | Size unit: `'percentages'` or `'rem'` (recommended for dashboards) |
| `storage` | `'cookie'` | State persistence: `'cookie'`, `'local'` (localStorage), `false` |
| `storage-key` | `'dashboard'` | Storage key name |

```vue
<UDashboardGroup unit="rem" storage="local">
  <UDashboardSidebar />
  <slot /> <!-- RouterView goes here -->
</UDashboardGroup>
```

All `UDashboardSidebar` and resizable `UDashboardPanel` components must be direct children.

## UDashboardSidebar

Resizable, collapsible sidebar. Must be inside `UDashboardGroup`.

### Props

| Prop | Default | Description |
|---|---|---|
| `id` | `—` | Unique ID (for state persistence, recommended) |
| `collapsible` | `false` | Enable collapse when dragged to min edge |
| `resizable` | `false` | Enable resize by dragging |
| `side` | `'left'` | `'left'` or `'right'` |
| `mode` | `'slideover'` | Mobile menu mode: `'modal'`, `'slideover'`, `'drawer'` |
| `min-size` | `—` | Minimum size (in group's unit) |
| `max-size` | `—` | Maximum size |
| `default-size` | `—` | Initial size |

### v-model bindings

| Binding | Description |
|---|---|
| `v-model:collapsed` | Desktop collapsed state (boolean) |
| `v-model:open` | Mobile open state (boolean) |

### Slots

All slots receive `{ collapsed }` as a slot prop:

| Slot | Description |
|---|---|
| `#header` | Top area — logo, team selector, search button |
| `#default` | Main body — navigation menus (scrollable) |
| `#footer` | Bottom area — user menu, links |

### Customization

```vue
<UDashboardSidebar
  collapsible
  resizable
  class="bg-elevated/25"
  :ui="{ footer: 'lg:border-t lg:border-default' }"
>
```

The `:ui` prop targets slot classes. Read `node_modules/.nuxt-ui/ui/dashboard-sidebar.ts` for slot names:

```ts
// Slots: root, header, body, footer, toggle, handle, content, overlay
```

## UDashboardPanel

Content panel with scrollable body. Used in each page component.

### Props

| Prop | Default | Description |
|---|---|---|
| `id` | `—` | Unique ID (required for multi-panel layouts) |
| `resizable` | `false` | Enable resize by dragging |
| `default-size` | `—` | Initial size (in group's unit) |
| `min-size` | `—` | Minimum size |
| `max-size` | `—` | Maximum size |
| `grow` | `—` | Whether panel grows to fill remaining space |

### Slots

| Slot | Description |
|---|---|
| `#header` | Fixed top area — place `UDashboardNavbar` + `UDashboardToolbar` here |
| `#body` | Scrollable content area (has `overflow-y-auto`, `p-4 sm:p-6` padding) |
| `#footer` | Fixed bottom area |
| `#default` | Raw slot — replaces body, no scroll wrapper |

```vue
<UDashboardPanel>
  <template #header>
    <UDashboardNavbar title="Page" />
  </template>

  <template #body>
    <!-- Scrollable content -->
  </template>
</UDashboardPanel>
```

Theme file: `node_modules/.nuxt-ui/ui/dashboard-panel.ts`

## UDashboardNavbar

Header bar inside `UDashboardPanel`'s `#header` slot.

### Props

| Prop | Default | Description |
|---|---|---|
| `title` | `—` | Page title text |

### Slots

| Slot | Description |
|---|---|
| `#leading` | Before title — convention: place `UDashboardSidebarCollapse` here |
| `#left` | Left section (includes title) |
| `#default` | Center section (`hidden lg:flex`) |
| `#right` | Right section — action buttons, dropdowns |
| `#toggle` | Mobile sidebar toggle area |

### Customization

```vue
<UDashboardNavbar title="Home" :ui="{ right: 'gap-3' }">
  <template #leading>
    <UDashboardSidebarCollapse />
  </template>
  <template #right>
    <UButton icon="i-lucide-bell" color="neutral" variant="ghost" />
    <UButton icon="i-lucide-plus" label="New" />
  </template>
</UDashboardNavbar>
```

Theme file: `node_modules/.nuxt-ui/ui/dashboard-navbar.ts`

## UDashboardToolbar

Filter/action bar placed below `UDashboardNavbar` inside `#header`.

### Slots

| Slot | Description |
|---|---|
| `#left` | Left-aligned filters/inputs |
| `#right` | Right-aligned actions/selects |

```vue
<template #header>
  <UDashboardNavbar title="Records" />

  <UDashboardToolbar>
    <template #left>
      <UInput icon="i-lucide-search" placeholder="Search..." />
    </template>
    <template #right>
      <USelect :items="['All', 'Active', 'Archived']" />
    </template>
  </UDashboardToolbar>
</template>
```

Theme file: `node_modules/.nuxt-ui/ui/dashboard-toolbar.ts`

## UDashboardSearch

Command palette / global search. Place **outside** `UDashboardSidebar` but **inside** `UDashboardGroup`.

### Props

| Prop | Default | Description |
|---|---|---|
| `groups` | `[]` | Search groups: `{ id, label, items }[]` |
| `placeholder` | `—` | Search input placeholder |
| `loading` | `false` | Loading state |

### Groups structure

```ts
import { computed } from 'vue'

const groups = computed(() => [
  {
    id: 'links',
    label: 'Go to',
    items: [
      { label: 'Home', icon: 'i-lucide-house', to: '/' },
      { label: 'Users', icon: 'i-lucide-users', to: '/users' },
    ],
  },
  {
    id: 'actions',
    label: 'Actions',
    items: [
      { label: 'New record', icon: 'i-lucide-plus', onSelect: () => createRecord() },
    ],
  },
])
```

### Placement

```vue
<UDashboardGroup>
  <UDashboardSidebar>
    <!-- sidebar content -->
  </UDashboardSidebar>

  <UDashboardSearch :groups="groups" />

  <slot />
</UDashboardGroup>
```

## UDashboardSearchButton

Triggers the `UDashboardSearch` command palette. Place inside sidebar `#default` or `#header`.

| Prop | Default | Description |
|---|---|---|
| `collapsed` | `false` | Pass the sidebar's collapsed state |

```vue
<template #default="{ collapsed }">
  <UDashboardSearchButton :collapsed="collapsed" class="bg-transparent ring-default" />

  <UNavigationMenu :items="items" orientation="vertical" />
</template>
```

## UDashboardSidebarCollapse

Desktop sidebar collapse/expand toggle button. Hidden on mobile (`hidden lg:flex`).

**Convention:** place in `UDashboardNavbar`'s `#leading` slot on every page:

```vue
<UDashboardNavbar title="Page Title">
  <template #leading>
    <UDashboardSidebarCollapse />
  </template>
</UDashboardNavbar>
```

## UDashboardSidebarToggle

Mobile sidebar toggle button (`lg:hidden`). Automatically rendered inside `UDashboardNavbar` when a sidebar exists. Usually no manual placement needed.
