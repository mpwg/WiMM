import { getRouterParam, setResponseStatus } from 'h3'
import { z } from 'zod'
import { resourceCreateSchema, resourceUpdateSchema } from '../../shared/schemas/finance'
import { createResource, listResources, updateResource } from '../modules/finance/service'
import { access, endpoint, parse, readJson } from './api'

export function resourceRoutes(kind: 'accounts' | 'categories') {
  return {
    list: endpoint(event => listResources(event.context.storage, access(event, 'read'), kind)),
    create: endpoint(async event => {
      const context = access(event, 'manage')
      const { name } = parse(resourceCreateSchema, await readJson(event))
      const resource = createResource(event.context.storage, context, kind, name)
      setResponseStatus(event, 201)
      return resource
    }),
    update: endpoint(async event => {
      const context = access(event, 'manage')
      const id = parse(z.uuid(), getRouterParam(event, 'id'))
      const input = parse(resourceUpdateSchema, await readJson(event))
      return updateResource(event.context.storage, context, kind, id, input)
    }),
  }
}
