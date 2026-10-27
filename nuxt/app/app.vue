<script setup lang="ts">
import { NuxtLink, NuxtPage, NuxtRouteAnnouncer } from '#components';
</script>

<template>
  <div class="app-shell">
    <NuxtRouteAnnouncer />
    <a class="skip-link" href="#main-content">Saltar al contenido</a>
    <header class="site-header">
      <NuxtLink class="brand" to="/" aria-label="Soccer Dashboard: inicio">
        <span class="brand-mark" aria-hidden="true">SD</span>
        <span>Soccer<span class="brand-secondary">Dashboard</span></span>
      </NuxtLink>
      <nav aria-label="Navegación principal">
        <NuxtLink to="/" exact-active-class="active">Inicio</NuxtLink>
        <NuxtLink to="/blog" active-class="active">Blog</NuxtLink>
        <NuxtLink to="/teams" active-class="active">Equipos</NuxtLink>
        <NuxtLink to="/tools" active-class="active">Herramientas</NuxtLink>
      </nav>
    </header>
    <main id="main-content" tabindex="-1"><NuxtPage /></main>
    <footer class="site-footer">
      <span>Soccer Dashboard</span>
      <p>Un espacio para entender el juego. Datos de equipos ficticios.</p>
    </footer>
  </div>
</template>
