import { defineConfig } from 'tsup'
export default defineConfig({ entry: ['tools/manage.ts'], format: ['esm'], platform: 'node', target: 'node24', outDir: 'tools', outExtension: () => ({ js: '.mjs' }) })
