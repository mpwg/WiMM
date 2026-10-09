// SPDX-License-Identifier: AGPL-3.0-or-later
import { decodeStorageFailure, StorageFailureError } from './storage-failure.js';
import type { CancellationPort, LocalMigrationPort, IdSourcePort } from '@wimm/contracts';
import type { LocalSnapshot } from './contracts.js';
import { checkLocalMigration, type LocalMigrationInput } from './local-migrations.js';

/** Der Codec kommt aus dem vorhandenen Snapshot-/Cryptoadapter; Rust hasht exakt diese geprüften JSON-Bytes. */
export class DesktopMigrationPort implements LocalMigrationPort<LocalSnapshot> {
  constructor(private readonly invoke: <T>(command: 'storage_migrate'|'storage_cancel_migration', arguments_: Record<string, unknown>)=>Promise<T>, private readonly snapshotBytes: (snapshot: LocalSnapshot)=>Uint8Array, private readonly ids:IdSourcePort) {}
  async migrate(input: LocalMigrationInput, cancellation: CancellationPort): Promise<void> {
    const backup = checkLocalMigration(input,cancellation);
    const migrationId=this.ids.next();
    const unsubscribe=cancellation.onCancel(()=>{void this.invoke<void>('storage_cancel_migration',{migrationId}).catch(()=>{ /* Der eigentliche Migrationsaufruf entscheidet über den Commit. */ });});
    try{const result=await this.invoke<void>('storage_migrate',{migrationId,input:{plan:input.plan,expectedSnapshot:input.expectedSnapshot,snapshotBytes:[...this.snapshotBytes(input.expectedSnapshot)],backup}});if(result!=null)throw new StorageFailureError('INVALID_RESPONSE','unknown');}catch(error){throw error instanceof StorageFailureError ? error : decodeStorageFailure(error);}finally{unsubscribe();}
    // Ein bestätigter Commit bleibt auch bei anschließendem Abbruch erfolgreich.
  }
}
