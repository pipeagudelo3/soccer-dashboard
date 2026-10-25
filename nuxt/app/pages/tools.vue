<script setup lang="ts">
import { NuxtLink, NuxtPage } from '#components';
import PageIntro from '~/components/PageIntro.vue';
</script>

<template>
  <section>
    <PageIntro
      eyebrow="Tiempo de practicar"
      title="Herramientas para tu análisis"
      description="Haz tus cuentas y encuentra respuestas sin salir de la cancha."
    />
    <nav class="section-nav" aria-label="Herramientas">
      <NuxtLink to="/tools" exact-active-class="active">Explorar</NuxtLink
      ><NuxtLink to="/tools/points" active-class="active">Calculadora</NuxtLink
      ><NuxtLink to="/tools/faq" active-class="active">Preguntas frecuentes</NuxtLink>
    </nav>
    <NuxtPage />
  </section>
</template>
