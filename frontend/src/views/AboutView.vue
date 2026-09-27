<template>
  <section class="about-view">
    <h1>About Soccer Dashboard</h1>
    <p>
      Soccer Dashboard is an academic Vue 3 and TypeScript application for exploring teams, players,
      match results, and season statistics.
    </p>
    <p>
      It combines role-based access, reusable data tables, filters, and Chart.js visualizations in a
      single responsive interface.
    </p>
  </section>
</template>

<style scoped>
.about-view {
  max-width: 48rem;
  padding: 2rem;
  background-color: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 1rem;
}

.about-view h1 {
  margin: 0 0 1rem;
  color: #0f172a;
}

.about-view p {
  margin: 0;
}

.about-view p + p {
  margin-top: 0.75rem;
}
</style>
