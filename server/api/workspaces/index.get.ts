import { listWorkspaces } from '../../modules/identity/access'
import { requireSession } from '../../modules/identity/session'
import { endpoint } from '../../utils/api'

export default endpoint(event => ({ items: listWorkspaces(requireSession(event), event.context.accessConfig) }))
