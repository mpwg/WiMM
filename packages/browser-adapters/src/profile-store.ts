// SPDX-License-Identifier: AGPL-3.0-or-later
import { assertTransition, parseLocalProfile, ProfileConflictError, ProfileCoordinationError, ProfileLoadError, type ProfileStore, type ProfileLoadResult } from '@wimm/application';
export { ProfileConflictError, ProfileCoordinationError, ProfileLoadError, createMemoryProfileStore } from '@wimm/application';
export type { ProfileStore, ProfileLoadResult } from '@wimm/application';
export function createBrowserProfileStore(key = 'wimm/local-profile/v1'): ProfileStore {
  return {
    async load() { return readBrowserProfile(key).result; },
    async change(update) {
      // Kein unsicherer Read-modify-write-Fallback ohne tabübergreifende Koordination.
      if (navigator.locks === undefined) throw new ProfileCoordinationError();
      return navigator.locks.request(`wimm:profile:${key}`, async () => {
        const { raw, result } = readBrowserProfile(key);
        if (result.kind === 'corrupt' || result.kind === 'unreadable') throw new ProfileLoadError(result.kind);
        const current = result.kind === 'loaded' ? result.profile : undefined;
        const next = await update(current);
        assertTransition(current, next);
        if (window.localStorage.getItem(key) !== raw) throw new ProfileConflictError();
        if (parseLocalProfile(JSON.stringify(next)) === undefined) throw new ProfileLoadError('corrupt');
        const saved = { ...next, revision: (current?.revision ?? 0) + 1 };
        window.localStorage.setItem(key, JSON.stringify(saved));
        return saved;
      });
    }
  };
}

function readBrowserProfile(key: string): { raw: string | null; result: ProfileLoadResult } {
  let raw: string | null;
  try { raw = window.localStorage.getItem(key); }
  catch { return { raw: null, result: { kind: 'unreadable' } }; }
  if (raw === null) return { raw, result: { kind: 'missing' } };
  const profile = parseLocalProfile(raw);
  return { raw, result: profile === undefined ? { kind: 'corrupt' } : { kind: 'loaded', profile } };
}

