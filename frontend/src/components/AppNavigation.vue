<script setup lang="ts">
import { computed } from 'vue';
import { RouterLink, useRouter } from 'vue-router';

type NavigationAccess = 'public' | 'guest' | 'authenticated' | 'admin';

interface NavigationItem {
  label: string;
  routeName: string;
  access: NavigationAccess;
}

const props = withDefaults(
  defineProps<{
    isAuthenticated?: boolean;
    userRole?: string | null;
  }>(),
  {
    isAuthenticated: false,
    userRole: null,
  },
);

const router = useRouter();

const navigationItems: NavigationItem[] = [
  {
    label: 'Home',
    routeName: 'home',
    access: 'public',
  },
  {
    label: 'About',
    routeName: 'about',
    access: 'public',
  },
  {
    label: 'Login',
    routeName: 'login',
    access: 'guest',
  },
  {
    label: 'Dashboard',
    routeName: 'dashboard',
    access: 'authenticated',
  },
  {
    label: 'Teams',
    routeName: 'teams',
    access: 'authenticated',
  },
  {
    label: 'Players',
    routeName: 'players',
    access: 'authenticated',
  },
  {
    label: 'Matches',
    routeName: 'matches',
    access: 'authenticated',
  },
  {
    label: 'Statistics',
    routeName: 'statistics',
    access: 'authenticated',
  },
  {
    label: 'Team Comparison',
    routeName: 'team-comparison',
    access: 'authenticated',
  },
  {
    label: 'User Management',
    routeName: 'admin.users',
    access: 'admin',
  },
  {
    label: 'Match Management',
    routeName: 'admin.match-stats',
    access: 'admin',
  },
];

function canAccess(item: NavigationItem): boolean {
  if (item.access === 'public') {
    return true;
  }

  if (item.access === 'guest') {
    return !props.isAuthenticated;
  }

  if (!props.isAuthenticated) {
    return false;
  }

  if (item.access === 'admin') {
    return props.userRole === 'admin';
  }

  return true;
}

const visibleNavigationItems = computed<NavigationItem[]>(() =>
  navigationItems.filter((item) => router.hasRoute(item.routeName) && canAccess(item)),
);
</script>

<template>
  <nav class="app-navigation" aria-label="Main navigation">
    <ul class="navigation-list">
      <li v-for="item in visibleNavigationItems" :key="item.routeName">
        <RouterLink
          :to="{ name: item.routeName }"
          class="navigation-link"
          exact-active-class="navigation-link--active"
        >
          {{ item.label }}
        </RouterLink>
      </li>
    </ul>
  </nav>
</template>

<style scoped>
.navigation-list {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0;
  margin: 0;
  list-style: none;
}

.navigation-link {
  display: inline-flex;
  align-items: center;
  min-height: 2.5rem;
  padding: 0.5rem 0.875rem;
  color: #dbeafe;
  border-radius: 0.5rem;
  text-decoration: none;
  transition:
    color 0.2s ease,
    background-color 0.2s ease;
}

.navigation-link:hover {
  color: #ffffff;
  background-color: rgba(255, 255, 255, 0.12);
}

.navigation-link--active {
  color: #ffffff;
  background-color: #2563eb;
}

@media (max-width: 700px) {
  .navigation-list {
    justify-content: center;
    flex-wrap: wrap;
  }

  .navigation-link {
    min-height: 2.25rem;
    padding: 0.4rem 0.7rem;
  }
}
</style>
