<script setup lang="ts">
interface Props {
  errors?: readonly string[];
  successMessage?: string | null;
}

const props = withDefaults(defineProps<Props>(), {
  errors: () => [],
  successMessage: null,
});
</script>

<template>
  <section v-if="props.errors.length > 0" class="operation-feedback errors" role="alert">
    <strong>The operation could not be completed:</strong>
    <ul>
      <li v-for="error in props.errors" :key="error">{{ error }}</li>
    </ul>
  </section>

  <p v-if="props.successMessage" class="operation-feedback success" role="status">
    {{ props.successMessage }}
  </p>
</template>

<style scoped>
.operation-feedback {
  margin: 0;
  padding: var(--space-feedback);
  font-size: 0.85rem;
  border-radius: 0.5rem;
}

.errors {
  color: var(--color-error-text);
  background-color: var(--color-error-background);
}

.errors ul {
  margin: 0.4rem 0 0;
  padding-left: 1.25rem;
}

.success {
  color: var(--color-success-text);
  background-color: var(--color-success-background);
}
</style>
