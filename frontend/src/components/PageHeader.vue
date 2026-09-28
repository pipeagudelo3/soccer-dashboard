<script setup lang="ts">
interface Props {
  title: string;
  description?: string;
}

const props = defineProps<Props>();
</script>

<template>
  <header class="page-header">
    <div>
      <h1>{{ props.title }}</h1>
      <p v-if="props.description">{{ props.description }}</p>
    </div>

    <div v-if="$slots.actions" class="page-header-actions">
      <slot name="actions" />
    </div>
  </header>
</template>

<style scoped>
.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}

.page-header h1 {
  margin: 0 0 0.35rem;
  color: var(--color-heading);
}

.page-header p {
  margin: 0;
  color: var(--color-text-muted);
}

.page-header-actions {
  flex-shrink: 0;
}

@media (max-width: 640px) {
  .page-header {
    flex-direction: column;
  }
}
</style>
