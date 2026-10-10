// SPDX-License-Identifier: AGPL-3.0-or-later
// Isolierter Consumer des produktiven Workers; kein eigenes Testbackend.
import {SqliteWorkerClient,type SqliteWorkerStatus} from '../../../packages/browser-adapters/src/sqlite-worker-client.js';
import type {UUID} from '../../../packages/contracts/src/index.js';
const profile=new URL(location.href).searchParams.get('profile');if(profile===null)throw new Error('Testprofil fehlt.');
declare global {interface Window {sqliteStatus:SqliteWorkerStatus;sqliteClient:SqliteWorkerClient}}
window.sqliteClient=new SqliteWorkerClient(profile as UUID,status=>{window.sqliteStatus=status;document.getElementById('status')!.textContent=status;});
