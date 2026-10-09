// SPDX-License-Identifier: AGPL-3.0-or-later
import { decodeStorageFailure } from './storage-failure.js';
import type { UUID } from '@wimm/contracts';
import { validatePendingIndexQuery,validateTransactionIndexQuery,validateImportSourceQuery,type ImportSourceQuery,type TransactionIndexQuery,type PendingIndexQuery,type LocalIndexQueryPort } from './index-queries.js';
import type { StoredAggregate,PendingOperation } from './contracts.js';
export type DesktopIndexCommand='storage_query_indexed_transactions'|'storage_query_indexed_pending'|'storage_query_imported_transactions';
export class DesktopIndexQueryPort implements LocalIndexQueryPort{
 constructor(readonly profileId:UUID,private readonly invokeRaw:<T>(command:DesktopIndexCommand,args:Record<string,unknown>)=>Promise<T>){}
 private async invoke<T>(command:DesktopIndexCommand,args:Record<string,unknown>):Promise<T>{try{return await this.invokeRaw<T>(command,args);}catch(error){throw decodeStorageFailure(error);}}
 queryIndexedTransactions(query:TransactionIndexQuery):Promise<readonly StoredAggregate[]>{validateTransactionIndexQuery(query);return this.invoke('storage_query_indexed_transactions',{profileId:this.profileId,query});}
 queryIndexedPending(query:PendingIndexQuery):Promise<readonly PendingOperation[]>{validatePendingIndexQuery(query);return this.invoke('storage_query_indexed_pending',{profileId:this.profileId,query});}
 queryImportedTransactions(query:ImportSourceQuery):Promise<readonly StoredAggregate[]>{validateImportSourceQuery(query);return this.invoke('storage_query_imported_transactions',{profileId:this.profileId,query});}
}
