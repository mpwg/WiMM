// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest';

import { createMemoryProfileStore, selectLocalArea, type LocalProfile } from './app.js';

const profile = {
  profileId: '00000000-0000-4000-8000-000000000001',
  selectedAreaId: '00000000-0000-4000-8000-000000000011',
  areas: [
    { id: '00000000-0000-4000-8000-000000000011', kind: 'private', label: 'Privater Bereich' },
    { id: '00000000-0000-4000-8000-000000000012', kind: 'household', label: 'Haushalt 1' }
  ],
  vault: { version: 1, vault: {}, passphraseWrap: {}, recoveryWrap: {} }
} as unknown as LocalProfile;

describe('lokale Profilkomposition', () => {
  it('hält Bereichswechsel innerhalb desselben Profils', () => {
    const next = selectLocalArea(profile, '00000000-0000-4000-8000-000000000012');
    expect(next.selectedAreaId).toBe('00000000-0000-4000-8000-000000000012');
    expect(next.areas).toEqual(profile.areas);
  });

  it('lehnt fremde Bereiche ab und gibt keine veränderbare Profilreferenz heraus', () => {
    expect(() => selectLocalArea(profile, '00000000-0000-4000-8000-000000000099')).toThrow('gehört nicht');
    const store = createMemoryProfileStore(profile);
    const loaded = store.load()!;
    ((loaded.areas as unknown) as { label: string }[])[0]!.label = 'Verändert';
    expect(store.load()!.areas[0]!.label).toBe('Privater Bereich');
  });
});
