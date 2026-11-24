import { loadIdentityConfig } from '../config'

export default defineNitroPlugin(nitro => {
  const identityConfig = loadIdentityConfig()
  nitro.hooks.hook('request', (event) => { event.context.identityConfig = identityConfig })
})
