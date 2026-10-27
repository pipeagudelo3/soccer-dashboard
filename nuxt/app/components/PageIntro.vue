<script setup lang="ts">
defineProps<{ description: string; eyebrow: string; title: string }>();
</script>

<template>
  <header class="page-intro">
    <p class="eyebrow">{{ eyebrow }}</p>
    <h1>{{ title }}</h1>
    <p class="lede">{{ description }}</p>
  </header>
</template>
