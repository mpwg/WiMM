// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Base64Url, Revision, UUID } from './primitives.js';

export interface RevisionExpectation {
  readonly handle: UUID;
  readonly expectedRevision: Revision;
}

export interface AggregateRecord<TPayload = unknown> {
  readonly handle: UUID;
  readonly revision: Revision;
  readonly payload: TPayload;
}

export interface AtomicBatch<TAggregate = unknown, TOutbox = unknown, TProjection = unknown> {
  readonly expectedRevisions: readonly RevisionExpectation[];
  readonly aggregates: readonly TAggregate[];
  readonly outbox: readonly TOutbox[];
  readonly projections: readonly TProjection[];
}

export interface StorageAdapter<
  TAggregate = unknown,
  TQuery = unknown,
  TConfirmed = unknown,
  TPending = unknown,
  TSyncPage = unknown,
  TSnapshot = unknown,
  TProjection = unknown
> {
  readAggregate(handle: UUID): Promise<TAggregate | undefined>;
  query(query: TQuery): Promise<readonly TAggregate[]>;
  applyAtomicBatch(batch: AtomicBatch<TAggregate, TPending, TProjection>): Promise<void>;
  loadConfirmed(spaceId: UUID): Promise<readonly TConfirmed[]>;
  loadPending(spaceId: UUID): Promise<readonly TPending[]>;
  saveSyncPage(page: TSyncPage): Promise<void>;
  exportSnapshot(spaceId: UUID): Promise<TSnapshot>;
  replaceSnapshot(snapshot: TSnapshot): Promise<void>;
  rebuildProjections(spaceId: UUID): Promise<void>;
}

export interface ImportFileRequest {
  readonly acceptedMediaTypes: readonly string[];
  readonly acceptedExtensions: readonly string[];
  readonly multiple: boolean;
}

export interface ImportedFile {
  readonly name: string;
  readonly mediaType: string | undefined;
  readonly bytes: Uint8Array;
}

export interface ExportFileRequest {
  readonly suggestedName: string;
  readonly mediaType: string;
  readonly bytes: Uint8Array;
}

export interface PlatformCommand {
  readonly id: string;
  readonly title: string;
  readonly enabled: boolean;
}

export interface SecureTokenStore {
  read(key: string): Promise<Uint8Array | undefined>;
  write(key: string, value: Uint8Array): Promise<void>;
  remove(key: string): Promise<void>;
}

export interface PlatformServices {
  chooseImportFiles(request: ImportFileRequest): Promise<readonly ImportedFile[]>;
  writeExport(request: ExportFileRequest): Promise<void>;
  openExternalUrl(url: string): Promise<void>;
  setMenuCommands(commands: readonly PlatformCommand[]): Promise<void>;
  getDataDirectory(): Promise<string | undefined>;
  secureTokens: SecureTokenStore;
}

export interface OpaqueAggregateHead {
  readonly handle: UUID;
  readonly revision: Revision;
  readonly ciphertextHash: Base64Url;
}
