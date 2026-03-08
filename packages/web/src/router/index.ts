import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('@/pages/Home.vue'),
    },
    {
      path: '/dashboard',
      component: () => import('@/layouts/DashboardLayout.vue'),
      children: [
        { path: '', name: 'dashboard', component: () => import('@/pages/Dashboard.vue') },
        { path: 'records', name: 'records', component: () => import('@/pages/Records.vue') },
        { path: 'accounts', name: 'accounts', component: () => import('@/pages/Accounts.vue') },
        { path: 'people', name: 'people', component: () => import('@/pages/People.vue') },
        { path: 'settings', name: 'settings', component: () => import('@/pages/Settings.vue') },
        { path: ':pathMatch(.*)*', name: 'dashboard-not-found', component: () => import('@/pages/DashboardNotFound.vue') },
      ],
    },
    {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      component: () => import('@/pages/NotFound.vue'),
    },
  ],
})

export default router
