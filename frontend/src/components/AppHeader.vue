<script setup lang="ts">
import { RouterLink } from 'vue-router';

import AppNavigation from '@/components/AppNavigation.vue';

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
</script>

<template>
  <header class="app-header">
    <div class="header-content">
      <RouterLink :to="{ name: 'home' }" class="brand" aria-label="Soccer Dashboard home">
        <span class="brand-mark" aria-hidden="true">SD</span>

        <span class="brand-text">
          <strong>Soccer Dashboard</strong>
          <small>Teams, players and match statistics</small>
        </span>
      </RouterLink>

      <AppNavigation :is-authenticated="props.isAuthenticated" :user-role="props.userRole" />
    </div>
  </header>
</template>

<style scoped>
.app-header {
  position: sticky;
  top: 0;
  z-index: 10;
  width: 100%;
  background-color: #0f172a;
  border-bottom: 1px solid #1e3a5f;
  box-shadow: 0 0.25rem 1rem rgba(15, 23, 42, 0.18);
}

.header-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 2rem;
  width: min(100% - 2rem, 1200px);
  min-height: 4.5rem;
  margin: 0 auto;
}

.brand {
  display: inline-flex;
  align-items: center;
  gap: 0.75rem;
  flex-shrink: 0;
  color: #ffffff;
  text-decoration: none;
}

.brand:hover {
  background-color: transparent;
}

.brand-mark {
  display: inline-grid;
  place-items: center;
  width: 2.75rem;
  height: 2.75rem;
  color: #ffffff;
  font-weight: 700;
  background-color: #2563eb;
  border-radius: 0.75rem;
}

.brand-text {
  display: flex;
  flex-direction: column;
  line-height: 1.2;
}

.brand-text strong {
  font-size: 1rem;
  font-weight: 700;
}

.brand-text small {
  margin-top: 0.2rem;
  color: #94a3b8;
  font-size: 0.75rem;
}

@media (max-width: 700px) {
  .header-content {
    flex-direction: column;
    gap: 0.75rem;
    padding: 0.875rem 0;
  }

  .brand {
    align-self: flex-start;
  }

  .app-header :deep(.app-navigation) {
    width: 100%;
  }
}

@media (max-width: 420px) {
  .brand-text small {
    display: none;
  }
}
</style>
