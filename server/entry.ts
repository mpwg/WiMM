import { defineServerEntry } from 'nitro'

export default defineServerEntry({
  maxRequestBodySize: 12 * 1024 * 1024,
})
