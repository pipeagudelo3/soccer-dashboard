<script setup lang="ts">
import { useSeoMeta } from '#imports';

useSeoMeta({ title: 'Preguntas frecuentes | Soccer Dashboard' });
</script>

<template>
  <section class="faq" aria-labelledby="faq-title">
    <h2 id="faq-title">Preguntas frecuentes</h2>
    <details>
      <summary>¿Los equipos y estadios son reales?</summary>
      <p>No. Los perfiles son ficticios y sirven para demostrar el funcionamiento del catálogo.</p>
    </details>
    <details>
      <summary>¿Puedo editar un equipo?</summary>
      <p>
        Esta mini versión permite consultar equipos. No incluye registro, inicio de sesión ni
        edición de datos.
      </p>
    </details>
    <details>
      <summary>¿La calculadora guarda mis resultados?</summary>
      <p>
        No. El cálculo se realiza mientras usas la página y se reinicia cuando vuelves a abrirla.
      </p>
    </details>
    <details>
      <summary>¿La puntuación aplica a todas las competiciones?</summary>
      <p>
        La calculadora usa tres puntos por victoria y uno por empate. Consulta el reglamento de tu
        torneo para confirmar su sistema de puntuación.
      </p>
    </details>
  </section>
</template>
