<script setup lang="ts">
// Reusable Chart.js wrapper so views never repeat chart bootstrapping,
// registration, or teardown logic (see Programming Rules, section 16).
import { Chart, type ChartData, type ChartOptions, type ChartType, registerables } from 'chart.js';
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';

Chart.register(...registerables);

interface Props {
  title: string;
  type: ChartType;
  data: ChartData;
  options?: ChartOptions;
  description?: string;
}

const props = defineProps<Props>();

const canvasRef = ref<HTMLCanvasElement | null>(null);
let chartInstance: Chart | null = null;

function renderChart(): void {
  if (canvasRef.value === null) {
    return;
  }

  chartInstance?.destroy();

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

watch(() => [props.data, props.type, props.options], renderChart, { deep: true });

onBeforeUnmount(() => {
  chartInstance?.destroy();
});
</script>

<template>
  <section class="chart-card">
    <header class="chart-card-header">
      <h3>{{ props.title }}</h3>
      <p v-if="props.description">{{ props.description }}</p>
    </header>
    <div class="chart-canvas-wrapper">
      <canvas ref="canvasRef"></canvas>
    </div>
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
</style>
