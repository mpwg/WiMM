// SPDX-License-Identifier: AGPL-3.0-or-later
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { readFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { once } from 'node:events';
import { createTauriStorageBridge, DesktopStorageAdapter, type DesktopStorageCommand } from '../../packages/storage/src/index.js';
import type { UUID } from '../../packages/contracts/src/index.js';
import { profileId, type SnapshotFixture } from './contracts/snapshot-catalog.js';

export async function sqliteFixture(): Promise<SnapshotFixture> {
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
    process = spawn(executable, ['--exact', 'storage::tests::contract_driver', '--ignored', '--nocapture'], { env: { ...globalThis.process.env, WIMM_CONTRACT_DATABASE: resolve(directory, 'native.sqlite3') } });
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
  const invoke = <T>(command: DesktopStorageCommand, arguments_: Record<string, unknown>): Promise<T> => new Promise((resolveResult, reject) => {
    const requestId = ++counter;
    pending.set(requestId, { resolve: (value) => resolveResult(value as T), reject });
    process.stdin.write(`${JSON.stringify({ id: requestId, command, arguments: arguments_ })}\n`);
  });
  const adapter = (profile: UUID = profileId) => new DesktopStorageAdapter(profile, createTauriStorageBridge(invoke));
  start();
  return { storage: adapter(), forProfile: adapter, async restart() { await stop(); start(); return adapter(); }, close: stop };
}
