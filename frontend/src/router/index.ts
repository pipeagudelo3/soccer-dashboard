import { createRouter, createWebHistory } from 'vue-router';

import { authenticationGuard } from '@/router/authenticationGuard.js';
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
    {
      path: '/matches',
      name: 'matches',
      component: () => import('@/views/MatchStatsView.vue'),
      meta: {
        title: 'Match Statistics',
        requiresAuth: true,
      },
    },
    {
      path: '/statistics',
      name: 'statistics',
      component: () => import('@/views/StatisticsView.vue'),
      meta: {
        title: 'Statistics',
        requiresAuth: true,
      },
    },
    {
      path: '/team-comparison',
      name: 'team-comparison',
      component: () => import('@/views/TeamComparisonView.vue'),
      meta: {
        title: 'Team Comparison',
        requiresAuth: true,
      },
    },
    {
      path: '/admin/users',
      name: 'admin.users',
      component: () => import('@/views/AdminUsersView.vue'),
      meta: {
        title: 'User Management',
        requiresAuth: true,
        requiresAdmin: true,
      },
    },
    {
      path: '/admin/match-stats',
      name: 'admin.match-stats',
      component: () => import('@/views/AdminMatchStatsView.vue'),
      meta: {
        title: 'Match Statistics Management',
        requiresAuth: true,
        requiresAdmin: true,
      },
    },
  ],
});

// Enforce the access requirements declared in each route's metadata.
router.beforeEach(authenticationGuard);

router.afterEach((to) => {
  const pageTitle = typeof to.meta.title === 'string' ? to.meta.title : null;

  document.title = pageTitle ? `${pageTitle} | Soccer Dashboard` : 'Soccer Dashboard';
});

export default router;
