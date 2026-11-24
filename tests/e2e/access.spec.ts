import { expect, test } from '@playwright/test'

test('enforces reader and editor permissions on the built API', async ({ page, context, baseURL }) => {
  await page.goto('/')
  await page.getByRole('link', { name: 'Anmelden' }).click()
  await expect(page.getByRole('button', { name: 'Abmelden' })).toBeVisible()
  const response = await context.request.get('/api/session')
  expect(response.status()).toBe(200)
  const session = await response.json()
  const reader = session.workspaces.find((workspace: { role: string }) => workspace.role === 'reader')
  const editor = session.workspaces.find((workspace: { role: string }) => workspace.role === 'editor')
  expect(reader).toMatchObject({ name: 'Archiv' })
  expect(editor).toMatchObject({ name: 'Projekte' })

  const headers = { origin: baseURL!, 'x-csrf-token': session.csrfToken }
  expect((await context.request.get(`/api/workspaces/${reader.id}/bookings`)).status()).toBe(200)
  expect((await context.request.post(`/api/workspaces/${reader.id}/bookings`, { headers, data: {} })).status()).toBe(403)
  expect((await context.request.post(`/api/workspaces/${editor.id}/bookings`, { headers, data: {} })).status()).toBe(422)
  expect((await context.request.post(`/api/workspaces/${editor.id}/accounts`, { headers, data: { name: 'Bargeld' } })).status()).toBe(403)
  expect((await context.request.get('/api/workspaces/ef3844b8-25d9-47ae-914b-5af89a004fe8/bookings')).status()).toBe(404)
})
