// SPDX-License-Identifier: AGPL-3.0-or-later
import type { LocalProfile } from './app.js';

/** Alle Änderungen lesen unter derselben Profilkoordination den aktuellen Stand. */
export interface ProfileStore {
  load(): Promise<LocalProfile | undefined>;
  change(update: (current: LocalProfile | undefined) => Promise<LocalProfile>): Promise<LocalProfile>;
}

/** Verständlicher Hinweis für einen Laufzeitkontext ohne sichere Profilkoordination. */
export class ProfileCoordinationError extends Error {
  constructor() {
    super('Dieser Browser oder diese WebView unterstützt keine sichere lokale Speicherkoordination. Öffnen Sie WiMM in einem aktuellen unterstützten Browser oder aktualisieren Sie die Desktop-App. Es wurde keine Profiländerung gespeichert.');
    this.name = 'ProfileCoordinationError';
  }
}

export class ProfileConflictError extends Error {
  constructor() { super('Das lokale Profil wurde inzwischen geändert. Bitte erneut entsperren und die Änderung wiederholen.'); }
}

export function createBrowserProfileStore(key = 'wimm/local-profile/v1'): ProfileStore {
  return {
    async load() {
      try {
        const raw = window.localStorage.getItem(key);
        return raw === null ? undefined : parseLocalProfile(raw);
      } catch { return undefined; }
    },
    async change(update) {
      // Kein unsicherer Read-modify-write-Fallback ohne tabübergreifende Koordination.
      if (navigator.locks === undefined) throw new ProfileCoordinationError();
      return navigator.locks.request(`wimm:profile:${key}`, async () => {
        const raw = window.localStorage.getItem(key);
        const current = raw === null ? undefined : parseLocalProfile(raw);
        if (raw !== null && current === undefined) throw new ProfileConflictError();
        const next = await update(current);
        assertTransition(current, next);
        if (window.localStorage.getItem(key) !== raw) throw new ProfileConflictError();
        const saved = { ...next, revision: (current?.revision ?? 0) + 1 };
        window.localStorage.setItem(key, JSON.stringify(saved));
        return saved;
      });
    }
  };
}

/** Testport ohne Browserpersistenz; niemals als Produktstandard verwenden. */
export function createMemoryProfileStore(initial?: LocalProfile): ProfileStore {
  let profile = initial === undefined ? undefined : structuredClone(initial);
  let queue = Promise.resolve();
  return {
    async load() { return profile === undefined ? undefined : structuredClone(profile); },
    change(update) {
      const operation = queue.then(async () => {
        const current = profile === undefined ? undefined : structuredClone(profile);
        const next = await update(current);
        assertTransition(current, next);
        profile = structuredClone({ ...next, revision: (current?.revision ?? 0) + 1 });
        return structuredClone(profile);
      });
      queue = operation.then(() => undefined, () => undefined);
      return operation;
    }
  };
}

function assertTransition(current: LocalProfile | undefined, next: LocalProfile) {
  if (current !== undefined && (next.profileId !== current.profileId || next.revision !== current.revision)) throw new ProfileConflictError();
  if (!Number.isSafeInteger((current?.revision ?? 0) + 1)) throw new ProfileConflictError();
}

function parseLocalProfile(value: string): LocalProfile | undefined {
  try {
    const profile = JSON.parse(value) as LocalProfile;
    if (!profile.profileId || !profile.vault || !Array.isArray(profile.areas) || profile.areas.length === 0) return undefined;
    const revision = profile.revision ?? 0;
    if (!Number.isSafeInteger(revision) || revision < 0) return undefined;
    return { ...profile, revision };
  } catch { return undefined; }
}
