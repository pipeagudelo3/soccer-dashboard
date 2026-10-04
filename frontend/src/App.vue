<script setup lang="ts">
import { RouterView } from 'vue-router';
import { ref } from 'vue';

import AppHeader from '@/components/AppHeader.vue';
import { useAuthStore } from '@/stores/authstore.js';

const mainContent = ref<HTMLElement | null>(null);
const authStore = useAuthStore();

function focusMainContent(): void {
  mainContent.value?.focus({ preventScroll: true });
  mainContent.value?.scrollIntoView({ block: 'start' });
}
</script>

<template>
  <div class="app-shell">
    <a href="#main-content" class="skip-link" @click.prevent="focusMainContent">
      Skip to main content
    </a>
    <AppHeader
      :is-authenticated="authStore.isAuthenticated"
      :user-name="authStore.currentUser?.name ?? null"
      :user-role="authStore.currentUser?.role ?? null"
    />

    <main ref="mainContent" class="main-content" tabindex="-1">
      <RouterView />
    </main>

    <footer class="app-footer">
      <p>Soccer Dashboard</p>
      <p>Academic project built with Vue 3 and TypeScript.</p>
    </footer>
  </div>
</template>

<style scoped>
.app-shell {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

.main-content {
  flex: 1;
  width: min(100% - 2rem, 1200px);
  margin: 0 auto;
  padding: 2rem 0;
  scroll-margin-top: calc(var(--header-height) + 0.5rem);
}

.main-content:focus {
  outline: none;
}

.app-footer {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  width: min(100% - 2rem, 1200px);
  margin: 0 auto;
  padding: 1.25rem 0;
  color: #64748b;
  font-size: 0.875rem;
  border-top: 1px solid #e2e8f0;
}

@media (max-width: 700px) {
  .main-content {
    padding: 1.25rem 0;
  }

  .app-footer {
    flex-direction: column;
    gap: 0.25rem;
  }
}
</style>
