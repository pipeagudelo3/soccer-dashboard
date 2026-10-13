<script setup lang="ts">
import OperationFeedback from '@/components/OperationFeedback.vue';

withDefaults(
  defineProps<{ isLoading: boolean; errors: string[]; hasLoaded: boolean; isEmpty?: boolean }>(),
  { isEmpty: false },
);
defineEmits<{ retry: [] }>();
</script>
<template>
  <section class="api-load-state" :aria-busy="isLoading" aria-live="polite">
    <p v-if="isLoading" role="status">Loading data…</p>
    <template v-else-if="errors.length > 0">
      <OperationFeedback :errors="errors" />
      <button type="button" @click="$emit('retry')">Retry loading data</button>
    </template>
    <p v-else-if="hasLoaded && isEmpty" role="status">No records yet.</p>
  </section>
</template>
<style scoped>
.api-load-state {
  display: grid;
  gap: 0.75rem;
}
button {
  justify-self: start;
  padding: 0.6rem 1rem;
  cursor: pointer;
  border: 1px solid #2563eb;
  border-radius: 0.5rem;
  background: white;
  color: #2563eb;
}
</style>
