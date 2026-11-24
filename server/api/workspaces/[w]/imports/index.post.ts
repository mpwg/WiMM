import { importMappingSchema } from '../../../../../shared/schemas/imports'
import { MAX_CSV_BYTES } from '../../../../modules/imports/normalize'
import { previewImport } from '../../../../modules/imports/service'
import { access, ApiError, endpoint, parse } from '../../../../utils/api'
import { readUpload } from '../../../../utils/uploads'

export default endpoint(async event => {
  const context = access(event, 'write')
  const { file, fields } = await readUpload(event, MAX_CSV_BYTES, ['mapping'])
  let mapping: unknown
  try {
    mapping = JSON.parse(fields.get('mapping') ?? '')
  } catch {
    throw new ApiError(422, 'validation_failed', 'Die Anfrage enthält keine gültige Spaltenzuordnung.')
  }
  const result = previewImport(event.context.storage, context, await file.bytes(), parse(importMappingSchema, mapping))
  event.res.status = 201
  return result
})
