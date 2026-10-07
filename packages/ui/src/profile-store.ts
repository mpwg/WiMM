// SPDX-License-Identifier: AGPL-3.0-or-later
import type { LocalProfile } from './app.js';
import { uuidSchema } from '@wimm/contracts';

export type ProfileLoadResult =
  | { readonly kind: 'missing' }
  | { readonly kind: 'loaded'; readonly profile: LocalProfile }
  | { readonly kind: 'corrupt' }
  | { readonly kind: 'unreadable' };

export class ProfileLoadError extends Error {
  constructor(readonly kind: 'corrupt' | 'unreadable') {
    super(kind === 'corrupt'
      ? 'Das vorhandene lokale Profil ist beschädigt oder hat ein nicht unterstütztes Format. Der Originaldatensatz bleibt erhalten. Bitte sichern Sie die vorhandenen Appdaten, bevor Sie eine Wiederherstellung vornehmen.'
      : 'Das vorhandene lokale Profil kann nicht gelesen werden. Es wird kein neuer Tresor angelegt. Bitte prüfen Sie den Speicherzugriff und starten Sie die App erneut.');
  }
}

/** Alle Änderungen lesen unter derselben Profilkoordination den aktuellen Stand. */
export interface ProfileStore {
  load(): Promise<ProfileLoadResult>;
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

/** Testport ohne Browserpersistenz; niemals als Produktstandard verwenden. */
export function createMemoryProfileStore(initial?: LocalProfile): ProfileStore {
  let profile = initial === undefined ? undefined : structuredClone(initial);
  let queue = Promise.resolve();
  return {
    async load(): Promise<ProfileLoadResult> { return profile === undefined ? { kind: 'missing' } : { kind: 'loaded', profile: structuredClone(profile) }; },
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

function readBrowserProfile(key: string): { raw: string | null; result: ProfileLoadResult } {
  let raw: string | null;
  try { raw = window.localStorage.getItem(key); }
  catch { return { raw: null, result: { kind: 'unreadable' } }; }
  if (raw === null) return { raw, result: { kind: 'missing' } };
  const profile = parseLocalProfile(raw);
  return { raw, result: profile === undefined ? { kind: 'corrupt' } : { kind: 'loaded', profile } };
}

function object(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

/** Prüft alle öffentlichen Profil-/Hüllenfelder; AEAD-Prüfung bleibt Teil des Entsperrens. */
function parseLocalProfile(value: string): LocalProfile | undefined {
  try {
    const profile = object(JSON.parse(value));
    if (profile === undefined || !uuidSchema.safeParse(profile.profileId).success || !Array.isArray(profile.areas) || profile.areas.length === 0) return undefined;
    const areas = profile.areas as unknown[];
    const ids = new Set<string>();
    let privateCount = 0;
    for (const entry of areas) {
      const area = object(entry);
      if (area === undefined || typeof area.id !== 'string' || !uuidSchema.safeParse(area.id).success || ids.has(area.id)
        || (area.kind !== 'private' && area.kind !== 'household') || typeof area.label !== 'string' || area.label.trim().length === 0) return undefined;
      ids.add(area.id);
      if (area.kind === 'private') privateCount += 1;
    }
    if (privateCount !== 1 || typeof profile.selectedAreaId !== 'string' || !ids.has(profile.selectedAreaId)) return undefined;
    // Nur tatsächlich fehlende Revision gilt als Altprofil; null ist kein Legacywert.
    const revision = profile.revision === undefined ? 0 : profile.revision;
    if (typeof revision !== 'number' || !Number.isSafeInteger(revision) || revision < 0) return undefined;
    const record = object(profile.vault);
    const envelope = object(record?.vault);
    const passphrase = object(record?.passphraseWrap);
    const recovery = object(record?.recoveryWrap);
    if (record?.version !== 1 || envelope?.version !== 1 || passphrase?.algorithm !== 'argon2id'
      || !bytes(envelope?.nonce, 24) || !bytes(envelope?.ciphertext, undefined, 16)
      || !bytes(passphrase?.salt, 16) || !bytes(passphrase?.nonce, 24) || !bytes(passphrase?.ciphertext, 48)
      || !bytes(recovery?.nonce, 24) || !bytes(recovery?.ciphertext, 48)) return undefined;
    return { ...profile, revision } as unknown as LocalProfile;
  } catch { return undefined; }
}

function bytes(value: unknown, length?: number, minimum = 0): boolean {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]+$/.test(value) || value.length % 4 === 1) return false;
  try {
    const decoded = atob(value.replace(/-/g, '+').replace(/_/g, '/'));
    return length === undefined ? decoded.length >= minimum : decoded.length === length;
  } catch { return false; }
}
