import { getRouterParam } from 'nitro/h3'
import { getReceipt } from '../../../../modules/receipts/service'
import { access, endpoint } from '../../../../utils/api'

const extension = { 'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png' }

export default endpoint(event => {
  const context = access(event, 'read')
  const { storage, receiptsPath } = event.context
  const { metadata, data } = getReceipt(storage, receiptsPath, context, getRouterParam(event, 'id') ?? '')
  const filename = encodeURIComponent(metadata.originalName).replace(/['()*]/g, char => `%${char.charCodeAt(0).toString(16)}`)
  return new Response(data, {
    headers: {
      'cache-control': 'no-store',
      'content-disposition': `attachment; filename="Beleg.${extension[metadata.mediaType]}"; filename*=UTF-8''${filename}`,
      'content-length': String(metadata.size),
      'content-type': metadata.mediaType,
      'x-content-type-options': 'nosniff',
    },
  })
})
