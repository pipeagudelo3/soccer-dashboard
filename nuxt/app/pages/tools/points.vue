<script setup lang="ts">
import { computed, ref } from 'vue';
import { useSeoMeta } from '#imports';
import { PointsUtils } from '~/utils/PointsUtils';

const draws = ref<number | string>(0);
const wins = ref<number | string>(0);
const points = computed(() =>
  typeof wins.value === 'number' && typeof draws.value === 'number'
    ? PointsUtils.calculatePoints(wins.value, draws.value)
    : undefined,
);

useSeoMeta({ title: 'Calculadora de puntos | Soccer Dashboard' });
</script>

<template>
  <section class="calculator" aria-labelledby="calculator-title">
    <div>
      <h2 id="calculator-title">Calculadora de puntos</h2>
      <p>Cada victoria suma 3 puntos; cada empate, 1. Las derrotas no suman.</p>
      <div class="form-grid">
        <label for="wins"
          >Victorias<input
            id="wins"
            v-model.number="wins"
            type="number"
            min="0"
            step="1"
            required
            :aria-invalid="points === undefined"
            aria-describedby="points-help"
        /></label>
        <label for="draws"
          >Empates<input
            id="draws"
            v-model.number="draws"
            type="number"
            min="0"
            step="1"
            required
            :aria-invalid="points === undefined"
            aria-describedby="points-help"
        /></label>
      </div>
      <p id="points-help">
        Introduce cantidades enteras, no negativas y dentro del rango numérico seguro.
      </p>
    </div>
    <div class="score-panel" role="status" aria-live="polite" aria-atomic="true">
      <template v-if="points !== undefined"
        ><span>Total de puntos</span><strong>{{ points }}</strong
        ><span>3 × victorias + empates</span></template
      >
      <p v-else>Revisa los valores de victorias y empates.</p>
    </div>
  </section>
</template>
