// SPDX-License-Identifier: AGPL-3.0-or-later
// Isolierter Consumer des produktiven Workers; kein eigenes Testbackend.
import {SqliteWorkerClient,type SqliteWorkerStatus} from '../../../packages/browser-adapters/src/sqlite-worker-client.js';
import {createEncryptedJsonSnapshotProtector} from '@wimm/crypto';
import type {UUID} from '../../../packages/contracts/src/index.js';
const profile=new URL(location.href).searchParams.get('profile');if(profile===null)throw new Error('Testprofil fehlt.');
declare global {interface Window {sqliteStatus:SqliteWorkerStatus;sqliteClient:SqliteWorkerClient;backupProtector:ReturnType<typeof createEncryptedJsonSnapshotProtector>}}
window.sqliteClient=new SqliteWorkerClient(profile as UUID,status=>{window.sqliteStatus=status;document.getElementById('status')!.textContent=status;});

// Ausschließlich synthetischer Prüfschlüssel, bleibt außerhalb des DAL-Workers.
window.backupProtector=createEncryptedJsonSnapshotProtector(new Uint8Array(32).fill(7));
