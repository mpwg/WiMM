/* tslint:disable */
/* eslint-disable */
/**
 * Formgrenzen werden auch bei nativer Konstruktion erzwungen.
 */
export type BoundedVec<T> = T[];

/**
 * Native Records trennen Handle und Fachaggregat; Serde erhält das flache V1-Format.
 */
export interface StoredAggregate extends Aggregate {
    handle: EntityId;
}

export interface Account {
    id: EntityId;
    spaceId: EntityId;
    revision: StoredRevision;
    createdAt: UtcTimestamp;
    updatedAt: UtcTimestamp;
    deletedAt?: UtcTimestamp;
    name: NonEmptyText;
    type: AccountType;
    onBudget: boolean;
    archived: boolean;
}

export interface AccountBalance {
    accountId: EntityId;
    balance: MoneyCents;
}

export interface AggregateCommand {
    aggregateId: EntityId;
}

export interface AggregateQuery {
    spaceId: EntityId;
}

export interface ApplicationScope {
    profileId: PublicId;
    spaceId: PublicId;
    profileRevision: Revision;
    sessionGeneration: Revision;
}

export interface AtomicBatch {
    expectedRevisions: RevisionExpectation[];
    aggregates: StoredAggregate[];
    outbox: PendingOperation[];
    projections: StoredProjection[];
}

export interface BalancePayload {
    accountId?: EntityId;
    balance: MoneyCents;
}

export interface Category {
    id: EntityId;
    spaceId: EntityId;
    revision: StoredRevision;
    createdAt: UtcTimestamp;
    updatedAt: UtcTimestamp;
    deletedAt?: UtcTimestamp;
    name: NonEmptyText;
    groupId: EntityId;
    sortOrder: Ordinal;
    archived: boolean;
    system?: CategorySystem;
}

export interface CategoryConsumption {
    categoryId: EntityId;
    groupKind: GroupKind;
    amount: MoneyCents;
}

export interface CategoryGroup {
    id: EntityId;
    spaceId: EntityId;
    revision: StoredRevision;
    createdAt: UtcTimestamp;
    updatedAt: UtcTimestamp;
    deletedAt?: UtcTimestamp;
    name: NonEmptyText;
    kind: GroupKind;
    sortOrder: Ordinal;
    archived: boolean;
}

export interface ChangeSet {
    spaceId: EntityId;
    commandType: string;
    operationId: EntityId;
    occurredAt: UtcTimestamp;
    expectedRevisions: Expectation[];
    aggregates: Aggregate[];
}

export interface ClassificationRow {
    sourceRow: PositiveOrdinal;
    classification: Classification;
}

export interface ConfirmedAggregate {
    spaceId: EntityId;
    epoch: EntityId;
    aggregate: StoredAggregate;
}

export interface Consumption {
    income: MoneyCents;
    expense: MoneyCents;
    net: MoneyCents;
    categories: CategoryConsumption[];
}

