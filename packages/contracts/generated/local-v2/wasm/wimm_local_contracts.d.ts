/* tslint:disable */
/* eslint-disable */
export interface ApplicationScope {
    profileId: PublicId;
    spaceId: PublicId;
    profileRevision: Revision;
    sessionGeneration: Revision;
}

export interface ContractIssue {
    path: NonEmptyString;
    code: NonEmptyString;
}

export interface EncryptedBackupReceipt {
    backupId: PublicId;
    profileId: PublicId;
    spaceId: PublicId;
    epoch: PublicId;
    snapshotHash: Base64Url;
}

export interface EncryptedOperation {
    header: EncryptedOperationHeader;
    nonce: Base64Url;
    ciphertext: Base64Url;
    signature: Base64Url;
}

export interface EncryptedOperationHeader {
    protocolVersion: ProtocolVersion;
    cryptoSuite: CryptoSuite;
    operationId: PublicId;
    deviceId: PublicId;
    spaceId: PublicId;
    epoch: PublicId;
    keyVersion: PositiveRevision;
    rosterHash: Base64Url;
    dependsOn: PublicId[];
    reads: ExistingHandle[];
    writes: WriteHandle[];
}

export interface ExistingHandle {
    handle: PublicId;
    expectedRevision: PositiveRevision;
    previousCiphertextHash: Base64Url;
}

export interface KeyRoster {
    protocolVersion: ProtocolVersion;
    cryptoSuite: CryptoSuite;
    spaceId: PublicId;
    rosterVersion: PositiveRevision;
    previousManifestHash?: Base64Url;
    epoch: PublicId;
    keyVersion: PositiveRevision;
    members: KeyRosterMember[];
}

export interface KeyRosterMember {
    userId: PublicId;
    identityPublicKey: Base64Url;
    role: Role;
}

export interface LocalFormOutcome {
    contractVersion: number;
    status: LocalFormStatus;
}

export interface PublicError {
    code: PublicErrorCode;
    message: NonEmptyString;
    fields?: ContractIssue[];
    requestId?: NonEmptyString;
}

export interface PublicValidationOutcome {
    contractVersion: number;
    status: PublicValidationStatus;
}

export interface SignedKeyRoster {
    roster: KeyRoster;
    signature: Base64Url;
}

export interface StorageMigrationPlan {
    expectedMigrationNumber: Ordinal;
    from: StorageVersions;
    steps: StorageMigrationStep[];
}

export interface StorageMigrationStep {
    number: PositiveOrdinal;
    from: StorageVersions;
    to: StorageVersions;
    destructive: boolean;
}

export interface StorageVersions {
    storageSchemaVersion: PositiveOrdinal;
    domainSchemaVersion: PositiveOrdinal;
}

export interface WriteHandle {
    handle: PublicId;
    expectedRevision: PublicRevision;
    proposedRevision: PositiveRevision;
    previousCiphertextHash?: Base64Url;
}

export type Base64Url = string;

export type CryptoSuite = "XCHACHA20_POLY1305_IETF_ED25519_V1";

export type LocalContractError = { contractVersion: number; code: string; detail: string };

export type LocalFormStatus = "formValid";

export type LocalHash = Base64Url;

export type LocalId = PublicId;

export type LocalPositive = number;

export type LocalRevision = number;

export type NonEmptyString = string;

export type PositiveRevision = number;

export type ProtocolVersion = number;

export type PublicContractError = { contractVersion: number; code: PublicErrorCode; detail: string };

export type PublicErrorCode = "INVALID_ENVELOPE" | "INVALID_SIGNATURE" | "UNSUPPORTED_CRYPTO_SUITE" | "REVISION_CONFLICT" | "EPOCH_MISMATCH" | "KEY_VERSION_MISMATCH" | "ROSTER_MISMATCH" | "OPERATION_ID_REUSED" | "DEPENDENCY_NOT_ACCEPTED" | "UPDATE_REQUIRED";

export type PublicId = string;

export type PublicRevision = number;

export type PublicValidationStatus = "formValid";

export type Role = "admin" | "member" | "viewer";


export function validate_local_migration_form_v2(input: StorageMigrationPlan): LocalFormOutcome;

export function validate_public_operation_form_v2(input: EncryptedOperation): PublicValidationOutcome;

export function validate_public_roster_form_v2(input: SignedKeyRoster): PublicValidationOutcome;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly validate_local_migration_form_v2: (a: any) => [number, number, number];
    readonly validate_public_operation_form_v2: (a: any) => [number, number, number];
    readonly validate_public_roster_form_v2: (a: any) => [number, number, number];
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
    readonly __wbindgen_exn_store: (a: number) => void;
    readonly __externref_table_alloc: () => number;
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __externref_table_dealloc: (a: number) => void;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
