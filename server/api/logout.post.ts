import { noContent } from 'nitro/h3'
import { revokeSession } from '../modules/identity/session'
import { endpoint } from '../utils/api'

export default endpoint(event => {
  revokeSession(event)
  return noContent()
})
