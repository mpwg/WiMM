import { getRouterParam } from 'nitro/h3'
import { getImport } from '../../../../modules/imports/service'
import { access, endpoint } from '../../../../utils/api'

export default endpoint(event => {
  const context = access(event, 'read')
  return getImport(event.context.storage, context, getRouterParam(event, 'id') ?? '')
})
