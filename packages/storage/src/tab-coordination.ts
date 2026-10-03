// SPDX-License-Identifier: AGPL-3.0-or-later
import type { UUID } from '@wimm/contracts';

const localLocks = new Map<string, Promise<void>>();

/** Koordiniert pro Bereich lokale Führung; bei fehlenden Web Locks bleibt die DB-Transaktion maßgeblich. */
export class BrowserAreaCoordinator {
  private readonly channel: BroadcastChannel | undefined;

  constructor(private readonly profileId: UUID, onLeadershipChange?: (spaceId: UUID) => void) {
    this.channel = typeof BroadcastChannel === 'undefined' ? undefined : new BroadcastChannel(`wimm-storage-${profileId}`);
    if (this.channel !== undefined && onLeadershipChange !== undefined) {
      this.channel.onmessage = (event: MessageEvent<unknown>) => {
        if (typeof event.data === 'string') onLeadershipChange(event.data as UUID);
      };
    }
  }

  async runExclusive<T>(spaceId: UUID, action: () => Promise<T>): Promise<T> {
    const name = `wimm:${this.profileId}:${spaceId}`;
    if (typeof navigator !== 'undefined' && navigator.locks !== undefined) {
      return navigator.locks.request(name, { mode: 'exclusive' }, async () => {
        this.channel?.postMessage(spaceId);
        return action();
      });
    }
    const previous = localLocks.get(name) ?? Promise.resolve();
    let release: (() => void) | undefined;
    const current = new Promise<void>((resolve) => { release = resolve; });
    localLocks.set(name, previous.then(() => current));
    await previous;
    try { this.channel?.postMessage(spaceId); return await action(); }
    finally { release?.(); if (localLocks.get(name) === current) localLocks.delete(name); }
  }

  close(): void { this.channel?.close(); }
}
