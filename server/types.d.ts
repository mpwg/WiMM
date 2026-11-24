import type { Connection } from './db/client'
import type { IdentityConfig } from './config'
import type { AccessConfig } from '../shared/schemas/access'
declare module 'h3' {
  interface H3EventContext { storage: Connection, receiptsPath: string, accessConfig: AccessConfig, identityConfig: IdentityConfig | null }
}
export {}
