import { expect, test, type Page } from '@playwright/test'

async function login(page: Page) {
  await page.goto('/')
  await page.getByRole('link', { name: 'Anmelden' }).click()
  await expect(page.getByRole('heading', { name: 'Buchungen', exact: true })).toBeVisible()
  await page.getByLabel('Bereich', { exact: true }).selectOption({ label: 'Haushalt' })
}

async function addResource(page: Page, view: 'Konten' | 'Kategorien', label: 'Konto anlegen' | 'Kategorie anlegen', name: string) {
  await page.getByRole('link', { name: view, exact: true }).click()
  await page.getByRole('button', { name: label }).click()
  const dialog = page.getByRole('dialog', { name: label })
  await dialog.getByLabel(/Name/).fill(name)
  await dialog.getByRole('button', { name: label }).click()
  await expect(dialog).toBeHidden()
  await expect(page.getByText(name, { exact: true })).toBeVisible()
}

test('Buchungen filtern, Konflikt auflösen, Belege verwalten und Buchung löschen', async ({ page }, info) => {
  const account = `Girokonto ${info.project.name}`
  const category = `Lebensmittel ${info.project.name}`
  const description = `Wocheneinkauf ${info.project.name}`
  await login(page)
  await addResource(page, 'Konten', 'Konto anlegen', account)
  await addResource(page, 'Kategorien', 'Kategorie anlegen', category)
  await page.getByRole('link', { name: 'Buchungen', exact: true }).click()
  await page.getByRole('button', { name: 'Neue Buchung' }).click()
  const create = page.getByRole('dialog', { name: 'Neue Buchung' })
  await create.getByLabel(/Betrag in Euro/).fill('0')
  await create.getByLabel(/Datum/).fill('2026-11-14')
  await create.getByLabel(/Konto/).selectOption({ label: account })
  await create.getByRole('combobox', { name: 'Kategorie', exact: true }).selectOption({ label: category })
  await create.getByLabel('Beschreibung').fill(description)
  await create.getByRole('button', { name: 'Buchung anlegen' }).click()
  await expect(create.getByText(/größer als null/)).toBeVisible()
  await create.getByLabel(/Betrag in Euro/).fill('12,34')
  await create.getByRole('button', { name: 'Buchung anlegen' }).click()
  await expect(create).toBeHidden()
  const row = page.getByRole('button', { name: description, exact: true })
  await expect(row).toBeVisible()

  const filter = page.getByRole('button', { name: 'Filter', exact: true })
  if (await filter.isVisible()) await filter.click()
  const filters = page.getByRole('form', { name: 'Filter' })
  await filters.getByRole('combobox', { name: 'Konto', exact: true }).selectOption({ label: account })
  await filters.getByLabel('Von').fill('2026-11-14')
  await filters.getByLabel('Bis').fill('2026-11-14')
  await filters.getByRole('button', { name: 'Anwenden' }).click()
  await expect(row).toBeVisible()
  await expect(page.getByRole('row').filter({ has: row })).toContainText('12,34')

  await row.click()
  const editor = page.getByRole('dialog', { name: 'Buchung bearbeiten' })
  await expect(editor.getByLabel('Beschreibung')).toHaveValue(description)
  const { workspaces, csrfToken } = await (await page.request.get('/api/session')).json()
  const workspace = workspaces.find((item: { name: string }) => item.name === 'Haushalt')
  const bookingList = await page.request.get(`/api/workspaces/${workspace.id}/bookings`)
  const { items } = await bookingList.json()
  const booking = items.find((item: { description: string }) => item.description === description)
  const serverPatch = await page.request.patch(`/api/workspaces/${workspace.id}/bookings/${booking.id}`, {
    headers: { Origin: 'http://127.0.0.1:3000', 'X-CSRF-Token': csrfToken },
    data: { version: booking.version, accountId: booking.accountId, categoryId: booking.categoryId, date: booking.date, amountCents: booking.amountCents, description: description + ' aktualisiert' },
  })
  expect(serverPatch.status()).toBe(200)
  await editor.getByLabel('Beschreibung').fill(description + ' Entwurf')
  await editor.getByRole('button', { name: 'Änderungen speichern' }).click()
  await expect(editor.getByRole('button', { name: 'Aktuelle Version laden' })).toBeVisible()
  await expect(editor.getByLabel('Beschreibung')).toHaveValue(description + ' Entwurf')
  await editor.getByRole('button', { name: 'Aktuelle Version laden' }).click()
  await expect(editor.getByLabel('Beschreibung')).toHaveValue(description + ' aktualisiert')
  await editor.getByLabel('Beschreibung').fill(description + ' geprüft')
  await editor.getByRole('button', { name: 'Änderungen speichern' }).click()
  await expect(editor).toBeHidden()
  const savedRow = page.getByRole('button', { name: description + ' geprüft', exact: true })
  await savedRow.click()

  await editor.getByLabel(/Belegdatei/).setInputFiles({
    name: 'rechnung.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF\n'),
  })
  await editor.getByRole('button', { name: 'Beleg hinzufügen' }).click()
  await expect(editor.getByText('rechnung.pdf', { exact: true })).toBeVisible()
  const downloading = page.waitForEvent('download')
  await editor.getByRole('button', { name: 'rechnung.pdf herunterladen' }).click()
  const download = await downloading
  expect(download.suggestedFilename()).toBe('rechnung.pdf')
  await editor.getByRole('button', { name: 'rechnung.pdf entfernen' }).click()
  await editor.getByRole('button', { name: 'Beleg endgültig entfernen' }).click()
  await expect(editor.getByText('rechnung.pdf', { exact: true })).toBeHidden()

  await editor.getByRole('button', { name: 'Buchung löschen', exact: true }).click()
  await expect(editor.getByRole('button', { name: 'Buchung behalten' })).toBeFocused()
  await editor.getByRole('button', { name: 'Buchung endgültig löschen' }).click()
  await expect(editor).toBeHidden()
  await expect(savedRow).toBeHidden()

  await page.getByRole('link', { name: 'Konten', exact: true }).click()
  await page.getByRole('button', { name: account + ' bearbeiten' }).click()
  const accountEditor = page.getByRole('dialog', { name: 'Konto bearbeiten' })
  await accountEditor.getByLabel(/Name/).fill(account + ' umbenannt')
  await accountEditor.getByRole('button', { name: 'Änderungen speichern' }).click()
  await page.getByRole('button', { name: account + ' umbenannt bearbeiten' }).click()
  await accountEditor.getByRole('button', { name: 'Konto archivieren' }).click()
  await expect(accountEditor.getByRole('button', { name: 'Behalten' })).toBeFocused()
  await accountEditor.getByRole('button', { name: 'Konto archivieren' }).click()
  await expect(accountEditor).toBeHidden()
  await expect(page.getByRole('listitem').filter({ hasText: account + ' umbenannt' })).toContainText('Archiviert')
})

