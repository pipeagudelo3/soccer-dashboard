<script setup lang="ts">
import { computed } from 'vue';
import { RouterLink } from 'vue-router';

import { MatchStatsService } from '@/services/MatchStatsService.js';
import { PlayerService } from '@/services/PlayerService.js';
import { TeamService } from '@/services/TeamService.js';
import { useAuthStore } from '@/stores/authstore.js';

const authStore = useAuthStore();

const teams = computed(() => TeamService.getTeams());
const players = computed(() => PlayerService.getPlayers());
const matchStats = computed(() => MatchStatsService.getMatchStats());

const summaryCards = computed(() => [
  { label: 'Teams', value: teams.value.length },
  { label: 'Players', value: players.value.length },
  { label: 'Recorded matches', value: matchStats.value.length },
]);
</script>

<template>
  <div class="home-view">
    <section class="hero">
      <h1>Football Dashboard</h1>
      <p>
        Track teams, players, and match statistics in one place. Log in to explore filterable tables
        and charts built from the current season's data.
      </p>

      <div class="hero-actions">
        <RouterLink v-if="!authStore.isAuthenticated" :to="{ name: 'login' }" class="cta-primary">
          Log in
        </RouterLink>
        <RouterLink v-else :to="{ name: 'dashboard' }" class="cta-primary">
          Go to dashboard
        </RouterLink>
        <RouterLink :to="{ name: 'about' }" class="cta-secondary">Learn more</RouterLink>
      </div>
    </section>

    <section class="summary-grid">
      <article v-for="card in summaryCards" :key="card.label" class="summary-card">
        <span class="summary-value">{{ card.value }}</span>
        <span class="summary-label">{{ card.label }}</span>
      </article>
    </section>

    <section class="teams-preview">
      <h2>Featured teams</h2>
      <div class="teams-grid">
        <article v-for="team in teams" :key="team.id" class="team-card">
          <img :src="team.logoURL" :alt="`${team.name} logo`" class="team-logo" />
          <div>
            <strong>{{ team.name }}</strong>
            <p>{{ team.country }} &middot; {{ team.stadium }}</p>
          </div>
        </article>
      </div>
    </section>
  </div>
</template>

<style scoped>
.home-view {
  display: flex;
  flex-direction: column;
  gap: 2.5rem;
}

.hero {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 2.5rem;
  color: #ffffff;
  background: linear-gradient(135deg, #0f172a, #1d4ed8);
  border-radius: 1rem;
}

.hero h1 {
  margin: 0;
  font-size: 2rem;
}

.hero p {
  max-width: 40rem;
  margin: 0;
  color: #dbeafe;
}

.hero-actions {
  display: flex;
  gap: 0.75rem;
}

.cta-primary,
.cta-secondary {
  padding: 0.65rem 1.25rem;
  font-size: 0.9rem;
  font-weight: 600;
  text-decoration: none;
  border-radius: 0.5rem;
}

.cta-primary {
  color: #0f172a;
  background-color: #ffffff;
}

.cta-primary:hover {
  background-color: #e2e8f0;
}

.cta-secondary {
  color: #ffffff;
  border: 1px solid rgba(255, 255, 255, 0.4);
}

.cta-secondary:hover {
  background-color: rgba(255, 255, 255, 0.12);
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr));
  gap: 1rem;
}

.summary-card {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  padding: 1.25rem;
  background-color: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 0.75rem;
}

.summary-value {
  font-size: 1.75rem;
  font-weight: 700;
  color: #0f172a;
}

.summary-label {
  color: #64748b;
  font-size: 0.85rem;
}

.teams-preview h2 {
  margin: 0 0 1rem;
  color: #0f172a;
}

.teams-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(14rem, 1fr));
  gap: 1rem;
}

.team-card {
  display: flex;
  align-items: center;
  gap: 0.85rem;
  padding: 1rem;
  background-color: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 0.75rem;
}

.team-logo {
  width: 3rem;
  height: 3rem;
  border-radius: 0.5rem;
  object-fit: cover;
}

.team-card p {
  margin: 0.15rem 0 0;
  color: #64748b;
  font-size: 0.8rem;
}
</style>
