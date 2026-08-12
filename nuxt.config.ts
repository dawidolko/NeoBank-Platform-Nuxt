// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-01-01',
  devtools: { enabled: true },

  modules: ['@nuxt/eslint', '@nuxt/fonts'],

  css: ['~/assets/css/main.css'],

  // Self-hosted so the app has a typographic identity offline and in Docker,
  // with no third-party request on first paint.
  fonts: {
    families: [
      { name: 'Inter', provider: 'google', weights: [400, 500, 600, 700], styles: ['normal'] },
      { name: 'JetBrains Mono', provider: 'google', weights: [400, 500], styles: ['normal'] },
    ],
    defaults: { subsets: ['latin', 'latin-ext'] },
  },

  future: {
    compatibilityVersion: 4,
  },

  nitro: {
    // Standalone bundle so the production image can run on a bare Node runtime.
    preset: 'node-server',
    // Standing orders are paid by a scheduled task rather than on page load,
    // so they fire whether or not anyone is using the app.
    experimental: { tasks: true },
    scheduledTasks: {
      // Hourly: an order due at 09:00 is paid within the hour, and a missed
      // window is caught up on the next tick rather than skipped.
      '0 * * * *': ['standing-orders:run'],
    },
    // Money is BigInt end to end; the default es2019 target cannot emit BigInt
    // literals and would break the ledger at runtime.
    esbuild: {
      options: { target: 'es2022' },
    },
  },

  vite: {
    build: { target: 'es2022' },
    esbuild: { target: 'es2022' },
    optimizeDeps: { esbuildOptions: { target: 'es2022' } },
  },

  runtimeConfig: {
    sessionTtlHours: '720', // NUXT_SESSION_TTL_HOURS — 30 days
    public: {
      appName: 'NeoBank',
    },
  },

  typescript: {
    strict: true,
    typeCheck: false, // run explicitly via `npm run typecheck`
  },

  // Security headers. A banking UI must never be framable, and the CSP keeps
  // any injected markup from reaching an outside origin.
  routeRules: {
    '/**': {
      headers: {
        'x-frame-options': 'DENY',
        'x-content-type-options': 'nosniff',
        'referrer-policy': 'strict-origin-when-cross-origin',
        'permissions-policy': 'camera=(), microphone=(), geolocation=(), payment=()',
        'content-security-policy': [
          "default-src 'self'",
          // Nuxt inlines its hydration payload and the theme bootstrap script.
          "script-src 'self' 'unsafe-inline'",
          "style-src 'self' 'unsafe-inline'",
          "img-src 'self' data:",
          "font-src 'self' data:",
          "connect-src 'self'",
          "form-action 'self'",
          "frame-ancestors 'none'",
          "base-uri 'self'",
          "object-src 'none'",
        ].join('; '),
      },
    },
    // The statement export is per-user data; never let a proxy cache it.
    '/api/**': { headers: { 'cache-control': 'no-store' } },
  },

  app: {
    head: {
      title: 'NeoBank — Digital Banking Platform',
      htmlAttrs: { lang: 'en' },
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'theme-color', content: '#3b5bfd' },
      ],
      link: [
        { rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' },
        { rel: 'manifest', href: '/site.webmanifest' },
      ],
      script: [
        {
          // Applies the stored theme before first paint, so a dark-mode user
          // never sees a white flash on load.
          innerHTML: `(()=>{try{var t=localStorage.getItem('neobank-theme');if(t==='dark'||t==='light')document.documentElement.setAttribute('data-theme',t)}catch(e){}})()`,
          tagPosition: 'head',
        },
      ],
    },
    pageTransition: { name: 'page', mode: 'out-in' },
  },
})
