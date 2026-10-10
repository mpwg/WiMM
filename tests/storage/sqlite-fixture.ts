// SPDX-License-Identifier: AGPL-3.0-or-later
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { readFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { once } from 'node:events';
import { createTauriStorageBridge, DesktopStorageAdapter, DesktopEncryptedBackupPort, DesktopMigrationPort, DesktopIndexQueryPort, type DesktopStorageCommand, type DesktopBackupCommand, type DesktopIndexCommand } from '../../packages/storage/src/index.js';
import { canonicalJsonBytes } from '../../packages/crypto/src/index.js';
import type { UUID } from '../../packages/contracts/src/index.js';
import type { VersionFixture } from './contracts/version-catalog.js';
import { profileId } from './contracts/snapshot-catalog.js';

export async function sqliteFixture(driver: 'bestand' | 'orm' = 'bestand'): Promise<VersionFixture & { backups: DesktopEncryptedBackupPort; migration:DesktopMigrationPort; indices:DesktopIndexQueryPort }> {
  const records = (await readFile('test-results/storage-contract-build.jsonl', 'utf8')).trim().split('\n').map((line) => JSON.parse(line) as { reason: string; executable?: string; profile?: { test: boolean } });
  const executable = records.find((entry) => entry.reason === 'compiler-artifact' && entry.profile?.test && entry.executable)?.executable;
  if (!executable) throw new Error('Zuerst pnpm test:storage:native ausführen; Rust-Testbinary fehlt.');
  const directory = resolve('test-results/storage-contract', crypto.randomUUID());
  await mkdir(directory, { recursive: true });
  let process: ChildProcessWithoutNullStreams;
  let counter = 0;
  let stderr = '';
  const pending = new Map<number, { resolve(value: unknown): void; reject(error: unknown): void }>();
  const start = () => {
    process = spawn(executable, ['--exact', driver === 'orm' ? 'orm_storage::tests::contract_driver' : 'storage::tests::contract_driver', '--ignored', '--nocapture'], { env: { ...globalThis.process.env, WIMM_CONTRACT_DATABASE: resolve(directory, 'native.sqlite3') } });
    process.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });
    createInterface({ input: process.stdout }).on('line', (line) => {
      if (!line.startsWith('WIMM_CONTRACT:')) return;
      const response = JSON.parse(line.slice('WIMM_CONTRACT:'.length)) as { id: number; error?: string; value?: unknown };
      const waiter = pending.get(response.id); pending.delete(response.id);
      if (response.error !== undefined) waiter?.reject(response.error); else waiter?.resolve(response.value);
    });
    process.on('error', (error) => { for (const waiter of pending.values()) waiter.reject(error); pending.clear(); });
    process.on('exit', (code) => { for (const waiter of pending.values()) waiter.reject(new Error(`Rust-Port beendet (${code}): ${stderr}`)); pending.clear(); });
  };
  const stop = async () => { const exited = once(process, 'exit'); process.stdin.end(); await exited; };
  let beforeRebuild: ((storage: DesktopStorageAdapter) => Promise<void>) | undefined;
  const invoke = <T>(command: DesktopStorageCommand | DesktopBackupCommand | DesktopIndexCommand | 'storage_migrate' | 'storage_cancel_migration' | 'test_projection_fault' | 'test_schema_version', arguments_: Record<string, unknown>): Promise<T> => new Promise((resolveResult, reject) => {
    const requestId = ++counter;
    pending.set(requestId, { resolve: (value) => resolveResult(value as T), reject });
    const send = () => process.stdin.write(`${JSON.stringify({ id: requestId, command, arguments: arguments_ })}\n`);
    if (command === 'storage_rebuild_projections' && beforeRebuild !== undefined) {
      const action = beforeRebuild; beforeRebuild = undefined;
      void action(adapter()).then(send, (error: unknown) => { pending.delete(requestId); reject(error); });
    } else send();
  });
  const adapter = (profile: UUID = profileId) => new DesktopStorageAdapter(profile, createTauriStorageBridge(invoke));
  start();
  return { storage: adapter(), migration:new DesktopMigrationPort(invoke,snapshot=>canonicalJsonBytes(snapshot),{next:()=>'00000000-0000-4000-8000-000000009998'}), indices:new DesktopIndexQueryPort(profileId,invoke), backups: new DesktopEncryptedBackupPort({ next: () => '00000000-0000-4000-8000-000000009999' }, invoke), forProfile: adapter, async restart() { await stop(); start(); return adapter(); }, close: stop, beforeNextRebuild(action) { beforeRebuild = action; }, async withProjectionWriteFailure(action) {
    await invoke('test_projection_fault', { enabled: true });
    try { await action(); } finally { await invoke('test_projection_fault', { enabled: false }); }
  }, async withSchemaVersion(kind, version, action) {
    await invoke('test_schema_version', { kind, version: String(version) });
    try { await action(); } finally { await invoke('test_schema_version', { kind, version: '1' }); }
  } };
}