export interface Context {
    operationId: EntityId;
    occurredAt: UtcTimestamp;
    generatedIds: EntityId[];
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

export interface Expectation {
    id: EntityId;
    expectedRevision: Revision;
}

export interface FinancialRevision {
    id: EntityId;
    spaceId: EntityId;
    revision: StoredRevision;
    createdAt: UtcTimestamp;
    updatedAt: UtcTimestamp;
    deletedAt?: UtcTimestamp;
}

export interface ImportBatch {
    id: EntityId;
    spaceId: EntityId;
    revision: StoredRevision;
    createdAt: UtcTimestamp;
    updatedAt: UtcTimestamp;
    deletedAt?: UtcTimestamp;
    fileHash: FileHash;
    accountId: EntityId;
    rows: BoundedVec<ImportRow>;
    committedRows: PositiveOrdinal[];
    state: ImportState;
}

export interface ImportCandidate {
    sourceRow: PositiveOrdinal;
    date: FinanceDate;
    amount: MoneyCents;
    parserSource?: ParserSource;
    payee?: string;
    memo?: string;
    externalId?: string;
    sourceFingerprint?: NonEmptyText;
    categoryId?: EntityId;
    payeeId?: EntityId;
    clearance?: ImportClearance;
}

export interface ImportCommit {
    importId: EntityId;
}

export interface ImportFingerprint {
    id: EntityId;
    spaceId: EntityId;
    revision: StoredRevision;
    createdAt: UtcTimestamp;
    updatedAt: UtcTimestamp;
    deletedAt?: UtcTimestamp;
    accountId: EntityId;
    parserSource: NonEmptyText;
    fingerprint: NonEmptyText;
    transactionId: EntityId;
    importId: EntityId;
    sourceRow: PositiveOrdinal;
    externalId?: string;
}

export interface ImportMapping {
    id: EntityId;
    spaceId: EntityId;
    revision: StoredRevision;
    createdAt: UtcTimestamp;
    updatedAt: UtcTimestamp;
    deletedAt?: UtcTimestamp;
    name: NonEmptyText;
    mapping: unknown;
}

export interface ImportRequest {
    contractVersion: EngineBindingVersion;
    domainSchemaVersion: DomainSchemaVersion;
    spaceId: EntityId;
    aggregates: Aggregate[];
    accountId: EntityId;
    candidates: ImportCandidate[];
}

export interface ImportRow {
    sourceRow: PositiveOrdinal;
    candidate: ImportCandidate | null;
    decision: ImportDecision;
    issues: string[];
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

export interface LocalPortRequestV2 {
    contractVersion: EngineBindingVersion;
    command: LocalPortCommand;
}

export interface LocalSnapshot {
    storageSchemaVersion: SnapshotStorageVersion;
    domainSchemaVersion: SnapshotDomainVersion;
    profileId: EntityId;
    spaceId: EntityId;
    epoch: EntityId;
    aggregates: StoredAggregate[];
    confirmed: ConfirmedAggregate[];
    pending: PendingOperation[];
    projections: StoredProjection[];
    syncState?: SyncState;
}

export interface MoneyParseRequest {
    contractVersion: EngineBindingVersion;
    domainSchemaVersion: DomainSchemaVersion;
    spaceId: EntityId;
    text: string;
}

export interface Payee {
    id: EntityId;
    spaceId: EntityId;
    revision: StoredRevision;
    createdAt: UtcTimestamp;
    updatedAt: UtcTimestamp;
    deletedAt?: UtcTimestamp;
    name: NonEmptyText;
    aliases: NonEmptyText[];
    archived: boolean;
}

export interface PayeeMerge {
    targetId: EntityId;
    sourceIds: NonEmptyVec<EntityId>;
    transactionIds: EntityId[];
}

export interface PendingOperation {
    operationId: EntityId;
    spaceId: EntityId;
    expectedRevisions: RevisionExpectation[];
    dependsOn: EntityId[];
    state: PendingState;
    draft: LegacyJson;
    retryCount: Ordinal;
    createdAt?: UtcTimestamp;
}

export interface ProjectionOutcome {
    contractVersion: number;
    status: ProjectionStatus;
    projections: ProjectionSet;
}

export interface ProjectionRebuild {
    spaceId: EntityId;
    sourceAggregates: StoredAggregate[];
    projections: StoredProjection[];
}

export interface ProjectionRequest {
    contractVersion: EngineBindingVersion;
    domainSchemaVersion: DomainSchemaVersion;
    spaceId: EntityId;
    aggregates: Aggregate[];
}

export interface ProjectionSet {
    accountBalances: AccountBalance[];
    consumption: Consumption;
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

export interface Reconciliation {
    id: EntityId;
    spaceId: EntityId;
    revision: StoredRevision;
    createdAt: UtcTimestamp;
    updatedAt: UtcTimestamp;
    deletedAt?: UtcTimestamp;
    accountId: EntityId;
    statementDate: FinanceDate;
    statementBalance: MoneyCents;
    transactionIds: NonEmptyVec<EntityId>;
}

export interface ReconciliationConfirm {
    accountId: EntityId;
    statementDate: FinanceDate;
    statementBalance: MoneyCents;
    selectedTransactionIds: NonEmptyVec<EntityId>;
}

export interface ReconciliationUnlock {
    reconciliationId: EntityId;
}

export interface Request {
    contractVersion: EngineBindingVersion;
    domainSchemaVersion: DomainSchemaVersion;
    spaceId: EntityId;
    aggregates: Aggregate[];
    command: Command;
    expectedRevisions: Expectation[];
    context: Context;
}

export interface ReverseRequest {
    contractVersion: EngineBindingVersion;
    domainSchemaVersion: DomainSchemaVersion;
    spaceId: EntityId;
    aggregates: Aggregate[];
    expectedRevisions: Expectation[];
    context: Context;
    targets: NonEmptyVec<ReverseTarget>;
}

export interface ReverseTarget {
    id: EntityId;
    previous?: Aggregate;
}

export interface RevisionExpectation {
    handle: EntityId;
    expectedRevision: Revision;
}

export interface Rule {
    id: EntityId;
    spaceId: EntityId;
    revision: StoredRevision;
    createdAt: UtcTimestamp;
    updatedAt: UtcTimestamp;
    deletedAt?: UtcTimestamp;
    order: Ordinal;
    conditions: NonEmptyVec<RuleCondition>;
    actions: NonEmptyVec<RuleAction>;
    stopProcessing: boolean;
    enabled: boolean;
}

export interface RuleCondition {
    field: ConditionField;
    operator: ConditionOperator;
    value: ConditionValue;
}

export interface RuleReorder {
    ruleIds: EntityId[];
}

export interface RuleRequest {
    contractVersion: EngineBindingVersion;
    domainSchemaVersion: DomainSchemaVersion;
    spaceId: EntityId;
    aggregates: Aggregate[];
    candidate: ImportCandidate;
}

export interface SaveCommand {
    aggregates: NonEmptyVec<Aggregate>;
}

export interface Schedule {
    id: EntityId;
    spaceId: EntityId;
    revision: StoredRevision;
    createdAt: UtcTimestamp;
    updatedAt: UtcTimestamp;
    deletedAt?: UtcTimestamp;
    startDate: FinanceDate;
    frequency: Frequency;
    interval: PositiveOrdinal;
    enabled: boolean;
    template: TransactionTemplate;
    endDate?: FinanceDate;
}

export interface ScheduleConfirm {
    scheduleId: EntityId;
    dueDate: FinanceDate;
    importedTransactionId?: EntityId;
}

export interface ScheduleOccurrence {
    id: EntityId;
    spaceId: EntityId;
    revision: StoredRevision;
    createdAt: UtcTimestamp;
    updatedAt: UtcTimestamp;
    deletedAt?: UtcTimestamp;
    scheduleId: EntityId;
    dueDate: FinanceDate;
    state: OccurrenceState;
    transactionId?: EntityId;
}

export interface ScheduleRequest {
    contractVersion: EngineBindingVersion;
    domainSchemaVersion: DomainSchemaVersion;
    spaceId: EntityId;
    scheduleId: EntityId;
    aggregates: Aggregate[];
    through: FinanceDate;
}

export interface ScheduleSkip {
    scheduleId: EntityId;
    dueDate: FinanceDate;
}

export interface SignedKeyRoster {
    roster: KeyRoster;
    signature: Base64Url;
}

export interface SnapshotOutcomeV2 {
    contractVersion: number;
    status: SnapshotStatus;
    snapshot: LocalSnapshot;
}

export interface Split {
    id: EntityId;
    categoryId: EntityId;
    amount: MoneyCents;
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

export interface SyncPage {
    state: SyncState;
    confirmed: ConfirmedAggregate[];
    removeOperationIds: EntityId[];
    projections: StoredProjection[];
}

export interface SyncState {
    profileId: EntityId;
    spaceId: EntityId;
    epoch: EntityId;
    cursor: string;
}

export interface Transaction {
    id: EntityId;
    spaceId: EntityId;
    revision: StoredRevision;
    createdAt: UtcTimestamp;
    updatedAt: UtcTimestamp;
    deletedAt?: UtcTimestamp;
    accountId: EntityId;
    amount: MoneyCents;
    kind: TransactionKind;
    clearance: Clearance;
    splits: Split[];
    payeeId?: EntityId;
    note?: string;
    transferId?: EntityId;
    date: FinanceDate;
    importReference?: NonEmptyText;
    scheduleOccurrenceId?: EntityId;
}

export interface TransactionTemplate {
    accountId: EntityId;
    amount: MoneyCents;
    kind: TransactionKind;
    clearance: Clearance;
    splits: Split[];
    payeeId?: EntityId;
    note?: string;
    transferId?: EntityId;
}

export interface Transfer {
    id: EntityId;
    spaceId: EntityId;
    revision: StoredRevision;
    createdAt: UtcTimestamp;
    updatedAt: UtcTimestamp;
    deletedAt?: UtcTimestamp;
    date: FinanceDate;
    sourceAccountId: EntityId;
    targetAccountId: EntityId;
    sourceTransactionId: EntityId;
    targetTransactionId: EntityId;
    amount: MoneyCents;
    budgetCategoryId?: EntityId;
    budgetRelease?: boolean;
}

export interface ValidationOutcome {
    contractVersion: number;
    status: ValidationStatus;
}

export interface WriteHandle {
    handle: PublicId;
    expectedRevision: PublicRevision;
    proposedRevision: PositiveRevision;
    previousCiphertextHash?: Base64Url;
}

export type AccountType = "checking" | "cash" | "savings" | "credit" | "other";

export type Aggregate = ({ aggregateType: "account" } & Account) | ({ aggregateType: "financialRevision" } & FinancialRevision) | ({ aggregateType: "categoryGroup" } & CategoryGroup) | ({ aggregateType: "category" } & Category) | ({ aggregateType: "payee" } & Payee) | ({ aggregateType: "transaction" } & Transaction) | ({ aggregateType: "transfer" } & Transfer) | ({ aggregateType: "reconciliation" } & Reconciliation) | ({ aggregateType: "importMapping" } & ImportMapping) | ({ aggregateType: "importBatch" } & ImportBatch) | ({ aggregateType: "importFingerprint" } & ImportFingerprint) | ({ aggregateType: "rule" } & Rule) | ({ aggregateType: "schedule" } & Schedule) | ({ aggregateType: "scheduleOccurrence" } & ScheduleOccurrence);

export type AggregateKind = "Account" | "FinancialRevision" | "CategoryGroup" | "Category" | "Payee" | "Transaction" | "Transfer" | "Reconciliation" | "ImportMapping" | "ImportBatch" | "ImportFingerprint" | "Rule" | "Schedule" | "ScheduleOccurrence";

export type Base64Url = string;

export type CalculationOutcome = { status: "money"; contractVersion: number; value: MoneyCents } | { status: "ruleApplied"; contractVersion: number; candidate: ImportCandidate; appliedRuleIds: EntityId[] } | { status: "classified"; contractVersion: number; rows: ClassificationRow[] } | { status: "dueDates"; contractVersion: number; dates: FinanceDate[] };

export type CalculationRequest = ({ calculationType: "money.parse" } & MoneyParseRequest) | ({ calculationType: "rule.apply" } & RuleRequest) | ({ calculationType: "import.classify" } & ImportRequest) | ({ calculationType: "schedule.dueDates" } & ScheduleRequest);

export type CategorySystem = "uncategorized";

export type Classification = "new" | "duplicate" | "conflict";

export type Clearance = "uncleared" | "cleared" | "reconciled";

export type Command = ({ commandType: "account.save" } & SaveCommand) | ({ commandType: "categoryGroup.save" } & SaveCommand) | ({ commandType: "category.save" } & SaveCommand) | ({ commandType: "payee.save" } & SaveCommand) | ({ commandType: "transaction.save" } & SaveCommand) | ({ commandType: "transfer.save" } & SaveCommand) | ({ commandType: "importMapping.save" } & SaveCommand) | ({ commandType: "importBatch.save" } & SaveCommand) | ({ commandType: "rule.save" } & SaveCommand) | ({ commandType: "schedule.save" } & SaveCommand) | ({ commandType: "account.archive" } & AggregateCommand) | ({ commandType: "category.archive" } & AggregateCommand) | ({ commandType: "transaction.delete" } & AggregateCommand) | ({ commandType: "transfer.delete" } & AggregateCommand) | ({ commandType: "rule.delete" } & AggregateCommand) | ({ commandType: "payee.merge" } & PayeeMerge) | ({ commandType: "reconciliation.confirm" } & ReconciliationConfirm) | ({ commandType: "reconciliation.unlock" } & ReconciliationUnlock) | ({ commandType: "rule.reorder" } & RuleReorder) | ({ commandType: "import.commit" } & ImportCommit) | ({ commandType: "schedule.confirm" } & ScheduleConfirm) | ({ commandType: "schedule.skip" } & ScheduleSkip);

export type CommandOutcomeV2 = { status: "changed"; contractVersion: number; changeSet: ChangeSet } | { status: "unchanged"; contractVersion: number };

export type CommitOutcomeV2 = { status: "committed"; contractVersion: number; value: LocalPortOutcomeV2 } | { status: "notCommitted"; contractVersion: number; code: PersistenceErrorCode } | { status: "unknown"; contractVersion: number; operationId: EntityId };

export type ConditionField = "date" | "amount" | "payee" | "memo";

export type ConditionOperator = "equals" | "contains" | "gte" | "lte";

export type ConditionValue = string | MoneyCents;

export type ContractError = { contractVersion: number; code: string; detail: string };

export type CryptoSuite = "XCHACHA20_POLY1305_IETF_ED25519_V1";

export type DomainSchemaVersion = number;

export type EngineBindingVersion = number;

export type EntityId = string;

export type FileHash = string;

export type FinanceDate = string;

export type Frequency = "weekly" | "monthly" | "yearly";

export type GroupKind = "income" | "expense";

export type ImportClearance = "uncleared" | "cleared";

export type ImportDecision = "import" | "exclude" | "separate";

export type ImportState = "ready" | "partial" | "completed";

export type LegacyJson = unknown;

export type LocalContractError = { contractVersion: number; code: string; detail: string };

export type LocalFormStatus = "formValid";

export type LocalHash = Base64Url;

export type LocalId = PublicId;

export type LocalPortCommand = { method: "readAggregate"; handle: EntityId } | { method: "query"; query: AggregateQuery } | { method: "applyAtomicBatch"; batch: AtomicBatch } | { method: "loadConfirmed"; spaceId: EntityId } | { method: "loadPending"; spaceId: EntityId } | { method: "saveSyncPage"; page: SyncPage } | { method: "exportSnapshot"; spaceId: EntityId } | { method: "replaceSnapshot"; snapshot: LocalSnapshot } | { method: "rebuildProjections"; request: ProjectionRebuild } | { method: "getSyncState"; spaceId: EntityId } | { method: "initializeArea"; spaceId: EntityId; proposedEpoch: EntityId };

export type LocalPortOutcomeV2 = { status: "aggregate"; contractVersion: number; value: StoredAggregate | null } | { status: "aggregates"; contractVersion: number; value: StoredAggregate[] } | { status: "confirmed"; contractVersion: number; value: ConfirmedAggregate[] } | { status: "pending"; contractVersion: number; value: PendingOperation[] } | { status: "snapshot"; contractVersion: number; value: LocalSnapshot } | { status: "syncState"; contractVersion: number; value: SyncState | null } | { status: "initialized"; contractVersion: number; epoch: EntityId } | { status: "applied"; contractVersion: number };

export type LocalPositive = number;

export type LocalRevision = number;

export type MoneyCents = number;

export type NonEmptyString = string;

export type NonEmptyText = string;

export type NonEmptyVec<T> = BoundedVec<T>;

export type OccurrenceState = "confirmed" | "skipped";

export type Ordinal = number;

export type ParserSource = "csv" | "camt053" | "ofx" | "qfx";

export type PendingState = "queued" | "sending" | "accepted" | "conflict" | "blocked" | "forbidden" | "invalid";

export type PersistenceErrorCode = "REVISION_CONFLICT" | "QUOTA" | "WRITE_FAILED" | "UPDATE_REQUIRED" | "EPOCH_MISMATCH" | "OPERATION_ID_REUSED";

export type PositiveOrdinal = number;

export type PositiveRevision = number;

export type ProjectionStatus = "projected";

export type ProtocolVersion = number;

export type PublicContractError = { contractVersion: number; code: PublicErrorCode; detail: string };

export type PublicErrorCode = "INVALID_ENVELOPE" | "INVALID_SIGNATURE" | "UNSUPPORTED_CRYPTO_SUITE" | "REVISION_CONFLICT" | "EPOCH_MISMATCH" | "KEY_VERSION_MISMATCH" | "ROSTER_MISMATCH" | "OPERATION_ID_REUSED" | "DEPENDENCY_NOT_ACCEPTED" | "UPDATE_REQUIRED";

export type PublicId = string;

export type PublicRevision = number;

export type PublicValidationStatus = "formValid";

export type Revision = number;

export type Role = "admin" | "member" | "viewer";

export type RuleAction = { field: "categoryId"; value: EntityId } | { field: "payeeId"; value: EntityId } | { field: "clearance"; value: ImportClearance };

export type SnapshotDomainVersion = number;

export type SnapshotStatus = "snapshot";

export type SnapshotStorageVersion = number;

export type StoredProjection = { kind: "balance"; spaceId: EntityId; key: EntityId; payload: MoneyCents } | { kind: "accountBalance"; spaceId: EntityId; key: EntityId; payload: BalancePayload } | { kind: "consumption"; spaceId: EntityId; key: NonEmptyText; payload: Consumption };

export type StoredRevision = number;

export type SupportedFlag = boolean;

export type TransactionKind = "normal" | "opening" | "transfer" | "contribution" | "settlement";

export type UnsupportedFlag = boolean;

export type UtcTimestamp = string;

export type ValidationRequest = { mode: "historical"; contractVersion: EngineBindingVersion; domainSchemaVersion: DomainSchemaVersion; spaceId: EntityId; aggregates: Aggregate[] } | { mode: "mutation"; contractVersion: EngineBindingVersion; domainSchemaVersion: DomainSchemaVersion; spaceId: EntityId; before: Aggregate[]; after: Aggregate[] };

export type ValidationStatus = "valid";


export class MoneyRequestV2 {
    free(): void;
    [Symbol.dispose](): void;
    constructor(contract_version: number, domain_schema_version: number, space_id: string, text: string);
    readonly contractVersion: number;
    readonly domainSchemaVersion: number;
    readonly spaceId: string;
    readonly text: string;
}

/**
 * Nur Ausgabevertrag: ein Erfolg hat Cent, eine Ablehnung Code/Meldung.
 */
export class MoneyResultV2 {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    readonly contractVersion: number;
    readonly errorCode: string | undefined;
    readonly message: string | undefined;
    readonly status: MoneyStatusV2;
    readonly value: number | undefined;
}

export enum MoneyStatusV2 {
    Money = 0,
    Rejected = 1,
}

export function calculate_json(request: string): string;

export function calculate_money_v2(request: MoneyRequestV2): MoneyResultV2;

export function calculate_v2(request: CalculationRequest): CalculationOutcome;

/**
 * K01-JSON-Vertrag; alle Facharbeit verbleibt in der unabhängigen Kernbibliothek.
 */
export function execute_json(request: string): string;

export function execute_v2(input: Request): CommandOutcomeV2;

export function project_json(request: string): string;

export function project_v2(request: ProjectionRequest): ProjectionOutcome;

export function reverse_json(request: string): string;

export function reverse_v2(request: ReverseRequest): CommandOutcomeV2;

export function roundtrip_local_snapshot_v2(input: LocalSnapshot): SnapshotOutcomeV2;

export function validate_json(request: string): string;

export function validate_local_migration_form_v2(input: StorageMigrationPlan): LocalFormOutcome;

export function validate_local_port_form_v2(input: LocalPortRequestV2): LocalFormOutcome;

export function validate_public_operation_form_v2(input: EncryptedOperation): PublicValidationOutcome;

export function validate_public_roster_form_v2(input: SignedKeyRoster): PublicValidationOutcome;

export function validate_v2(request: ValidationRequest): ValidationOutcome;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly __wbg_moneyrequestv2_free: (a: number, b: number) => void;
    readonly __wbg_moneyresultv2_free: (a: number, b: number) => void;
    readonly calculate_json: (a: number, b: number) => [number, number];
    readonly calculate_money_v2: (a: number) => number;
    readonly calculate_v2: (a: any) => [number, number, number];
    readonly execute_json: (a: number, b: number) => [number, number];
    readonly execute_v2: (a: any) => [number, number, number];
    readonly moneyrequestv2_contractVersion: (a: number) => number;
    readonly moneyrequestv2_domainSchemaVersion: (a: number) => number;
    readonly moneyrequestv2_new: (a: number, b: number, c: number, d: number, e: number, f: number) => number;
    readonly moneyrequestv2_spaceId: (a: number) => [number, number];
    readonly moneyrequestv2_text: (a: number) => [number, number];
    readonly moneyresultv2_contractVersion: (a: number) => number;
    readonly moneyresultv2_errorCode: (a: number) => [number, number];
    readonly moneyresultv2_message: (a: number) => [number, number];
    readonly moneyresultv2_status: (a: number) => number;
    readonly moneyresultv2_value: (a: number) => [number, number];
    readonly project_json: (a: number, b: number) => [number, number];
    readonly project_v2: (a: any) => [number, number, number];
    readonly reverse_json: (a: number, b: number) => [number, number];
    readonly reverse_v2: (a: any) => [number, number, number];
    readonly roundtrip_local_snapshot_v2: (a: any) => [number, number, number];
    readonly validate_json: (a: number, b: number) => [number, number];
    readonly validate_local_migration_form_v2: (a: any) => [number, number, number];
    readonly validate_local_port_form_v2: (a: any) => [number, number, number];
    readonly validate_public_operation_form_v2: (a: any) => [number, number, number];
    readonly validate_public_roster_form_v2: (a: any) => [number, number, number];
    readonly validate_v2: (a: any) => [number, number, number];
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
    readonly __wbindgen_exn_store: (a: number) => void;
    readonly __externref_table_alloc: () => number;
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __wbindgen_free: (a: number, b: number, c: number) => void;
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
