import { defineNuxtConfig } from 'nuxt/config';

export default defineNuxtConfig({
  app: {
    head: {
      htmlAttrs: { lang: 'es' },
      title: 'Soccer Dashboard',
      meta: [
        {
          name: 'description',
          content: 'Equipos, análisis y herramientas para entender el fútbol.',
        },
      ],
    },
  },
  compatibilityDate: '2026-10-24',
  components: false,
  css: ['~/assets/main.css'],
  devtools: { enabled: false },
  imports: { autoImport: false },
  modules: ['@nuxt/eslint'],
  nitro: {
    preset: 'node-server',
    // Only the editorial section is generated at build time; teams need the running server.
    prerender: {
      crawlLinks: false,
      failOnError: true,
      routes: [
        '/blog',
        '/blog/leer-la-tabla',
        '/blog/conocer-un-equipo',
        '/blog/comparar-con-contexto',
      ],
    },
  },
  routeRules: {
    '/': { ssr: true },
    '/blog': { prerender: true },
    '/blog/**': { prerender: true },
    '/teams': { prerender: false, ssr: true },
    '/teams/**': { prerender: false, ssr: true },
    '/tools': { prerender: false, ssr: false },
    '/tools/**': { prerender: false, ssr: false },
  },
  typescript: { strict: true, tsConfig: { compilerOptions: { noUncheckedIndexedAccess: true } } },
});
