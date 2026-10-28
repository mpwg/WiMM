import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { z } from 'zod'
import { accessConfigSchema } from '../shared/schemas/access'

const configSchema = z.object({
  databasePath: z.string().min(1), receiptsPath: z.string().min(1), accessConfigPath: z.string().min(1),
  groupsMaxAgeSeconds: z.coerce.number().int().min(1).max(900),
})

export function loadStorageConfig(env = process.env) {
  const config = configSchema.parse({
    databasePath: env.NUXT_DATABASE_PATH ?? './.data/wimm.sqlite',
    receiptsPath: env.NUXT_RECEIPTS_PATH ?? './.data/receipts',
    accessConfigPath: env.NUXT_ACCESS_CONFIG_PATH ?? './deploy/access.json',
    groupsMaxAgeSeconds: env.NUXT_GROUPS_MAX_AGE_SECONDS ?? 900,
  })
  const access = accessConfigSchema.parse(JSON.parse(readFileSync(resolve(config.accessConfigPath), 'utf8')))
  return { ...config, access }
}
