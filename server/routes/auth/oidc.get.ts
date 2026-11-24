import { defineHandler } from 'nitro/h3'
import { oidc } from '../../modules/identity/oidc'

export default defineHandler(oidc)
