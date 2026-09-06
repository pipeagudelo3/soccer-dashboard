import { createRouter, createWebHistory } from 'vue-router';

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
  ],
});

router.afterEach((to) => {
  const pageTitle = typeof to.meta.title === 'string' ? to.meta.title : null;

  document.title = pageTitle ? `${pageTitle} | Soccer Dashboard` : 'Soccer Dashboard';
});

export default router;
