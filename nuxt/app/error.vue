<script setup lang="ts">
import { clearError } from '#imports';
import type { NuxtError } from '#app';

const props = defineProps<{ error: NuxtError }>();
</script>

<template>
  <main class="error-page">
    <p class="eyebrow">Soccer Dashboard · {{ props.error.statusCode }}</p>
    <h1>
      {{
        props.error.statusCode === 404
          ? 'Esta página no está en juego'
          : 'No pudimos cargar la página'
      }}
    </h1>
    <p>
      {{
        props.error.statusCode === 404
          ? 'Comprueba el enlace o vuelve al inicio para seguir explorando.'
          : 'Intenta nuevamente dentro de un momento.'
      }}
    </p>
    <button type="button" @click="clearError({ redirect: '/' })">Volver al inicio</button>
  </main>
</template>
