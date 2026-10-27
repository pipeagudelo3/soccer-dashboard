<script setup lang="ts">
import { NuxtLink } from '#components';

defineProps<{ eyebrow: string; title: string; to: string }>();
</script>

<template>
  <article class="content-card">
    <p class="eyebrow">{{ eyebrow }}</p>
    <h2>
      <NuxtLink :to="to">{{ title }}</NuxtLink>
    </h2>
    <div class="card-copy"><slot /></div>
    <span class="card-arrow" aria-hidden="true">↗</span>
  </article>
</template>
