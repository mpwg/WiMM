// SPDX-License-Identifier: AGPL-3.0-or-later
import { afterEach, expect, it, vi } from 'vitest';
import { ApplicationActivity, ProfileApplication, createMemoryProfileStore } from './index.js';
afterEach(() => vi.unstubAllGlobals());
it('führt Tresor-/Profilabläufe ohne UI oder Browserpersistenz mit ausdrücklicher Rettungsbestätigung aus', async () => {
  for (const name of ['window', 'document', 'navigator', 'localStorage', 'Worker']) vi.stubGlobal(name, undefined);
  let counter = 1;
  const store = createMemoryProfileStore();
  const activity = new ApplicationActivity();
  const app = new ProfileApplication(store, { next: () => `50000000-0000-4000-8000-${String(counter++).padStart(12, '0')}` }, activity);
  const passphrase = 'synthetische-anwendungs-passphrase';
  try {
    await app.start(); expect(app.getSnapshot().screen.kind).toBe('create');
    await app.prepare(passphrase);
    const prepared = app.getSnapshot().screen;
    expect(prepared.kind === 'create' && typeof prepared.recoveryCode).toBe('string');
    await app.confirmRecovery(passphrase, false); expect(await store.load()).toEqual({ kind: 'missing' });
    await app.confirmRecovery(passphrase, true); expect(app.getSnapshot().screen.kind).toBe('unlock');
    await app.unlock('synthetisch-falsch', false); expect(app.getSnapshot().screen.kind).toBe('unlock');
    await app.unlock(passphrase, false); expect(app.getSnapshot().screen.kind).toBe('unlocked');
    const before = await store.load();
    const release = activity.beginFinance();
    await app.changeArea(); expect(await store.load()).toEqual(before); release();
    await app.changeArea();
    const screen = app.getSnapshot().screen;
    expect(screen.kind === 'unlocked' && screen.profile.areas.length).toBe(2);
    await app.lock(); expect(app.getSnapshot().screen.kind).toBe('unlock');
  } finally { app.dispose(); }
});
it('gemeinsame Sperre blockiert Profil und Finanzseite gegenseitig und Freigabe ist idempotent', () => {
  const activity = new ApplicationActivity();
  const finance = activity.beginFinance(); expect(() => activity.beginProfile()).toThrow('Speicherung'); finance();
  const profile = activity.beginProfile(); expect(() => activity.beginFinance()).toThrow('Bereichswechsel');
  finance(); expect(activity.profileBusy).toBe(true); profile(); expect(activity.profileBusy).toBe(false);
});
