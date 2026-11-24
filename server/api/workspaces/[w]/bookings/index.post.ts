import { bookingInputSchema } from '../../../../../shared/schemas/finance'
import { createBooking } from '../../../../modules/finance/service'
import { access, endpoint, parse, readJson } from '../../../../utils/api'

export default endpoint(async event => {
  const context = access(event, 'write')
  const booking = createBooking(event.context.storage, context, parse(bookingInputSchema, await readJson(event)))
  event.res.status = 201
  return booking
})
