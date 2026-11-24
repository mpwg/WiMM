import { getQuery } from 'h3'
import { bookingFiltersSchema } from '../../../../shared/schemas/finance'
import { summarizeBookings } from '../../../modules/finance/service'
import { access, endpoint, parse } from '../../../utils/api'

export default endpoint(event => {
  const context = access(event, 'read')
  return summarizeBookings(event.context.storage, context, parse(bookingFiltersSchema, getQuery(event)))
})
