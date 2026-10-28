import type { Connection } from './db/client'
import type { AccessConfig } from '../shared/schemas/access'
declare module 'h3' {
  interface H3EventContext { storage: Connection, accessConfig: AccessConfig }
}
export {}
