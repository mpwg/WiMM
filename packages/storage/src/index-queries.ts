// SPDX-License-Identifier: AGPL-3.0-or-later
import { uuidSchema, isoDateSchema, type UUID } from '@wimm/contracts';
import { StorageWriteError, type StoredAggregate, type PendingOperation, type PendingState } from './contracts.js';
export interface TransactionIndexQuery { spaceId:UUID; kind:'account'|'category'|'import'; reference:string; fromDate?:string; throughDate?:string; after?:{date:string;handle:UUID}; limit:number }
export interface PendingIndexQuery { spaceId:UUID; state:PendingState; limit:number }
export interface ImportSourceQuery {spaceId:UUID;accountId:UUID;parserSource:string;externalId:string;limit:number}
export interface LocalIndexQueryPort { queryIndexedTransactions(query:TransactionIndexQuery):Promise<readonly StoredAggregate[]>; queryIndexedPending(query:PendingIndexQuery):Promise<readonly PendingOperation[]>;queryImportedTransactions(query:ImportSourceQuery):Promise<readonly StoredAggregate[]> }
export function validateImportSourceQuery(query:ImportSourceQuery):void{if(!uuidSchema.safeParse(query.spaceId).success||!uuidSchema.safeParse(query.accountId).success||typeof query.parserSource!=='string'||query.parserSource.length===0||typeof query.externalId!=='string'||query.externalId.length===0||!Number.isInteger(query.limit)||query.limit<1||query.limit>1000)throw new StorageWriteError('Die Indexabfrage ist nicht gültig.');}
export function validateTransactionIndexQuery(query:TransactionIndexQuery):void{
 if(!uuidSchema.safeParse(query.spaceId).success||!['account','category','import'].includes(query.kind)||typeof query.reference!=='string'||query.reference.length===0||query.kind!=='import'&&!uuidSchema.safeParse(query.reference).success||!Number.isInteger(query.limit)||query.limit<1||query.limit>1000||[query.fromDate,query.throughDate,query.after?.date].some(date=>date!==undefined&&!isoDateSchema.safeParse(date).success)||query.fromDate!==undefined&&query.throughDate!==undefined&&query.fromDate>query.throughDate||query.after!==undefined&&!uuidSchema.safeParse(query.after.handle).success)throw new StorageWriteError('Die Indexabfrage ist nicht gültig.');
}
export function validatePendingIndexQuery(query:PendingIndexQuery):void{
 if(!uuidSchema.safeParse(query.spaceId).success||!['queued','sending','accepted','conflict','blocked','forbidden','invalid'].includes(query.state)||!Number.isInteger(query.limit)||query.limit<1||query.limit>1000)throw new StorageWriteError('Die Indexabfrage ist nicht gültig.');
}
