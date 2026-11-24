import { getQuery } from 'nitro/h3'
import { bookingListSchema } from '../../../../../shared/schemas/finance'
import { listBookings } from '../../../../modules/finance/service'
import { access, endpoint, parse } from '../../../../utils/api'

export default endpoint(event => {
  const context = access(event, 'read')
  return listBookings(event.context.storage, context, parse(bookingListSchema, getQuery(event)))
})
