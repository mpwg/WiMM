import { getRouterParam } from 'nitro/h3'
import { z } from 'zod'
import { getBooking } from '../../../../modules/finance/service'
import { listReceipts } from '../../../../modules/receipts/service'
import { access, endpoint, parse } from '../../../../utils/api'

export default endpoint(event => {
  const context = access(event, 'read')
  const id = parse(z.uuid(), getRouterParam(event, 'id'))
  const { storage } = event.context
  return { ...getBooking(storage, context, id), receipts: listReceipts(storage, context, id) }
})
