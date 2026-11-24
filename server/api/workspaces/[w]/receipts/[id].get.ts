import { getRouterParam, send, setResponseHeaders } from 'h3'
import { getReceipt } from '../../../../modules/receipts/service'
import { access, endpoint } from '../../../../utils/api'

const extension = { 'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png' }

export default endpoint(event => {
  const context = access(event, 'read')
  const { storage, receiptsPath } = event.context
  const { metadata, data } = getReceipt(storage, receiptsPath, context, getRouterParam(event, 'id') ?? '')
  const filename = encodeURIComponent(metadata.originalName).replace(/['()*]/g, char => `%${char.charCodeAt(0).toString(16)}`)
  setResponseHeaders(event, {
    'cache-control': 'no-store',
    'content-disposition': `attachment; filename="Beleg.${extension[metadata.mediaType]}"; filename*=UTF-8''${filename}`,
    'content-length': metadata.size,
    'x-content-type-options': 'nosniff',
  })
  return send(event, data, metadata.mediaType)
})
