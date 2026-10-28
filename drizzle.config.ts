import { defineConfig } from 'drizzle-kit'
export default defineConfig({ dialect: 'sqlite', schema: './server/db/schema.ts', out: './migrations', dbCredentials: { url: process.env.NUXT_DATABASE_PATH ?? './.data/wimm.sqlite' } })
