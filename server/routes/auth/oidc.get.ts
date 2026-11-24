import { defineEventHandler } from 'h3'
import { oidc } from '../../modules/identity/oidc'

export default defineEventHandler(oidc)
