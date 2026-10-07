// SPDX-License-Identifier: AGPL-3.0-or-later
import { expect, test } from '@playwright/test';
import { navigate, openAccountAction } from '../helpers/ui.js';
import type { TransferAggregate } from '../../packages/domain/src/index.js';
test('Übersicht öffnet das vorhandene Transferpaar für Änderung und Löschung', async ({ page }, info) => {
  await page.clock.setFixedTime(new Date('2026-10-07T12:00:00Z'));
  await page.goto(`/tests/workspace.html?p44=true&desktop=${info.project.name.startsWith('Desktop')}`);
  const form = await openAccountAction(page, 'Testkonto', 'Umbuchen');
  await form.getByLabel('Nach', { exact: true }).selectOption({ label: 'Zielkonto' }); await form.getByLabel('Umbuchungsbetrag').fill('200'); await form.getByRole('button', { name: 'Umbuchung speichern' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const read = () => page.evaluate(() => window.workspaceTest.read());
  const before = await read(); const original = before.find(a => a.aggregateType === 'transfer') as unknown as TransferAggregate;
  async function overviewDetail() {
    await navigate(page, 'Übersicht');
    await page.locator('.overview-columns .plain-list li').filter({ hasText: 'Zielkonto' }).getByRole('button').click();
    return page.getByRole('dialog');
  }
  let dialog = await overviewDetail(); await dialog.getByRole('button', { name: 'Bearbeiten', exact: true }).click();
  await expect(dialog.getByLabel('Umbuchungsbetrag')).toHaveValue('200,00'); await expect(dialog.getByLabel('Nach', { exact: true })).toHaveValue(original.targetAccountId);
  await dialog.getByLabel('Umbuchungsbetrag').fill('300'); await dialog.getByRole('button', { name: 'Umbuchung ändern' }).click(); await expect(dialog).toHaveCount(0);
  const after = await read(); const edited = after.find(a => a.id === original.id) as unknown as TransferAggregate;
  expect(edited).toMatchObject({ sourceTransactionId: original.sourceTransactionId, targetTransactionId: original.targetTransactionId, amount: 30000 });
  expect(after.filter(a => a.aggregateType === 'transaction')).toHaveLength(before.filter(a => a.aggregateType === 'transaction').length);
  dialog = await overviewDetail(); await dialog.getByRole('button', { name: 'Löschen', exact: true }).click(); await dialog.getByRole('button', { name: 'Löschen bestätigen' }).click(); await expect(dialog).toHaveCount(0);
  const deleted = await read(); for (const id of [original.id, original.sourceTransactionId, original.targetTransactionId]) expect(deleted.find(a => a.id === id)?.deletedAt).toBeDefined();
  expect(deleted.filter(a => a.aggregateType === 'transaction' && !a.deletedAt)).toHaveLength(1);
});
