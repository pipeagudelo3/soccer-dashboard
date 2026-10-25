<script setup lang="ts">
import { NuxtLink } from '#components';
import { computed } from 'vue';
import { definePageMeta, useRoute, useSeoMeta } from '#imports';
import { ArticleService } from '~/services/ArticleService';
import { FormatUtils } from '~/utils/FormatUtils';

definePageMeta({
  validate: (route) =>
    typeof route.params.slug === 'string' && !!ArticleService.getArticleBySlug(route.params.slug),
});

const route = useRoute();
const article = computed(() => ArticleService.getArticleBySlug(String(route.params.slug)));

useSeoMeta({
  title: () => `${article.value?.title ?? 'Artículo'} | Soccer Dashboard`,
  description: () => article.value?.summary,
});
</script>

<template>
  <article v-if="article" class="reading-page">
    <NuxtLink class="back-link" to="/blog">← Todos los artículos</NuxtLink>
    <header class="page-intro">
      <p class="eyebrow">{{ article.category }}</p>
      <h1>{{ article.title }}</h1>
      <p class="lede">{{ article.summary }}</p>
      <time :datetime="article.publishedDate">{{
        FormatUtils.formatDate(article.publishedDate)
      }}</time>
    </header>
    <div class="prose">
      <p v-for="paragraph in article.paragraphs" :key="paragraph">{{ paragraph }}</p>
    </div>
  </article>
</template>
