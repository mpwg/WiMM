import { getRouterParam } from 'nitro/h3'
import { z } from 'zod'
import { bookingUpdateSchema } from '../../../../../shared/schemas/finance'
import { updateBooking } from '../../../../modules/finance/service'
import { access, endpoint, parse, readJson } from '../../../../utils/api'

export default endpoint(async event => {
  const context = access(event, 'write')
  const id = parse(z.uuid(), getRouterParam(event, 'id'))
  return updateBooking(event.context.storage, context, id, parse(bookingUpdateSchema, await readJson(event)))
})
