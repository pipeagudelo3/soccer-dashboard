<script setup lang="ts">
import { NuxtLink } from '#components';
import { useSeoMeta } from '#imports';
import ContentCard from '~/components/ContentCard.vue';

useSeoMeta({ title: 'Soccer Dashboard | Entiende el juego' });
</script>

<template>
  <div>
    <section class="hero">
      <div>
        <p class="eyebrow">El fútbol, con perspectiva</p>
        <h1>Detrás de cada equipo,<br />una historia.</h1>
        <p>Conoce los clubes, interpreta sus números y descubre otra forma de ver el juego.</p>
        <NuxtLink class="button" to="/teams"
          >Explorar equipos <span aria-hidden="true">↗</span></NuxtLink
        >
      </div>
      <div class="pitch" aria-hidden="true">
        <span class="pitch-circle" /><span class="pitch-line" /><span
          class="pitch-box pitch-box-left"
        /><span class="pitch-box pitch-box-right" /><span class="pitch-ball" />
      </div>
    </section>
    <section class="home-section" aria-labelledby="explore-title">
      <div class="section-heading">
        <h2 id="explore-title">Elige tu siguiente jugada</h2>
        <span>Tres formas de explorar</span>
      </div>
      <div class="card-grid">
        <ContentCard eyebrow="01 · Lecturas" title="Una mirada al juego" to="/blog"
          ><p>Tres artículos para leer las estadísticas con más contexto.</p></ContentCard
        >
        <ContentCard eyebrow="02 · Clubes" title="El mapa de los equipos" to="/teams"
          ><p>Países, estadios e historia de los clubes de nuestro catálogo.</p></ContentCard
        >
        <ContentCard eyebrow="03 · A tu ritmo" title="Tu caja de herramientas" to="/tools"
          ><p>Calcula puntos y resuelve las dudas más frecuentes.</p></ContentCard
        >
      </div>
    </section>
  </div>
</template>
