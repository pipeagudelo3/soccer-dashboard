<script setup lang="ts">
import { computed } from 'vue';

import { NuxtLink } from '#components';
import { createError, definePageMeta, useAsyncData, useRoute, useSeoMeta } from '#imports';
import { TeamService } from '~/services/TeamService';
import { FormatUtils } from '~/utils/FormatUtils';

// A new instance performs the awaited request and handles 404 for each team URL.
definePageMeta({ key: (route) => route.path });

const route = useRoute();
const id = computed(() => String(route.params.id));
const { data: team, error } = await useAsyncData(`team:${id.value}`, () =>
  TeamService.getTeamById(id.value),
);

if (error.value) {
  const isMissing = [400, 404].includes(error.value.statusCode ?? 500);
  throw createError({
    statusCode: isMissing ? 404 : 503,
    statusMessage: isMissing ? 'Team not found' : 'Teams temporarily unavailable',
    fatal: true,
  });
}

useSeoMeta({ title: () => `${team.value?.name ?? 'Equipo'} | Soccer Dashboard` });
</script>

<template>
  <article v-if="team" class="team-profile">
    <NuxtLink class="back-link" to="/teams">← Todos los equipos</NuxtLink>
    <header class="page-intro">
      <p class="eyebrow">{{ team.country }} · Perfil del club</p>
      <h1>{{ team.name }}</h1>
      <p class="lede">Una identidad dentro y fuera de la cancha.</p>
    </header>
    <dl class="team-facts">
      <div>
        <dt>País</dt>
        <dd>{{ team.country }}</dd>
      </div>
      <div>
        <dt>Estadio</dt>
        <dd>{{ team.stadium }}</dd>
      </div>
      <div>
        <dt>Fundación</dt>
        <dd>
          <time :datetime="team.foundedDate">{{ FormatUtils.formatDate(team.foundedDate) }}</time>
        </dd>
      </div>
    </dl>
    <p class="footnote">Equipo ficticio del catálogo de demostración.</p>
  </article>
</template>
