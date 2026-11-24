import { getRouterParam, noContent } from 'nitro/h3'
import { z } from 'zod'
import { versionSchema } from '../../../../../shared/schemas/finance'
import { deleteBookingWithReceipts } from '../../../../modules/receipts/service'
import { access, endpoint, parse } from '../../../../utils/api'

export default endpoint(event => {
  const context = access(event, 'write')
  const id = parse(z.uuid(), getRouterParam(event, 'id'))
  const match = /^"([1-9]\d{0,15})"$/.exec(event.req.headers.get('if-match') ?? '')
  const version = parse(versionSchema, match ? Number(match[1]) : undefined)
  deleteBookingWithReceipts(event.context.storage, event.context.receiptsPath, context, id, version)
  return noContent()
})
