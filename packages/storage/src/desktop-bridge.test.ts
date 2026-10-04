// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest';

import { createTauriStorageBridge } from './desktop-bridge.js';

const profileId = '00000000-0000-4000-8000-000000000001' as never;
const spaceId = '00000000-0000-4000-8000-000000000011' as never;

describe('Tauri-Speicherbrücke', () => {
  it('fragt Bereiche nur über den begrenzten Desktopbefehl ab', async () => {
    const calls: unknown[] = [];
    const bridge = createTauriStorageBridge(async (command, arguments_) => {
      calls.push({ command, arguments_ });
      return [] as never;
    });

    await expect(bridge.queryAggregates(profileId, spaceId)).resolves.toEqual([]);
    expect(calls).toEqual([{
      command: 'storage_query_aggregates',
      arguments_: { profileId, spaceId }
    }]);
  });
});
