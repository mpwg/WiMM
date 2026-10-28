export default defineEventHandler(event => {
  // No login is issued until the complete OIDC validation is implemented.
  setResponseStatus(event, 401)
  return { error: { code: 'unauthenticated', message: 'Bitte anmelden.', fields: {} } }
})
