import { z } from 'zod'

export const roleSchema = z.enum(['reader', 'editor', 'owner'])
export type Role = z.infer<typeof roleSchema>
export const accessConfigSchema = z.object({
  workspaces: z.array(z.object({ id: z.uuid(), name: z.string().trim().min(1).max(120), currency: z.literal('EUR') }).strict()),
  groupMappings: z.array(z.object({ group: z.string().min(1), workspaceId: z.uuid(), role: roleSchema }).strict()),
}).strict().superRefine((config, ctx) => {
  const ids = new Set(config.workspaces.map(w => w.id))
  if (ids.size !== config.workspaces.length) ctx.addIssue({ code: 'custom', message: 'Duplicate workspace ID' })
  for (const mapping of config.groupMappings) {
    if (!ids.has(mapping.workspaceId)) ctx.addIssue({ code: 'custom', message: 'Mapping references an unknown workspace' })
  }
})
export type AccessConfig = z.infer<typeof accessConfigSchema>
