import { createRouter, createWebHistory } from 'vue-router'

/**
 * App router — multi-layout system via nested routes.
 *
 * - `/` — public home (no layout)
 * - `/dashboard/*` — authenticated pages wrapped in DashboardLayout (sidebar + panels)
 * - `/*` — global 404 (no layout)
 *
 * All page components are lazy-loaded.
 */
const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('@/pages/HomePage.vue'),
    },
    {
      // DashboardLayout provides sidebar + panel chrome for all child routes
      path: '/dashboard',
      component: () => import('@/layouts/DashboardLayout.vue'),
      children: [
        { path: '', name: 'dashboard', component: () => import('@/pages/DashboardPage.vue') },
        { path: 'records', name: 'records', component: () => import('@/pages/RecordsPage.vue') },
        { path: 'accounts', name: 'accounts', component: () => import('@/pages/AccountsPage.vue') },
        { path: 'categories', name: 'categories', component: () => import('@/pages/CategoriesPage.vue') },
        { path: 'people', name: 'people', component: () => import('@/pages/PeoplePage.vue') },
        { path: 'keywords', name: 'keywords', component: () => import('@/pages/KeywordsPage.vue') },
        { path: 'settings', name: 'settings', component: () => import('@/pages/SettingsPage.vue') },
        { path: ':pathMatch(.*)*', name: 'dashboard-not-found', component: () => import('@/pages/DashboardNotFoundPage.vue') },
      ],
    },
    {
      // Global catch-all 404 — no layout wrapper
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      component: () => import('@/pages/NotFoundPage.vue'),
    },
  ],
})

export default router
