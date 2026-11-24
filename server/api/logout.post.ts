import { sendNoContent } from 'h3'
import { revokeSession } from '../modules/identity/session'
import { endpoint } from '../utils/api'

export default endpoint(event => {
  revokeSession(event)
  return sendNoContent(event)
})
