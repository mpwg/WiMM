export default defineNuxtConfig({
  compatibilityDate: '2026-10-28',
  ssr: false,
  devtools: { enabled: false },
  modules: ['@nuxt/ui'],
  css: ['~/assets/css/main.css'],
  ui: { fonts: false },
  nitro: {
    // Bun runs the streaming HTTP entrypoint so uploads can be limited before buffering.
    preset: 'node-server',
    ignore: ['modules/**'],
    esbuild: { options: { target: 'es2022' } },
  },
  runtimeConfig: {
    databasePath: './.data/wimm.sqlite',
    receiptsPath: './.data/receipts',
    accessConfigPath: './deploy/access.json',
    oidcIssuer: '', oidcScopes: 'openid,profile,email,groups',
    oidcGroupsClaim: 'groups', groupsMaxAgeSeconds: 900,
    public: { appUrl: 'http://localhost:3000' },
  },
  routeRules: {
    '/api/**': { headers: { 'cache-control': 'no-store' } },
    '/auth/**': { headers: { 'cache-control': 'no-store' } },
    '/health/**': { headers: { 'cache-control': 'no-store' } },
  },
  app: {
    head: {
      title: 'WiMM',
      htmlAttrs: { lang: 'de' },
      meta: [
        { name: 'description', content: 'Einnahmen und Ausgaben gemeinsam verwalten.' },
        { name: 'theme-color', content: '#163d32' },
      ],
      link: [
        { rel: 'manifest', href: '/manifest.webmanifest' },
        { rel: 'icon', href: '/icons/wimm-192.png', type: 'image/png' },
        { rel: 'apple-touch-icon', href: '/icons/wimm-192.png' },
      ],
    },
  },
})
