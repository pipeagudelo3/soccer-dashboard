<script setup lang="ts">
// Reusable labeled <select> used by the filter controls on the Teams and
// Players pages, so filtering markup and behavior is defined only once.
export interface FilterOption {
  label: string;
  value: string;
}

interface Props {
  modelValue: string;
  label: string;
  options: FilterOption[];
}

const props = defineProps<Props>();

const emit = defineEmits<{
  'update:modelValue': [value: string];
}>();

function handleChange(event: Event): void {
  const target = event.target as HTMLSelectElement;
  emit('update:modelValue', target.value);
}
</script>

<template>
  <label class="filter-select">
    <span class="filter-select-label">{{ props.label }}</span>
    <select class="filter-select-input" :value="props.modelValue" @change="handleChange">
      <option v-for="option in props.options" :key="option.value" :value="option.value">
        {{ option.label }}
      </option>
    </select>
  </label>
</template>

<style scoped>
.filter-select {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  min-width: 10rem;
}

.filter-select-label {
  color: #475569;
  font-size: 0.8rem;
  font-weight: 600;
}

.filter-select-input {
  padding: 0.5rem 0.65rem;
  color: #0f172a;
  background-color: #ffffff;
  border: 1px solid #cbd5e1;
  border-radius: 0.5rem;
}

.filter-select-input:focus {
  outline: 2px solid #2563eb;
  outline-offset: 1px;
}
</style>
