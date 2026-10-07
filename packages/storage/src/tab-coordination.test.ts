// SPDX-License-Identifier: AGPL-3.0-or-later
import { afterEach, expect, it, vi } from 'vitest';
import { BrowserAreaCoordinator } from './tab-coordination.js';
const profile = '00000000-0000-4000-8000-000000000001';
const space = '00000000-0000-4000-8000-000000000002';
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
it('serialisiert den Fallback, gibt Fehler frei und entfernt den letzten Lock', async () => {
  vi.stubGlobal('navigator', undefined); vi.stubGlobal('BroadcastChannel', undefined);
  const deleted = vi.spyOn(Map.prototype, 'delete');
  const coordinator = new BrowserAreaCoordinator(profile);
  const calls: number[] = []; let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const first = coordinator.runExclusive(space, async () => { calls.push(1); await gate; throw new Error('Quota'); });
  const second = coordinator.runExclusive(space, async () => { calls.push(2); });
  await Promise.resolve(); expect(calls).toEqual([1]); release();
  expect((await Promise.allSettled([first, second])).map(r => r.status)).toEqual(['rejected', 'fulfilled']);
  expect(calls).toEqual([1, 2]); expect(deleted).toHaveBeenCalledWith(`wimm:${profile}:${space}`);
  await coordinator.runExclusive(space, async () => { calls.push(3); }); expect(calls).toEqual([1, 2, 3]); coordinator.close();
});
