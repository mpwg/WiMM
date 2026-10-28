export default defineNuxtConfig({
  compatibilityDate: '2026-10-28',
  ssr: false,
  devtools: { enabled: false },
  modules: ['@nuxt/ui', 'nuxt-auth-utils'],
  css: ['~/assets/css/main.css'],
  ui: { fonts: false },
  nitro: { preset: 'node-server' },
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
  app: { head: { title: 'WiMM', htmlAttrs: { lang: 'de' }, meta: [{ name: 'description', content: 'Einnahmen und Ausgaben gemeinsam verwalten.' }] } },
})
