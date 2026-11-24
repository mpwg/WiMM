import { listWorkspaces } from '../modules/identity/access'
import { requireSession } from '../modules/identity/session'
import { endpoint } from '../utils/api'

export default endpoint(event => {
  const session = requireSession(event)
  return {
    user: { id: session.userId, displayName: session.displayName },
    csrfToken: session.csrfToken,
    workspaces: listWorkspaces(session, event.context.accessConfig),
  }
})
