import { getRouterParam } from 'nitro/h3'
import { MAX_RECEIPT_BYTES } from '../../../../../modules/receipts/files'
import { addReceipt } from '../../../../../modules/receipts/service'
import { access, endpoint } from '../../../../../utils/api'
import { readUpload } from '../../../../../utils/uploads'

export default endpoint(async event => {
  const context = access(event, 'write')
  const { file } = await readUpload(event, MAX_RECEIPT_BYTES)
  const { storage, receiptsPath } = event.context
  const result = addReceipt(storage, receiptsPath, context, getRouterParam(event, 'id') ?? '', file.name, await file.bytes())
  event.res.status = 201
  return result
})
