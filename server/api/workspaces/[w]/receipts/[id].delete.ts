import { getRouterParam, sendNoContent } from 'h3'
import { deleteReceipt } from '../../../../modules/receipts/service'
import { access, endpoint } from '../../../../utils/api'

export default endpoint(event => {
  const context = access(event, 'write')
  const { storage, receiptsPath } = event.context
  deleteReceipt(storage, receiptsPath, context, getRouterParam(event, 'id') ?? '')
  sendNoContent(event)
})
