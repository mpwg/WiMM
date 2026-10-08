// SPDX-License-Identifier: AGPL-3.0-or-later
import {BrowserEncryptedBackupPort} from '@wimm/browser-adapters';
import {createEncryptedJsonSnapshotProtector,canonicalJsonBytes} from '@wimm/crypto';
import type {UUID,Base64Url} from '@wimm/contracts';
import {p5Snapshot} from '../../../tests/storage/contracts/snapshot-catalog.js';
const id='23000000-0000-4000-8000-000000000001' as UUID;
const name='wimm:synthetic-encrypted-backup-acceptance';
declare global{interface Window{backupProbe:(mode:'persist'|'duplicate'|'read')=>Promise<{restored:boolean;ciphertextOnly:boolean;receipt:boolean}>}}
window.backupProbe=async(mode)=>{const snapshot=p5Snapshot();const protector=createEncryptedJsonSnapshotProtector<typeof snapshot>(new Uint8Array(32).fill(7));const ciphertext=await protector.seal(snapshot);const hash=await crypto.subtle.digest('SHA-256',new Uint8Array(canonicalJsonBytes(snapshot)));const snapshotHash=btoa(String.fromCharCode(...new Uint8Array(hash))).replaceAll('+','-').replaceAll('/','_').replaceAll('=','') as Base64Url;
 if(mode!=='read'){await new BrowserEncryptedBackupPort({next:()=>id},name).persist({profileId:snapshot.profileId,spaceId:snapshot.spaceId,epoch:snapshot.epoch,snapshotHash,ciphertext});}
 const stored=await new Promise<{ciphertext:Uint8Array;snapshotHash:string;backupId:string}>((resolve,reject)=>{const open=indexedDB.open(name,1);open.onerror=()=>reject(new Error('Synthetische Sicherung fehlt'));open.onsuccess=()=>{const db=open.result;const tx=db.transaction('backups','readonly');const request=tx.objectStore('backups').get(id);request.onsuccess=()=>resolve(request.result as {ciphertext:Uint8Array;snapshotHash:string;backupId:string});request.onerror=()=>reject(new Error('Synthetische Sicherung fehlt'));tx.oncomplete=()=>db.close();};});
 const restored=await protector.unseal(stored.ciphertext);return {restored:new TextDecoder().decode(canonicalJsonBytes(restored))===new TextDecoder().decode(canonicalJsonBytes(snapshot)),ciphertextOnly:!new TextDecoder().decode(stored.ciphertext).includes('aggregateType'),receipt:stored.backupId===id&&stored.snapshotHash===snapshotHash};
};