test('CSV-Zuordnung und Importvorschau bleiben im gewählten Bereich', async ({ page }, info) => {
  const account = `CSV-Konto ${info.project.name}`
  const category = `CSV-Kategorie ${info.project.name}`
  const description = `Mitgliedsbeitrag ${info.project.name}`
  await login(page)
  await addResource(page, 'Konten', 'Konto anlegen', account)
  await addResource(page, 'Kategorien', 'Kategorie anlegen', category)
  await page.getByRole('link', { name: 'CSV-Import' }).click()
  await page.getByLabel(/CSV-Datei/).setInputFiles({
    name: 'beitraege.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(`Datum;Betrag;Beschreibung;Kategorie\n24.11.2026;20,10;${description};Beiträge extern\n`),
  })
  await page.getByLabel(/Zielkonto/).selectOption({ label: account })
  await page.getByRole('group', { name: 'Spaltenpositionen' }).getByLabel('Kategorie', { exact: true }).fill('4')
  await page.getByRole('button', { name: 'Vorschau erstellen', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Importvorschau', exact: true })).toBeFocused()
  await expect(page.getByRole('button', { name: 'Buchungen importieren' })).toBeHidden()
  await page.getByLabel(/Beiträge extern/).selectOption({ label: category })
  await page.getByRole('button', { name: 'Vorschau neu erstellen' }).click()
  await expect(page.getByRole('row').filter({ hasText: description })).toContainText('20,10')
  await page.getByRole('button', { name: 'Buchungen importieren' }).click()
  await expect(page.getByRole('heading', { name: 'Import abgeschlossen' })).toBeVisible()
  await page.getByRole('link', { name: 'Zu den Buchungen' }).click()
  const row = page.getByRole('button', { name: description, exact: true })
  await expect(row).toBeVisible()
  await page.getByLabel('Bereich', { exact: true }).selectOption({ label: 'Verein' })
  await expect(row).toBeHidden()
  await expect(page.getByText('In diesem Bereich gibt es noch keine Buchungen.')).toBeVisible()
  await page.getByLabel('Bereich', { exact: true }).selectOption({ label: 'Haushalt' })
  await expect(row).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})
