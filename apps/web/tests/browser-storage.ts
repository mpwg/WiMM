// SPDX-License-Identifier: AGPL-3.0-or-later
// Isolierter Consumer des produktiven Workers; kein eigenes Testbackend.
import type {SqliteWorkerClient,SqliteWorkerStatus} from '../../../packages/browser-adapters/src/sqlite-worker-client.js';
import {createEncryptedJsonSnapshotProtector} from '@wimm/crypto';
import {BrowserSqliteStorageAdapter} from '../../../packages/browser-adapters/src/sqlite-storage.js';
import {runBrowserSnapshotCase,runDirectNegativeSnapshots,runCurrentRebuildOracle} from './browser-snapshot-catalog.js';
import type {UUID} from '../../../packages/contracts/src/index.js';
const profile=new URL(location.href).searchParams.get('profile');if(profile===null)throw new Error('Testprofil fehlt.');
declare global {interface Window {sqliteStatus:SqliteWorkerStatus;sqliteClient:SqliteWorkerClient;sqliteAdapter:BrowserSqliteStorageAdapter;sqliteCreateAdapter:()=>BrowserSqliteStorageAdapter;sqliteSnapshotCase:(scenario:Parameters<typeof runBrowserSnapshotCase>[0])=>Promise<void>;sqliteNegativeSnapshots:()=>Promise<number>;sqliteRebuildOracle:()=>Promise<void>;backupProtector:ReturnType<typeof createEncryptedJsonSnapshotProtector>}}
window.sqliteCreateAdapter=()=>new BrowserSqliteStorageAdapter(profile as UUID,status=>{window.sqliteStatus=status;document.getElementById('status')!.textContent=status;});
window.sqliteAdapter=window.sqliteCreateAdapter();window.sqliteClient=window.sqliteAdapter.client;

// Ausschließlich synthetischer Prüfschlüssel, bleibt außerhalb des DAL-Workers.
window.backupProtector=createEncryptedJsonSnapshotProtector(new Uint8Array(32).fill(7));

window.sqliteSnapshotCase=scenario=>runBrowserSnapshotCase(scenario,window.sqliteAdapter);
window.sqliteNegativeSnapshots=()=>runDirectNegativeSnapshots(window.sqliteAdapter);
window.sqliteRebuildOracle=()=>runCurrentRebuildOracle(window.sqliteAdapter);
