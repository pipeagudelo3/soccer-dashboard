<script setup lang="ts">
import { useSeoMeta } from '#imports';
import ContentCard from '~/components/ContentCard.vue';
import PageIntro from '~/components/PageIntro.vue';
import { ArticleService } from '~/services/ArticleService';
import { FormatUtils } from '~/utils/FormatUtils';

const articles = ArticleService.getArticles();

useSeoMeta({
  title: 'Blog | Soccer Dashboard',
  description: 'Lecturas breves sobre equipos y estadísticas de fútbol.',
});
</script>

<template>
  <section>
    <PageIntro
      eyebrow="Desde la tribuna"
      title="Ideas para entender el juego"
      description="Una selección de lecturas breves para mirar más allá del marcador."
    />
    <div class="card-grid">
      <ContentCard
        v-for="article in articles"
        :key="article.slug"
        :eyebrow="article.category"
        :title="article.title"
        :to="`/blog/${article.slug}`"
      >
        <p>{{ article.summary }}</p>
        <time :datetime="article.publishedDate">{{
          FormatUtils.formatDate(article.publishedDate)
        }}</time>
      </ContentCard>
    </div>
  </section>
</template>
