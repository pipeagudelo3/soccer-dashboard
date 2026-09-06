<script setup lang="ts">
import { RouterView } from 'vue-router';

import AppHeader from '@/components/AppHeader.vue';
</script>

<template>
  <div class="app-shell">
    <AppHeader />

    <main class="main-content">
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
