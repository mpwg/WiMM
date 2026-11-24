import { getRouterParam } from 'nitro/h3'
import { confirmImport } from '../../../../../modules/imports/service'
import { access, endpoint } from '../../../../../utils/api'

export default endpoint(event => {
  const context = access(event, 'write')
  return confirmImport(event.context.storage, context, getRouterParam(event, 'id') ?? '')
})
