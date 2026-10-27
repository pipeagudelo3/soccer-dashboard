<script setup lang="ts">
import { useAsyncData, useSeoMeta } from '#imports';
import ContentCard from '~/components/ContentCard.vue';
import PageIntro from '~/components/PageIntro.vue';
import { TeamService } from '~/services/TeamService';

const {
  data: teams,
  error,
  refresh,
  status,
} = await useAsyncData('teams', () => TeamService.getTeams());

useSeoMeta({
  title: 'Equipos | Soccer Dashboard',
  description: 'Descubre los equipos, países y estadios de nuestro catálogo de demostración.',
});
</script>

<template>
  <section>
    <PageIntro
      eyebrow="El catálogo"
      title="Cada club tiene su lugar"
      description="Cuatro equipos ficticios, cuatro identidades. Explora sus perfiles y conoce su historia."
    />
    <p v-if="status === 'pending'" role="status">Cargando equipos…</p>
    <div v-else-if="error" role="alert" class="notice">
      <p>No pudimos cargar los equipos.</p>
      <button type="button" @click="refresh()">Intentar de nuevo</button>
    </div>
    <div v-else-if="teams?.length" class="card-grid teams-grid">
      <ContentCard
        v-for="team in teams"
        :key="team.id"
        :eyebrow="team.country"
        :title="team.name"
        :to="`/teams/${team.id}`"
        ><p>{{ team.stadium }}</p></ContentCard
      >
    </div>
    <p v-else role="status">No hay equipos disponibles.</p>
    <p class="footnote">
      Este catálogo utiliza datos de demostración; no representa clubes reales.
    </p>
  </section>
</template>
