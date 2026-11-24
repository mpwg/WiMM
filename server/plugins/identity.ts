import { definePlugin } from 'nitro'
import { loadIdentityConfig } from '../config'

export default definePlugin(nitro => {
  const identityConfig = loadIdentityConfig()
  nitro.hooks.hook('request', (event) => { (event.req.context ??= {}).identityConfig = identityConfig })
})
