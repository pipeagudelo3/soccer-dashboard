<script setup lang="ts">
// Centralizes accessible Chart.js rendering, empty states, updates, and teardown.
import { Chart, type ChartData, type ChartOptions, type ChartType, registerables } from 'chart.js';
import { computed, onBeforeUnmount, onMounted, ref, useId, watch } from 'vue';

Chart.register(...registerables);

interface Props {
  title: string;
  type: ChartType;
  data: ChartData;
  options?: ChartOptions;
  description?: string;
}

const props = defineProps<Props>();

const componentId = useId();
const titleId = `chart-title-${componentId}`;
const descriptionId = `chart-description-${componentId}`;
const canvasRef = ref<HTMLCanvasElement | null>(null);
let chartInstance: Chart | null = null;

const hasDataPoints = computed(() =>
  props.data.datasets.some((dataset) => dataset.data.length > 0),
);

function renderChart(): void {
  chartInstance?.destroy();
  chartInstance = null;

  if (!hasDataPoints.value || canvasRef.value === null) {
    return;
  }

  chartInstance = new Chart(canvasRef.value, {
    type: props.type,
    data: props.data,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      ...props.options,
    },
  });
}

onMounted(renderChart);

watch(() => [props.data, props.type, props.options], renderChart, { deep: true, flush: 'post' });

onBeforeUnmount(() => {
  chartInstance?.destroy();
});
</script>

<template>
  <section class="chart-card">
    <header class="chart-card-header">
      <h3 :id="titleId">{{ props.title }}</h3>
      <p v-if="props.description" :id="descriptionId">{{ props.description }}</p>
    </header>
    <div v-if="hasDataPoints" class="chart-canvas-wrapper">
      <canvas
        ref="canvasRef"
        role="img"
        :aria-labelledby="titleId"
        :aria-describedby="props.description ? descriptionId : undefined"
      >
        {{ props.title }} chart.
      </canvas>
    </div>
    <p v-else class="chart-empty" role="status">No data is available for this chart.</p>
  </section>
</template>

<style scoped>
.chart-card {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 1.25rem;
  background-color: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 0.75rem;
}

.chart-card-header h3 {
  margin: 0;
  font-size: 1rem;
  color: #0f172a;
}

.chart-card-header p {
  margin: 0.25rem 0 0;
  color: #64748b;
  font-size: 0.8rem;
}

.chart-canvas-wrapper {
  position: relative;
  height: 260px;
}

.chart-empty {
  display: grid;
  place-items: center;
  min-height: 260px;
  margin: 0;
  color: var(--color-text-muted);
  text-align: center;
  background-color: var(--color-background-subtle);
  border-radius: 0.5rem;
}
</style>
