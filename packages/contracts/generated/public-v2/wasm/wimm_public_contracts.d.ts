/* tslint:disable */
/* eslint-disable */
export interface ContractIssue {
    path: NonEmptyString;
    code: NonEmptyString;
}

export interface EncryptedChangeRecord {
    cursor: string;
    operation: EncryptedOperation;
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

export interface EncryptedSnapshotRecord {
    spaceId: PublicId;
    epoch: PublicId;
    cursor: string;
    ciphertextHash: Base64Url;
    bytes: number[];
}

export interface ExistingHandle {
    handle: PublicId;
    expectedRevision: PositiveRevision;
    previousCiphertextHash: Base64Url;
}

export interface ExpectedHead {
    handle: PublicId;
    expectedRevision: PublicRevision;
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

export interface OpaqueAggregateHead {
    handle: PublicId;
    revision: PublicRevision;
    ciphertextHash: Base64Url;
}

export interface OperationReceiptRecord {
    key: ServerOperationKey;
    contentHash: Base64Url;
    cursor: string;
}

export interface PublicError {
    code: PublicErrorCode;
    message: NonEmptyString;
    fields?: ContractIssue[];
    requestId?: NonEmptyString;
}

export interface PublicIdentityRecord {
    identityId: PublicId;
    revision: PublicRevision;
    issuer: string;
    subject: string;
}

export interface PublicValidationOutcome {
    contractVersion: number;
    status: PublicValidationStatus;
}

export interface ServerOperationKey {
    spaceId: PublicId;
    epoch: PublicId;
    operationId: PublicId;
}

export interface ServerPersistenceFailure {
    contractVersion: number;
    code: ServerPersistenceCode;
}

export interface SignedKeyRoster {
    roster: KeyRoster;
    signature: Base64Url;
}

export interface WriteHandle {
    handle: PublicId;
    expectedRevision: PublicRevision;
    proposedRevision: PositiveRevision;
    previousCiphertextHash?: Base64Url;
}

export type Base64Url = string;

export type CryptoSuite = "XCHACHA20_POLY1305_IETF_ED25519_V1";

export type NonEmptyString = string;

export type PositiveRevision = number;

export type ProtocolVersion = number;

export type PublicContractError = { contractVersion: number; code: PublicErrorCode; detail: string };

export type PublicErrorCode = "INVALID_ENVELOPE" | "INVALID_SIGNATURE" | "UNSUPPORTED_CRYPTO_SUITE" | "REVISION_CONFLICT" | "EPOCH_MISMATCH" | "KEY_VERSION_MISMATCH" | "ROSTER_MISMATCH" | "OPERATION_ID_REUSED" | "DEPENDENCY_NOT_ACCEPTED" | "UPDATE_REQUIRED";

export type PublicId = string;

export type PublicRevision = number;

export type PublicValidationStatus = "formValid";

export type Role = "admin" | "member" | "viewer";

export type ServerPersistenceCode = "REVISION_CONFLICT" | "QUOTA" | "WRITE_FAILED" | "UPDATE_REQUIRED" | "EPOCH_MISMATCH" | "OPERATION_ID_REUSED" | "CANCELLED" | "RESOURCE_UNAVAILABLE";


export function validate_public_operation_form_v2(input: EncryptedOperation): PublicValidationOutcome;

export function validate_public_roster_form_v2(input: SignedKeyRoster): PublicValidationOutcome;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
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
