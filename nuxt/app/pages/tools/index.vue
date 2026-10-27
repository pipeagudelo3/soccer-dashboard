<script setup lang="ts">
import { useSeoMeta } from '#imports';
import ContentCard from '~/components/ContentCard.vue';

useSeoMeta({ title: 'Herramientas | Soccer Dashboard' });
</script>

<template>
  <div class="card-grid tools-grid">
    <ContentCard eyebrow="Haz las cuentas" title="Calculadora de puntos" to="/tools/points"
      ><p>Descubre cuántos puntos suman tus victorias y empates.</p></ContentCard
    >
    <ContentCard eyebrow="Resuelve tus dudas" title="Preguntas frecuentes" to="/tools/faq"
      ><p>Una guía rápida para recorrer el catálogo y entender sus datos.</p></ContentCard
    >
  </div>
</template>
