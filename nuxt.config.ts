// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-01-01',
  devtools: { enabled: true },

  modules: ['@nuxt/eslint'],

  css: ['~/assets/css/main.css'],

  future: {
    compatibilityVersion: 4,
  },

  nitro: {
    // Standalone bundle so the production image can run on a bare Node runtime.
    preset: 'node-server',
  },

  runtimeConfig: {
    sessionSecret: '', // NUXT_SESSION_SECRET
    sessionTtlHours: '720', // NUXT_SESSION_TTL_HOURS — 30 days
    public: {
      appName: 'NeoBank',
    },
  },

  typescript: {
    strict: true,
    typeCheck: false, // run explicitly via `npm run typecheck`
  },

  app: {
    head: {
      title: 'NeoBank — Digital Banking Platform',
      htmlAttrs: { lang: 'en' },
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        {
          name: 'description',
          content:
            'NeoBank — a fullstack digital banking platform with accounts, transfers and real-time transaction history.',
        },
      ],
    },
  },
})
