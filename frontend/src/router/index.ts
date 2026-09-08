import { createRouter, createWebHistory } from 'vue-router';

import { useAuthStore } from '@/stores/authstore.js';
import HomeView from '@/views/HomeView.vue';

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView,
      meta: {
        title: 'Home',
      },
    },
    {
      path: '/about',
      name: 'about',
      component: () => import('@/views/AboutView.vue'),
      meta: {
        title: 'About',
      },
    },
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/LoginView.vue'),
      meta: {
        title: 'Login',
      },
    },
    {
      path: '/dashboard',
      name: 'dashboard',
      component: () => import('@/views/DashboardView.vue'),
      meta: {
        title: 'Dashboard',
        requiresAuth: true,
      },
    },
    {
      path: '/teams',
      name: 'teams',
      component: () => import('@/views/TeamsView.vue'),
      meta: {
        title: 'Teams',
        requiresAuth: true,
      },
    },
    {
      path: '/players',
      name: 'players',
      component: () => import('@/views/PlayersView.vue'),
      meta: {
        title: 'Players',
        requiresAuth: true,
      },
    },
  ],
});

// Route guard: enforces authentication and admin-only access declared through
// route meta (`requiresAuth` / `requiresAdmin`), and keeps already-authenticated
// users away from the login page. See Programming Rules, section 12.
router.beforeEach((to) => {
  const authStore = useAuthStore();

  if (to.name === 'login' && authStore.isAuthenticated) {
    return { name: 'dashboard' };
  }

  if (to.meta.requiresAuth === true && !authStore.isAuthenticated) {
    return { name: 'login', query: { redirect: to.fullPath } };
  }

  if (to.meta.requiresAdmin === true && !authStore.isAdmin) {
    return { name: 'dashboard' };
  }

  return true;
});

router.afterEach((to) => {
  const pageTitle = typeof to.meta.title === 'string' ? to.meta.title : null;

  document.title = pageTitle ? `${pageTitle} | Soccer Dashboard` : 'Soccer Dashboard';
});

export default router;
