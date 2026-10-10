/* tslint:disable */
/* eslint-disable */
/**
 * Formgrenzen werden auch bei nativer Konstruktion erzwungen.
 */
export type BoundedVec<T> = T[];

/**
 * Native Records trennen Handle und Fachaggregat; Serde erhält das flache V1-Format.
 */
export type StoredAggregate = Aggregate & { handle: EntityId };

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

export interface ApplicationCommandV2 {
    spaceId: EntityId;
    aggregates: Aggregate[];
    command: Command;
    expectedRevisions: Expectation[];
    context: Context;
}

export interface ApplicationRequestV2 {
    contractVersion: number;
    domainSchemaVersion: number;
    started: CommitContext;
    current: CommitContext;
    mode: AreaMode;
    action: ApplicationActionV2;
}

export interface ApplicationReverseV2 {
    spaceId: EntityId;
    aggregates: Aggregate[];
    expectedRevisions: Expectation[];
    context: Context;
    targets: NonEmptyVec<ReverseTarget>;
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

export interface BrowserBackupInput {
    receipt: EncryptedBackupReceipt;
    ciphertext: number[];
}

export interface BrowserCiphertext {
    contractVersion: number;
    ciphertext: number[];
}

export interface BrowserReceiptLookup {
    contractVersion: number;
    receipt: LocalCommitReceipt | null;
}

export interface BrowserRuntimeOpen {
    contractVersion: number;
    context: CommitContext;
    mode: AreaMode;
    key: number[];
}

export interface BrowserRuntimePage {
    offset: number;
    limit: number;
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

export interface CommitContext {
    profileId: EntityId;
    spaceId: EntityId;
    epoch: EntityId;
    profileRevision: Revision;
    sessionGeneration: Revision;
    generation: Revision;
}

export interface CommittedRevision {
    handle: EntityId;
    revision: StoredRevision;
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

export interface EncryptedBackupRequest {
    profileId: LocalId;
    spaceId: LocalId;
    epoch: LocalId;
    snapshotHash: LocalHash;
    ciphertext: number[];
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

export interface Expectation {
    id: EntityId;
    expectedRevision: Revision;
}

export interface ExpectedHead {
    handle: PublicId;
    expectedRevision: PublicRevision;
}

export interface ExportFileRequest {
    suggestedName: string;
    mediaType: string;
    bytes: number[];
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

export interface ImportFileRequest {
    acceptedMediaTypes: string[];
    acceptedExtensions: string[];
    multiple: boolean;
    maxBytes?: LocalPositive;
    maxFiles?: LocalPositive;
    maxTotalBytes?: LocalPositive;
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

export interface ImportSourceQuery {
    spaceId: EntityId;
    accountId: EntityId;
    parserSource: string;
    externalId: string;
    limit: number;
}

export interface ImportedFile {
    name: string;
    mediaType?: string;
    bytes: number[];
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

export interface LocalCheckpointRestoreRequest {
    expected: LocalCommitCheckpoint;
    originalBackup: EncryptedBackupReceipt;
    ciphertext: number[];
    restoredEpoch: EntityId;
}

export interface LocalCheckpointRestoreV2 {
    expected: LocalCheckpointV2;
    originalBackup: EncryptedBackupReceipt;
    ciphertext: number[];
    restoredLocalEpoch: EntityId;
}

export interface LocalCheckpointV2 {
    checkpointVersion: number;
    physicalSchemaVersion: number;
    snapshot: LocalSnapshot;
    localWriteEpoch: EntityId;
    operations: LocalReceiptEntry[];
    recovery?: number[];
}

export interface LocalCommitCheckpoint {
    checkpointVersion: number;
    physicalSchemaVersion: number;
    snapshot: LocalSnapshot;
    operations: LocalReceiptEntry[];
}

export interface LocalCommitReceipt {
    identity: LocalOperationIdentity;
    contentHash: FileHash;
    committedRevisions: CommittedRevision[];
}

export interface LocalCommitRequest {
    identity: LocalOperationIdentity;
    batch: AtomicBatch;
}

export interface LocalFormOutcome {
    contractVersion: number;
    status: LocalFormStatus;
}

export interface LocalMigrationRequest {
    plan: StorageMigrationPlan;
    expectedSnapshot: LocalSnapshot;
    backup?: EncryptedBackupReceipt;
}

export interface LocalOperationIdentity {
    operationContractVersion: number;
    profileId: EntityId;
    spaceId: EntityId;
    epoch: EntityId;
    operationId: EntityId;
}

export interface LocalPortRequestV2 {
    contractVersion: EngineBindingVersion;
    command: LocalPortCommand;
}

export interface LocalReceiptEntry {
    request: LocalCommitRequest;
    receipt: LocalCommitReceipt;
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

export interface PendingIndexQuery {
    spaceId: EntityId;
    state: PendingState;
    limit: number;
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

export interface PlatformCommand {
    id: string;
    title: string;
    enabled: boolean;
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

export interface RuntimeEventV2 {
    contractVersion: number;
    context: CommitContext;
    canUndo: boolean;
    canRedo: boolean;
    result: RuntimeResultV2;
}

export interface RuntimePageV2 {
    contractVersion: number;
    context: CommitContext;
    offset: number;
    aggregates: Aggregate[];
}

export interface RuntimeRequestV2 {
    contractVersion: number;
    domainSchemaVersion: number;
    action: RuntimeActionV2;
}

export interface RuntimeSnapshotV2 {
    contractVersion: number;
    context: CommitContext;
    aggregates: Aggregate[];
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

export interface StorageFailure {
    contractVersion: number;
    code: StorageFailureCode;
    commitState: FailureCommitState;
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

export interface TransactionCursor {
    date: FinanceDate;
    handle: EntityId;
}

export interface TransactionIndexQuery {
    spaceId: EntityId;
    kind: ReferenceKind;
    reference: string;
    fromDate?: FinanceDate;
    throughDate?: FinanceDate;
    after?: TransactionCursor;
    limit: number;
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

export type ApplicationActionV2 = { actionType: "command"; request: ApplicationCommandV2 } | { actionType: "reverse"; request: ApplicationReverseV2 };

export type ApplicationFailureCode = "UPDATE_REQUIRED" | "SCOPE_CHANGED" | "WRONG_AREA" | "INVALID_STATE" | "FINANCE_REJECTED";

export type ApplicationPreparationV2 = { status: "prepared"; contractVersion: number; context: CommitContext; request: LocalCommitRequest } | { status: "unchanged"; contractVersion: number } | { status: "rejected"; contractVersion: number; code: ApplicationFailureCode; financeCode: string | null };

export type AreaMode = "standalone" | "connected";

export type Base64Url = string;

export type BrowserCommitOutcome = { status: "committed"; value: LocalCommitReceipt } | { status: "notCommitted"; error: StorageFailure } | { status: "unknown"; identity: LocalOperationIdentity };

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

export type Direction = "undo" | "redo";

export type DomainSchemaVersion = number;

export type EngineBindingVersion = number;

export type EntityId = string;

export type FailureCommitState = "notCommitted" | "unknown";

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

export type ProfileLoadOutcome = { kind: "missing" } | { kind: "loaded"; profile: LegacyJson } | { kind: "corrupt" } | { kind: "unreadable" };

export type ProjectionStatus = "projected";

export type ProtocolVersion = number;

export type PublicContractError = { contractVersion: number; code: PublicErrorCode; detail: string };

export type PublicErrorCode = "INVALID_ENVELOPE" | "INVALID_SIGNATURE" | "UNSUPPORTED_CRYPTO_SUITE" | "REVISION_CONFLICT" | "EPOCH_MISMATCH" | "KEY_VERSION_MISMATCH" | "ROSTER_MISMATCH" | "OPERATION_ID_REUSED" | "DEPENDENCY_NOT_ACCEPTED" | "UPDATE_REQUIRED";

export type PublicId = string;

export type PublicRevision = number;

export type PublicValidationStatus = "formValid";

export type ReferenceKind = "account" | "category" | "import";

export type Revision = number;

export type Role = "admin" | "member" | "viewer";

export type RuleAction = { field: "categoryId"; value: EntityId } | { field: "payeeId"; value: EntityId } | { field: "clearance"; value: ImportClearance };

export type RuntimeActionV2 = { actionType: "load" } | { actionType: "execute"; command: Command; expectedRevisions: Expectation[]; operation: Context } | { actionType: "history"; direction: Direction; operation: Context } | { actionType: "resolve" };

export type RuntimeCommitResultV2 = { status: "committed"; receipt: LocalCommitReceipt } | { status: "notCommitted"; error: StorageFailure } | { status: "unknown"; identity: LocalOperationIdentity };

export type RuntimeResultV2 = { status: "state" } | { status: "committed"; context: CommitContext; receipt: LocalCommitReceipt; current: boolean } | { status: "notCommitted"; error: StorageFailure } | { status: "readFailed"; error: StorageFailure } | { status: "unknown" } | { status: "busy" } | { status: "scopeChanged" } | { status: "idle" } | { status: "closed" } | { status: "rejected"; code: ApplicationFailureCode; financeCode: string | null };

export type ServerPersistenceCode = "REVISION_CONFLICT" | "QUOTA" | "WRITE_FAILED" | "UPDATE_REQUIRED" | "EPOCH_MISMATCH" | "OPERATION_ID_REUSED" | "CANCELLED" | "RESOURCE_UNAVAILABLE";

export type SnapshotDomainVersion = number;

export type SnapshotStatus = "snapshot";

export type SnapshotStorageVersion = number;

export type StorageFailureCode = "REVISION_CONFLICT" | "QUOTA" | "RESOURCE_UNAVAILABLE" | "WRITE_FAILED" | "UPDATE_REQUIRED" | "EPOCH_MISMATCH" | "CANCELLED" | "COMMIT_UNKNOWN" | "INVALID_RESPONSE" | "OPERATION_ID_REUSED";

export type StoragePersistenceOutcome = { status: "unsupported"; supported: UnsupportedFlag } | { status: "granted"; supported: SupportedFlag } | { status: "denied"; supported: SupportedFlag } | { status: "error"; supported: SupportedFlag };

export type StoredProjection = { kind: "balance"; spaceId: EntityId; key: EntityId; payload: MoneyCents } | { kind: "accountBalance"; spaceId: EntityId; key: EntityId; payload: BalancePayload } | { kind: "consumption"; spaceId: EntityId; key: NonEmptyText; payload: Consumption };

export type StoredRevision = number;

export type SupportedFlag = boolean;

export type TransactionKind = "normal" | "opening" | "transfer" | "contribution" | "settlement";

export type UnsupportedFlag = boolean;

export type UtcTimestamp = string;

export type ValidationRequest = { mode: "historical"; contractVersion: EngineBindingVersion; domainSchemaVersion: DomainSchemaVersion; spaceId: EntityId; aggregates: Aggregate[] } | { mode: "mutation"; contractVersion: EngineBindingVersion; domainSchemaVersion: DomainSchemaVersion; spaceId: EntityId; before: Aggregate[]; after: Aggregate[] };

export type ValidationStatus = "valid";


export class BrowserStorage {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    close(): void;
    close_runtime(): void;
    commit(request: LocalCommitRequest): BrowserCommitOutcome;
    contract_version(): number;
    lookup_result(identity: LocalOperationIdentity): BrowserReceiptLookup;
    open_runtime(input: BrowserRuntimeOpen): void;
    persist_backup(input: BrowserBackupInput): EncryptedBackupReceipt;
    port(request: LocalPortRequestV2): LocalPortOutcomeV2;
    query_imported(query: ImportSourceQuery): LocalPortOutcomeV2;
    query_pending(query: PendingIndexQuery): LocalPortOutcomeV2;
    query_transactions(query: TransactionIndexQuery): LocalPortOutcomeV2;
    read_backup(receipt: EncryptedBackupReceipt): BrowserCiphertext;
    rebuild_projection_cache(space: string): void;
    runtime(input: RuntimeRequestV2): RuntimeEventV2;
    runtime_page(input: BrowserRuntimePage): RuntimePageV2;
}

export class CreatedVault {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    static create(password: Uint8Array): CreatedVault;
    readonly record: Uint8Array;
    readonly recoveryCode: string;
}

export class CryptoSession {
    free(): void;
    [Symbol.dispose](): void;
    decrypt(nonce: Uint8Array, aad: Uint8Array, cipher: Uint8Array): Uint8Array;
    encrypt(aad: Uint8Array, plaintext: Uint8Array): EncryptedBytes;
    lock(): void;
    constructor(key: Uint8Array);
    open_snapshot(record: Uint8Array): Uint8Array;
    seal_snapshot(plaintext: Uint8Array): Uint8Array;
}

export class EncryptedBytes {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    readonly ciphertext: Uint8Array;
    readonly nonce: Uint8Array;
}

export class SealedSession {
    free(): void;
    [Symbol.dispose](): void;
    lock(): void;
    constructor();
    open(cipher: Uint8Array): Uint8Array;
    readonly publicKey: Uint8Array;
}

export class SigningSession {
    free(): void;
    [Symbol.dispose](): void;
    lock(): void;
    constructor();
    sign(message: Uint8Array): Uint8Array;
    readonly publicKey: Uint8Array;
}

export class VaultSession {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    has_space(id: string, version: bigint): boolean;
    lock(): void;
    static unlock_passphrase(record: Uint8Array, password: Uint8Array): VaultSession;
    static unlock_recovery(record: Uint8Array, code: string): VaultSession;
    upgrade_passphrase(record: Uint8Array, password: Uint8Array): Uint8Array;
    readonly publicKey: Uint8Array;
}

export function canonical_json(input: string): Uint8Array;

export function open_browser_storage(profile: string): Promise<BrowserStorage>;

export function passphrase_session(password: Uint8Array, salt: Uint8Array, ops: number, memory: number, legacy: boolean): CryptoSession;

export function roundtrip_local_snapshot_v2(input: LocalSnapshot): SnapshotOutcomeV2;

export function roundtrip_storage_failure_v2(input: StorageFailure): StorageFailure;

export function seal_to(message: Uint8Array, _public: Uint8Array): Uint8Array;

export function validate_key_pairs(identity_public: Uint8Array, identity_secret: Uint8Array, encryption_public: Uint8Array, encryption_secret: Uint8Array): void;

export function validate_local_migration_form_v2(input: StorageMigrationPlan): LocalFormOutcome;

export function validate_local_port_form_v2(input: LocalPortRequestV2): LocalFormOutcome;

export function validate_public_operation_form_v2(input: EncryptedOperation): PublicValidationOutcome;

export function validate_public_roster_form_v2(input: SignedKeyRoster): PublicValidationOutcome;

export function verify_public(message: Uint8Array, signature: Uint8Array, public_key: Uint8Array): boolean;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly __wbg_browserstorage_free: (a: number, b: number) => void;
    readonly __wbg_createdvault_free: (a: number, b: number) => void;
    readonly __wbg_cryptosession_free: (a: number, b: number) => void;
    readonly __wbg_encryptedbytes_free: (a: number, b: number) => void;
    readonly __wbg_sealedsession_free: (a: number, b: number) => void;
    readonly __wbg_signingsession_free: (a: number, b: number) => void;
    readonly __wbg_vaultsession_free: (a: number, b: number) => void;
    readonly browserstorage_close: (a: number) => [number, number];
    readonly browserstorage_close_runtime: (a: number) => void;
    readonly browserstorage_commit: (a: number, b: any) => [number, number, number];
    readonly browserstorage_contract_version: (a: number) => number;
    readonly browserstorage_lookup_result: (a: number, b: any) => [number, number, number];
    readonly browserstorage_open_runtime: (a: number, b: any) => [number, number];
    readonly browserstorage_persist_backup: (a: number, b: any) => [number, number, number];
    readonly browserstorage_port: (a: number, b: any) => [number, number, number];
    readonly browserstorage_query_imported: (a: number, b: any) => [number, number, number];
    readonly browserstorage_query_pending: (a: number, b: any) => [number, number, number];
    readonly browserstorage_query_transactions: (a: number, b: any) => [number, number, number];
    readonly browserstorage_read_backup: (a: number, b: any) => [number, number, number];
    readonly browserstorage_rebuild_projection_cache: (a: number, b: number, c: number) => [number, number];
    readonly browserstorage_runtime: (a: number, b: any) => [number, number, number];
    readonly browserstorage_runtime_page: (a: number, b: any) => [number, number, number];
    readonly canonical_json: (a: number, b: number) => [number, number, number, number];
    readonly createdvault_create: (a: number, b: number) => [number, number, number];
    readonly createdvault_record: (a: number) => [number, number];
    readonly createdvault_recoveryCode: (a: number) => [number, number];
    readonly cryptosession_decrypt: (a: number, b: number, c: number, d: number, e: number, f: number, g: number) => [number, number, number];
    readonly cryptosession_encrypt: (a: number, b: number, c: number, d: number, e: number) => [number, number, number];
    readonly cryptosession_lock: (a: number) => void;
    readonly cryptosession_new: (a: number, b: number) => [number, number, number];
    readonly cryptosession_open_snapshot: (a: number, b: number, c: number) => [number, number, number];
    readonly cryptosession_seal_snapshot: (a: number, b: number, c: number) => [number, number, number, number];
    readonly encryptedbytes_ciphertext: (a: number) => [number, number];
    readonly encryptedbytes_nonce: (a: number) => [number, number];
    readonly open_browser_storage: (a: number, b: number) => any;
    readonly passphrase_session: (a: number, b: number, c: number, d: number, e: number, f: number, g: number) => [number, number, number];
    readonly roundtrip_local_snapshot_v2: (a: any) => [number, number, number];
    readonly roundtrip_storage_failure_v2: (a: any) => [number, number, number];
    readonly seal_to: (a: number, b: number, c: number, d: number) => [number, number, number, number];
    readonly sealedsession_lock: (a: number) => void;
    readonly sealedsession_new: () => [number, number, number];
    readonly sealedsession_open: (a: number, b: number, c: number) => [number, number, number];
    readonly sealedsession_publicKey: (a: number) => [number, number];
    readonly signingsession_lock: (a: number) => void;
    readonly signingsession_new: () => [number, number, number];
    readonly signingsession_publicKey: (a: number) => [number, number];
    readonly signingsession_sign: (a: number, b: number, c: number) => [number, number, number, number];
    readonly validate_key_pairs: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number) => [number, number];
    readonly validate_local_migration_form_v2: (a: any) => [number, number, number];
    readonly validate_local_port_form_v2: (a: any) => [number, number, number];
    readonly validate_public_operation_form_v2: (a: any) => [number, number, number];
    readonly validate_public_roster_form_v2: (a: any) => [number, number, number];
    readonly vaultsession_has_space: (a: number, b: number, c: number, d: bigint) => number;
    readonly vaultsession_lock: (a: number) => void;
    readonly vaultsession_publicKey: (a: number) => [number, number, number, number];
    readonly vaultsession_unlock_passphrase: (a: number, b: number, c: number, d: number) => [number, number, number];
    readonly vaultsession_unlock_recovery: (a: number, b: number, c: number, d: number) => [number, number, number];
    readonly vaultsession_upgrade_passphrase: (a: number, b: number, c: number, d: number, e: number) => [number, number, number, number];
    readonly verify_public: (a: number, b: number, c: number, d: number, e: number, f: number) => number;
    readonly rust_sqlite_wasm_abort: () => void;
    readonly rust_sqlite_wasm_assert_fail: (a: number, b: number, c: number, d: number) => void;
    readonly rust_sqlite_wasm_calloc: (a: number, b: number) => number;
    readonly rust_sqlite_wasm_free: (a: number) => void;
    readonly rust_sqlite_wasm_getentropy: (a: number, b: number) => number;
    readonly rust_sqlite_wasm_localtime: (a: number) => number;
    readonly rust_sqlite_wasm_malloc: (a: number) => number;
    readonly rust_sqlite_wasm_realloc: (a: number, b: number) => number;
    readonly sqlite3_os_end: () => number;
    readonly sqlite3_os_init: () => number;
    readonly wasm_bindgen_740f87ab467470cf___convert__closures_____invoke___js_sys_f8d1592f528dc307___Function_fn_wasm_bindgen_740f87ab467470cf___JsValue_____wasm_bindgen_740f87ab467470cf___sys__Undefined___js_sys_f8d1592f528dc307___Function_fn_wasm_bindgen_740f87ab467470cf___JsValue_____wasm_bindgen_740f87ab467470cf___sys__Undefined_______true_: (a: number, b: number, c: any, d: any) => void;
    readonly wasm_bindgen_740f87ab467470cf___convert__closures_____invoke___wasm_bindgen_740f87ab467470cf___JsValue__core_608f92abc48d28da___result__Result_____wasm_bindgen_740f87ab467470cf___JsError___true_: (a: number, b: number, c: any) => [number, number];
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
    readonly __wbindgen_exn_store: (a: number) => void;
    readonly __externref_table_alloc: () => number;
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __wbindgen_destroy_closure: (a: number, b: number) => void;
    readonly __externref_table_dealloc: (a: number) => void;
    readonly __wbindgen_free: (a: number, b: number, c: number) => void;
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
