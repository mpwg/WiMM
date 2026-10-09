// SPDX-License-Identifier: AGPL-3.0-or-later
//! Typisierter V1-Formvertrag. Fachliche Querbeziehungen prüft weiterhin der Kern.
//! Keine UI-/ORM-Entities; opaque Importmapping bleibt ein unverändertes Fremdpayload.
use crate::{CoreResult, scalars::*};
use serde::{Deserialize, Serialize};
#[cfg_attr(feature = "contract-schema", derive(schemars::JsonSchema))]
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum AccountType {
    Checking,
    Cash,
    Savings,
    Credit,
    Other,
}
#[cfg_attr(feature = "contract-schema", derive(schemars::JsonSchema))]
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum GroupKind {
    Income,
    Expense,
}
#[cfg_attr(feature = "contract-schema", derive(schemars::JsonSchema))]
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum CategorySystem {
    Uncategorized,
}
#[cfg_attr(feature = "contract-schema", derive(schemars::JsonSchema))]
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum TransactionKind {
    Normal,
    Opening,
    Transfer,
    Contribution,
    Settlement,
}
#[cfg_attr(feature = "contract-schema", derive(schemars::JsonSchema))]
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum Clearance {
    Uncleared,
    Cleared,
    Reconciled,
}
#[cfg_attr(feature = "contract-schema", derive(schemars::JsonSchema))]
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ImportClearance {
    Uncleared,
    Cleared,
}
#[cfg_attr(feature = "contract-schema", derive(schemars::JsonSchema))]
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ParserSource {
    Csv,
    Camt053,
    Ofx,
    Qfx,
}
#[cfg_attr(feature = "contract-schema", derive(schemars::JsonSchema))]
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ImportDecision {
    Import,
    Exclude,
    Separate,
}
#[cfg_attr(feature = "contract-schema", derive(schemars::JsonSchema))]
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ImportState {
    Ready,
    Partial,
    Completed,
}
#[cfg_attr(feature = "contract-schema", derive(schemars::JsonSchema))]
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ConditionField {
    Date,
    Amount,
    Payee,
    Memo,
}
#[cfg_attr(feature = "contract-schema", derive(schemars::JsonSchema))]
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ConditionOperator {
    Equals,
    Contains,
    Gte,
    Lte,
}
#[cfg_attr(feature = "contract-schema", derive(schemars::JsonSchema))]
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum Frequency {
    Weekly,
    Monthly,
    Yearly,
}
#[cfg_attr(feature = "contract-schema", derive(schemars::JsonSchema))]
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum OccurrenceState {
    Confirmed,
    Skipped,
}
#[cfg_attr(feature = "contract-schema", derive(schemars::JsonSchema))]
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(untagged)]
pub enum ConditionValue {
    Text(String),
    Money(MoneyCents),
}
#[cfg_attr(feature = "contract-schema", derive(schemars::JsonSchema))]
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(
    tag = "field",
    content = "value",
    rename_all = "camelCase",
    deny_unknown_fields
)]
pub enum RuleAction {
    CategoryId(EntityId),
    PayeeId(EntityId),
    Clearance(ImportClearance),
}
#[cfg_attr(feature = "contract-schema", derive(schemars::JsonSchema))]
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Split {
    pub id: EntityId,
    pub category_id: EntityId,
    pub amount: MoneyCents,
}
#[cfg_attr(feature = "contract-schema", derive(schemars::JsonSchema))]
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ImportCandidate {
    pub source_row: PositiveOrdinal,
    pub date: FinanceDate,
    pub amount: MoneyCents,
    #[serde(
        default,
        deserialize_with = "present",
        skip_serializing_if = "Option::is_none"
    )]
    #[cfg_attr(feature = "contract-schema", schemars(with = "ParserSource"))]
    pub parser_source: Option<ParserSource>,
    #[serde(
        default,
        deserialize_with = "present",
        skip_serializing_if = "Option::is_none"
    )]
    #[cfg_attr(feature = "contract-schema", schemars(with = "String"))]
    pub payee: Option<String>,
    #[serde(
        default,
        deserialize_with = "present",
        skip_serializing_if = "Option::is_none"
    )]
    #[cfg_attr(feature = "contract-schema", schemars(with = "String"))]
    pub memo: Option<String>,
    #[serde(
        default,
        deserialize_with = "present",
        skip_serializing_if = "Option::is_none"
    )]
    #[cfg_attr(feature = "contract-schema", schemars(with = "String"))]
    pub external_id: Option<String>,
    #[serde(
        default,
        deserialize_with = "present",
        skip_serializing_if = "Option::is_none"
    )]
    #[cfg_attr(feature = "contract-schema", schemars(with = "NonEmptyText"))]
    pub source_fingerprint: Option<NonEmptyText>,
    #[serde(
        default,
        deserialize_with = "present",
        skip_serializing_if = "Option::is_none"
    )]
    #[cfg_attr(feature = "contract-schema", schemars(with = "EntityId"))]
    pub category_id: Option<EntityId>,
    #[serde(
        default,
        deserialize_with = "present",
        skip_serializing_if = "Option::is_none"
    )]
    #[cfg_attr(feature = "contract-schema", schemars(with = "EntityId"))]
    pub payee_id: Option<EntityId>,
    #[serde(
        default,
        deserialize_with = "present",
        skip_serializing_if = "Option::is_none"
    )]
    #[cfg_attr(feature = "contract-schema", schemars(with = "ImportClearance"))]
    pub clearance: Option<ImportClearance>,
}
#[cfg_attr(feature = "contract-schema", derive(schemars::JsonSchema))]
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ImportRow {
    pub source_row: PositiveOrdinal,
    #[serde(deserialize_with = "nullable")]
    #[cfg_attr(
        feature = "contract-schema",
        schemars(with = "crate::schema::RequiredNullableCandidate")
    )]
    pub candidate: Option<ImportCandidate>,
    pub decision: ImportDecision,
    pub issues: Vec<String>,
}
#[cfg_attr(feature = "contract-schema", derive(schemars::JsonSchema))]
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct RuleCondition {
    pub field: ConditionField,
    pub operator: ConditionOperator,
    pub value: ConditionValue,
}
#[cfg_attr(feature = "contract-schema", derive(schemars::JsonSchema))]
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct TransactionTemplate {
    pub account_id: EntityId,
    pub amount: MoneyCents,
    pub kind: TransactionKind,
    pub clearance: Clearance,
    pub splits: Vec<Split>,
    #[serde(
        default,
        deserialize_with = "present",
        skip_serializing_if = "Option::is_none"
    )]
    #[cfg_attr(feature = "contract-schema", schemars(with = "EntityId"))]
    pub payee_id: Option<EntityId>,
    #[serde(
        default,
        deserialize_with = "present",
        skip_serializing_if = "Option::is_none"
    )]
    #[cfg_attr(feature = "contract-schema", schemars(with = "String"))]
    pub note: Option<String>,
    #[serde(
        default,
        deserialize_with = "present",
        skip_serializing_if = "Option::is_none"
    )]
    #[cfg_attr(feature = "contract-schema", schemars(with = "EntityId"))]
    pub transfer_id: Option<EntityId>,
}
#[cfg_attr(feature = "contract-schema", derive(schemars::JsonSchema))]
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Account {
    pub id: EntityId,
    pub space_id: EntityId,
    pub revision: StoredRevision,
    pub created_at: UtcTimestamp,
    pub updated_at: UtcTimestamp,
    #[serde(
        default,
        deserialize_with = "present",
        skip_serializing_if = "Option::is_none"
    )]
    #[cfg_attr(feature = "contract-schema", schemars(with = "UtcTimestamp"))]
    pub deleted_at: Option<UtcTimestamp>,
    pub name: NonEmptyText,
    #[serde(rename = "type")]
    pub account_type: AccountType,
    pub on_budget: bool,
    pub archived: bool,
}
#[cfg_attr(feature = "contract-schema", derive(schemars::JsonSchema))]
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct FinancialRevision {
    pub id: EntityId,
    pub space_id: EntityId,
    pub revision: StoredRevision,
    pub created_at: UtcTimestamp,
    pub updated_at: UtcTimestamp,
    #[serde(
        default,
        deserialize_with = "present",
        skip_serializing_if = "Option::is_none"
    )]
    #[cfg_attr(feature = "contract-schema", schemars(with = "UtcTimestamp"))]
    pub deleted_at: Option<UtcTimestamp>,
}
#[cfg_attr(feature = "contract-schema", derive(schemars::JsonSchema))]
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct CategoryGroup {
    pub id: EntityId,
    pub space_id: EntityId,
    pub revision: StoredRevision,
    pub created_at: UtcTimestamp,
    pub updated_at: UtcTimestamp,
    #[serde(
        default,
        deserialize_with = "present",
        skip_serializing_if = "Option::is_none"
    )]
    #[cfg_attr(feature = "contract-schema", schemars(with = "UtcTimestamp"))]
    pub deleted_at: Option<UtcTimestamp>,
    pub name: NonEmptyText,
    pub kind: GroupKind,
    pub sort_order: Ordinal,
    pub archived: bool,
}
#[cfg_attr(feature = "contract-schema", derive(schemars::JsonSchema))]
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Category {
    pub id: EntityId,
    pub space_id: EntityId,
    pub revision: StoredRevision,
    pub created_at: UtcTimestamp,
    pub updated_at: UtcTimestamp,
    #[serde(
        default,
        deserialize_with = "present",
        skip_serializing_if = "Option::is_none"
    )]
    #[cfg_attr(feature = "contract-schema", schemars(with = "UtcTimestamp"))]
    pub deleted_at: Option<UtcTimestamp>,
    pub name: NonEmptyText,
    pub group_id: EntityId,
    pub sort_order: Ordinal,
    pub archived: bool,
    #[serde(
        default,
        deserialize_with = "present",
        skip_serializing_if = "Option::is_none"
    )]
    #[cfg_attr(feature = "contract-schema", schemars(with = "CategorySystem"))]
    pub system: Option<CategorySystem>,
}
#[cfg_attr(feature = "contract-schema", derive(schemars::JsonSchema))]
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Payee {
    pub id: EntityId,
    pub space_id: EntityId,
    pub revision: StoredRevision,
    pub created_at: UtcTimestamp,
    pub updated_at: UtcTimestamp,
    #[serde(
        default,
        deserialize_with = "present",
        skip_serializing_if = "Option::is_none"
    )]
    #[cfg_attr(feature = "contract-schema", schemars(with = "UtcTimestamp"))]
    pub deleted_at: Option<UtcTimestamp>,
    pub name: NonEmptyText,
    pub aliases: Vec<NonEmptyText>,
    pub archived: bool,
}
#[cfg_attr(feature = "contract-schema", derive(schemars::JsonSchema))]
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Transaction {
    pub id: EntityId,
    pub space_id: EntityId,
    pub revision: StoredRevision,
    pub created_at: UtcTimestamp,
    pub updated_at: UtcTimestamp,
    #[serde(
        default,
        deserialize_with = "present",
        skip_serializing_if = "Option::is_none"
    )]
    #[cfg_attr(feature = "contract-schema", schemars(with = "UtcTimestamp"))]
    pub deleted_at: Option<UtcTimestamp>,
    pub account_id: EntityId,
    pub amount: MoneyCents,
    pub kind: TransactionKind,
    pub clearance: Clearance,
    pub splits: Vec<Split>,
    #[serde(
        default,
        deserialize_with = "present",
        skip_serializing_if = "Option::is_none"
    )]
    #[cfg_attr(feature = "contract-schema", schemars(with = "EntityId"))]
    pub payee_id: Option<EntityId>,
    #[serde(
        default,
        deserialize_with = "present",
        skip_serializing_if = "Option::is_none"
    )]
    #[cfg_attr(feature = "contract-schema", schemars(with = "String"))]
    pub note: Option<String>,
    #[serde(
        default,
        deserialize_with = "present",
        skip_serializing_if = "Option::is_none"
    )]
    #[cfg_attr(feature = "contract-schema", schemars(with = "EntityId"))]
    pub transfer_id: Option<EntityId>,
    pub date: FinanceDate,
    #[serde(
        default,
        deserialize_with = "present",
        skip_serializing_if = "Option::is_none"
    )]
    #[cfg_attr(feature = "contract-schema", schemars(with = "NonEmptyText"))]
    pub import_reference: Option<NonEmptyText>,
    #[serde(
        default,
        deserialize_with = "present",
        skip_serializing_if = "Option::is_none"
    )]
    #[cfg_attr(feature = "contract-schema", schemars(with = "EntityId"))]
    pub schedule_occurrence_id: Option<EntityId>,
}
#[cfg_attr(feature = "contract-schema", derive(schemars::JsonSchema))]
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Transfer {
    pub id: EntityId,
    pub space_id: EntityId,
    pub revision: StoredRevision,
    pub created_at: UtcTimestamp,
    pub updated_at: UtcTimestamp,
    #[serde(
        default,
        deserialize_with = "present",
        skip_serializing_if = "Option::is_none"
    )]
    #[cfg_attr(feature = "contract-schema", schemars(with = "UtcTimestamp"))]
    pub deleted_at: Option<UtcTimestamp>,
    pub date: FinanceDate,
    pub source_account_id: EntityId,
    pub target_account_id: EntityId,
    pub source_transaction_id: EntityId,
    pub target_transaction_id: EntityId,
    pub amount: MoneyCents,
    #[serde(
        default,
        deserialize_with = "present",
        skip_serializing_if = "Option::is_none"
    )]
    #[cfg_attr(feature = "contract-schema", schemars(with = "EntityId"))]
    pub budget_category_id: Option<EntityId>,
    #[serde(
        default,
        deserialize_with = "present",
        skip_serializing_if = "Option::is_none"
    )]
    #[cfg_attr(feature = "contract-schema", schemars(with = "bool"))]
    pub budget_release: Option<bool>,
}
#[cfg_attr(feature = "contract-schema", derive(schemars::JsonSchema))]
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Reconciliation {
    pub id: EntityId,
    pub space_id: EntityId,
    pub revision: StoredRevision,
    pub created_at: UtcTimestamp,
    pub updated_at: UtcTimestamp,
    #[serde(
        default,
        deserialize_with = "present",
        skip_serializing_if = "Option::is_none"
    )]
    #[cfg_attr(feature = "contract-schema", schemars(with = "UtcTimestamp"))]
    pub deleted_at: Option<UtcTimestamp>,
    pub account_id: EntityId,
    pub statement_date: FinanceDate,
    pub statement_balance: MoneyCents,
    pub transaction_ids: NonEmptyVec<EntityId>,
}
#[cfg_attr(feature = "contract-schema", derive(schemars::JsonSchema))]
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ImportMapping {
    pub id: EntityId,
    pub space_id: EntityId,
    pub revision: StoredRevision,
    pub created_at: UtcTimestamp,
    pub updated_at: UtcTimestamp,
    #[serde(
        default,
        deserialize_with = "present",
        skip_serializing_if = "Option::is_none"
    )]
    #[cfg_attr(feature = "contract-schema", schemars(with = "UtcTimestamp"))]
    pub deleted_at: Option<UtcTimestamp>,
    pub name: NonEmptyText,
    pub mapping: serde_json::Value,
}
#[cfg_attr(feature = "contract-schema", derive(schemars::JsonSchema))]
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ImportBatch {
    pub id: EntityId,
    pub space_id: EntityId,
    pub revision: StoredRevision,
    pub created_at: UtcTimestamp,
    pub updated_at: UtcTimestamp,
    #[serde(
        default,
        deserialize_with = "present",
        skip_serializing_if = "Option::is_none"
    )]
    #[cfg_attr(feature = "contract-schema", schemars(with = "UtcTimestamp"))]
    pub deleted_at: Option<UtcTimestamp>,
    pub file_hash: FileHash,
    pub account_id: EntityId,
    pub rows: BoundedVec<ImportRow, 1, 100_000>,
    pub committed_rows: Vec<PositiveOrdinal>,
    pub state: ImportState,
}
#[cfg_attr(feature = "contract-schema", derive(schemars::JsonSchema))]
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ImportFingerprint {
    pub id: EntityId,
    pub space_id: EntityId,
    pub revision: StoredRevision,
    pub created_at: UtcTimestamp,
    pub updated_at: UtcTimestamp,
    #[serde(
        default,
        deserialize_with = "present",
        skip_serializing_if = "Option::is_none"
    )]
    #[cfg_attr(feature = "contract-schema", schemars(with = "UtcTimestamp"))]
    pub deleted_at: Option<UtcTimestamp>,
    pub account_id: EntityId,
    pub parser_source: NonEmptyText,
    pub fingerprint: NonEmptyText,
    pub transaction_id: EntityId,
    pub import_id: EntityId,
    pub source_row: PositiveOrdinal,
    #[serde(
        default,
        deserialize_with = "present",
        skip_serializing_if = "Option::is_none"
    )]
    #[cfg_attr(feature = "contract-schema", schemars(with = "String"))]
    pub external_id: Option<String>,
}
#[cfg_attr(feature = "contract-schema", derive(schemars::JsonSchema))]
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Rule {
    pub id: EntityId,
    pub space_id: EntityId,
    pub revision: StoredRevision,
    pub created_at: UtcTimestamp,
    pub updated_at: UtcTimestamp,
    #[serde(
        default,
        deserialize_with = "present",
        skip_serializing_if = "Option::is_none"
    )]
    #[cfg_attr(feature = "contract-schema", schemars(with = "UtcTimestamp"))]
    pub deleted_at: Option<UtcTimestamp>,
    pub order: Ordinal,
    pub conditions: NonEmptyVec<RuleCondition>,
    pub actions: NonEmptyVec<RuleAction>,
    pub stop_processing: bool,
    pub enabled: bool,
}
#[cfg_attr(feature = "contract-schema", derive(schemars::JsonSchema))]
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Schedule {
    pub id: EntityId,
    pub space_id: EntityId,
    pub revision: StoredRevision,
    pub created_at: UtcTimestamp,
    pub updated_at: UtcTimestamp,
    #[serde(
        default,
        deserialize_with = "present",
        skip_serializing_if = "Option::is_none"
    )]
    #[cfg_attr(feature = "contract-schema", schemars(with = "UtcTimestamp"))]
    pub deleted_at: Option<UtcTimestamp>,
    pub start_date: FinanceDate,
    pub frequency: Frequency,
    pub interval: PositiveOrdinal,
    pub enabled: bool,
    pub template: TransactionTemplate,
    #[serde(
        default,
        deserialize_with = "present",
        skip_serializing_if = "Option::is_none"
    )]
    #[cfg_attr(feature = "contract-schema", schemars(with = "FinanceDate"))]
    pub end_date: Option<FinanceDate>,
}
#[cfg_attr(feature = "contract-schema", derive(schemars::JsonSchema))]
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ScheduleOccurrence {
    pub id: EntityId,
    pub space_id: EntityId,
    pub revision: StoredRevision,
    pub created_at: UtcTimestamp,
    pub updated_at: UtcTimestamp,
    #[serde(
        default,
        deserialize_with = "present",
        skip_serializing_if = "Option::is_none"
    )]
    #[cfg_attr(feature = "contract-schema", schemars(with = "UtcTimestamp"))]
    pub deleted_at: Option<UtcTimestamp>,
    pub schedule_id: EntityId,
    pub due_date: FinanceDate,
    pub state: OccurrenceState,
    #[serde(
        default,
        deserialize_with = "present",
        skip_serializing_if = "Option::is_none"
    )]
    #[cfg_attr(feature = "contract-schema", schemars(with = "EntityId"))]
    pub transaction_id: Option<EntityId>,
}
#[cfg_attr(feature = "contract-schema", derive(schemars::JsonSchema))]
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "aggregateType", rename_all = "camelCase")]
pub enum Aggregate {
    Account(Account),
    FinancialRevision(FinancialRevision),
    CategoryGroup(CategoryGroup),
    Category(Category),
    Payee(Payee),
    Transaction(Transaction),
    Transfer(Transfer),
    Reconciliation(Reconciliation),
    ImportMapping(ImportMapping),
    ImportBatch(ImportBatch),
    ImportFingerprint(ImportFingerprint),
    Rule(Rule),
    Schedule(Schedule),
    ScheduleOccurrence(ScheduleOccurrence),
}
#[cfg_attr(feature = "contract-schema", derive(schemars::JsonSchema))]
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AggregateKind {
    Account,
    FinancialRevision,
    CategoryGroup,
    Category,
    Payee,
    Transaction,
    Transfer,
    Reconciliation,
    ImportMapping,
    ImportBatch,
    ImportFingerprint,
    Rule,
    Schedule,
    ScheduleOccurrence,
}
impl AggregateKind {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Account => "account",
            Self::FinancialRevision => "financialRevision",
            Self::CategoryGroup => "categoryGroup",
            Self::Category => "category",
            Self::Payee => "payee",
            Self::Transaction => "transaction",
            Self::Transfer => "transfer",
            Self::Reconciliation => "reconciliation",
            Self::ImportMapping => "importMapping",
            Self::ImportBatch => "importBatch",
            Self::ImportFingerprint => "importFingerprint",
            Self::Rule => "rule",
            Self::Schedule => "schedule",
            Self::ScheduleOccurrence => "scheduleOccurrence",
        }
    }
}
impl Aggregate {
    pub fn kind(&self) -> AggregateKind {
        match self {
            Self::Account(_) => AggregateKind::Account,
            Self::FinancialRevision(_) => AggregateKind::FinancialRevision,
            Self::CategoryGroup(_) => AggregateKind::CategoryGroup,
            Self::Category(_) => AggregateKind::Category,
            Self::Payee(_) => AggregateKind::Payee,
            Self::Transaction(_) => AggregateKind::Transaction,
            Self::Transfer(_) => AggregateKind::Transfer,
            Self::Reconciliation(_) => AggregateKind::Reconciliation,
            Self::ImportMapping(_) => AggregateKind::ImportMapping,
            Self::ImportBatch(_) => AggregateKind::ImportBatch,
            Self::ImportFingerprint(_) => AggregateKind::ImportFingerprint,
            Self::Rule(_) => AggregateKind::Rule,
            Self::Schedule(_) => AggregateKind::Schedule,
            Self::ScheduleOccurrence(_) => AggregateKind::ScheduleOccurrence,
        }
    }
    pub fn created_at(&self) -> &UtcTimestamp {
        match self {
            Self::Account(v) => &v.created_at,
            Self::FinancialRevision(v) => &v.created_at,
            Self::CategoryGroup(v) => &v.created_at,
            Self::Category(v) => &v.created_at,
            Self::Payee(v) => &v.created_at,
            Self::Transaction(v) => &v.created_at,
            Self::Transfer(v) => &v.created_at,
            Self::Reconciliation(v) => &v.created_at,
            Self::ImportMapping(v) => &v.created_at,
            Self::ImportBatch(v) => &v.created_at,
            Self::ImportFingerprint(v) => &v.created_at,
            Self::Rule(v) => &v.created_at,
            Self::Schedule(v) => &v.created_at,
            Self::ScheduleOccurrence(v) => &v.created_at,
        }
    }
    pub fn updated_at(&self) -> &UtcTimestamp {
        match self {
            Self::Account(v) => &v.updated_at,
            Self::FinancialRevision(v) => &v.updated_at,
            Self::CategoryGroup(v) => &v.updated_at,
            Self::Category(v) => &v.updated_at,
            Self::Payee(v) => &v.updated_at,
            Self::Transaction(v) => &v.updated_at,
            Self::Transfer(v) => &v.updated_at,
            Self::Reconciliation(v) => &v.updated_at,
            Self::ImportMapping(v) => &v.updated_at,
            Self::ImportBatch(v) => &v.updated_at,
            Self::ImportFingerprint(v) => &v.updated_at,
            Self::Rule(v) => &v.updated_at,
            Self::Schedule(v) => &v.updated_at,
            Self::ScheduleOccurrence(v) => &v.updated_at,
        }
    }
    pub fn revision_mut(&mut self) -> &mut StoredRevision {
        match self {
            Self::Account(v) => &mut v.revision,
            Self::FinancialRevision(v) => &mut v.revision,
            Self::CategoryGroup(v) => &mut v.revision,
            Self::Category(v) => &mut v.revision,
            Self::Payee(v) => &mut v.revision,
            Self::Transaction(v) => &mut v.revision,
            Self::Transfer(v) => &mut v.revision,
            Self::Reconciliation(v) => &mut v.revision,
            Self::ImportMapping(v) => &mut v.revision,
            Self::ImportBatch(v) => &mut v.revision,
            Self::ImportFingerprint(v) => &mut v.revision,
            Self::Rule(v) => &mut v.revision,
            Self::Schedule(v) => &mut v.revision,
            Self::ScheduleOccurrence(v) => &mut v.revision,
        }
    }
    pub fn updated_at_mut(&mut self) -> &mut UtcTimestamp {
        match self {
            Self::Account(v) => &mut v.updated_at,
            Self::FinancialRevision(v) => &mut v.updated_at,
            Self::CategoryGroup(v) => &mut v.updated_at,
            Self::Category(v) => &mut v.updated_at,
            Self::Payee(v) => &mut v.updated_at,
            Self::Transaction(v) => &mut v.updated_at,
            Self::Transfer(v) => &mut v.updated_at,
            Self::Reconciliation(v) => &mut v.updated_at,
            Self::ImportMapping(v) => &mut v.updated_at,
            Self::ImportBatch(v) => &mut v.updated_at,
            Self::ImportFingerprint(v) => &mut v.updated_at,
            Self::Rule(v) => &mut v.updated_at,
            Self::Schedule(v) => &mut v.updated_at,
            Self::ScheduleOccurrence(v) => &mut v.updated_at,
        }
    }
    pub fn deleted_at_mut(&mut self) -> &mut Option<UtcTimestamp> {
        match self {
            Self::Account(v) => &mut v.deleted_at,
            Self::FinancialRevision(v) => &mut v.deleted_at,
            Self::CategoryGroup(v) => &mut v.deleted_at,
            Self::Category(v) => &mut v.deleted_at,
            Self::Payee(v) => &mut v.deleted_at,
            Self::Transaction(v) => &mut v.deleted_at,
            Self::Transfer(v) => &mut v.deleted_at,
            Self::Reconciliation(v) => &mut v.deleted_at,
            Self::ImportMapping(v) => &mut v.deleted_at,
            Self::ImportBatch(v) => &mut v.deleted_at,
            Self::ImportFingerprint(v) => &mut v.deleted_at,
            Self::Rule(v) => &mut v.deleted_at,
            Self::Schedule(v) => &mut v.deleted_at,
            Self::ScheduleOccurrence(v) => &mut v.deleted_at,
        }
    }
    pub fn id(&self) -> &EntityId {
        match self {
            Self::Account(v) => &v.id,
            Self::FinancialRevision(v) => &v.id,
            Self::CategoryGroup(v) => &v.id,
            Self::Category(v) => &v.id,
            Self::Payee(v) => &v.id,
            Self::Transaction(v) => &v.id,
            Self::Transfer(v) => &v.id,
            Self::Reconciliation(v) => &v.id,
            Self::ImportMapping(v) => &v.id,
            Self::ImportBatch(v) => &v.id,
            Self::ImportFingerprint(v) => &v.id,
            Self::Rule(v) => &v.id,
            Self::Schedule(v) => &v.id,
            Self::ScheduleOccurrence(v) => &v.id,
        }
    }
    pub fn space_id(&self) -> &EntityId {
        match self {
            Self::Account(v) => &v.space_id,
            Self::FinancialRevision(v) => &v.space_id,
            Self::CategoryGroup(v) => &v.space_id,
            Self::Category(v) => &v.space_id,
            Self::Payee(v) => &v.space_id,
            Self::Transaction(v) => &v.space_id,
            Self::Transfer(v) => &v.space_id,
            Self::Reconciliation(v) => &v.space_id,
            Self::ImportMapping(v) => &v.space_id,
            Self::ImportBatch(v) => &v.space_id,
            Self::ImportFingerprint(v) => &v.space_id,
            Self::Rule(v) => &v.space_id,
            Self::Schedule(v) => &v.space_id,
            Self::ScheduleOccurrence(v) => &v.space_id,
        }
    }
    pub fn revision(&self) -> StoredRevision {
        match self {
            Self::Account(v) => v.revision,
            Self::FinancialRevision(v) => v.revision,
            Self::CategoryGroup(v) => v.revision,
            Self::Category(v) => v.revision,
            Self::Payee(v) => v.revision,
            Self::Transaction(v) => v.revision,
            Self::Transfer(v) => v.revision,
            Self::Reconciliation(v) => v.revision,
            Self::ImportMapping(v) => v.revision,
            Self::ImportBatch(v) => v.revision,
            Self::ImportFingerprint(v) => v.revision,
            Self::Rule(v) => v.revision,
            Self::Schedule(v) => v.revision,
            Self::ScheduleOccurrence(v) => v.revision,
        }
    }
    pub fn deleted_at(&self) -> &Option<UtcTimestamp> {
        match self {
            Self::Account(v) => &v.deleted_at,
            Self::FinancialRevision(v) => &v.deleted_at,
            Self::CategoryGroup(v) => &v.deleted_at,
            Self::Category(v) => &v.deleted_at,
            Self::Payee(v) => &v.deleted_at,
            Self::Transaction(v) => &v.deleted_at,
            Self::Transfer(v) => &v.deleted_at,
            Self::Reconciliation(v) => &v.deleted_at,
            Self::ImportMapping(v) => &v.deleted_at,
            Self::ImportBatch(v) => &v.deleted_at,
            Self::ImportFingerprint(v) => &v.deleted_at,
            Self::Rule(v) => &v.deleted_at,
            Self::Schedule(v) => &v.deleted_at,
            Self::ScheduleOccurrence(v) => &v.deleted_at,
        }
    }
    pub fn is_live(&self) -> bool {
        self.deleted_at().is_none()
    }
    pub fn from_wire(value: &serde_json::Value) -> CoreResult<Self> {
        serde_json::from_value(value.clone()).map_err(|_| crate::aggregate_schema::INVALID)
    }
}
#[cfg_attr(feature = "contract-schema", derive(schemars::JsonSchema))]
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct SaveCommand {
    pub aggregates: NonEmptyVec<Aggregate>,
}
#[cfg_attr(feature = "contract-schema", derive(schemars::JsonSchema))]
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct AggregateCommand {
    pub aggregate_id: EntityId,
}
#[cfg_attr(feature = "contract-schema", derive(schemars::JsonSchema))]
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct PayeeMerge {
    pub target_id: EntityId,
    pub source_ids: NonEmptyVec<EntityId>,
    pub transaction_ids: Vec<EntityId>,
}
#[cfg_attr(feature = "contract-schema", derive(schemars::JsonSchema))]
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ReconciliationConfirm {
    pub account_id: EntityId,
    pub statement_date: FinanceDate,
    pub statement_balance: MoneyCents,
    pub selected_transaction_ids: NonEmptyVec<EntityId>,
}
#[cfg_attr(feature = "contract-schema", derive(schemars::JsonSchema))]
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ReconciliationUnlock {
    pub reconciliation_id: EntityId,
}
#[cfg_attr(feature = "contract-schema", derive(schemars::JsonSchema))]
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct RuleReorder {
    pub rule_ids: Vec<EntityId>,
}
#[cfg_attr(feature = "contract-schema", derive(schemars::JsonSchema))]
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ImportCommit {
    pub import_id: EntityId,
}
#[cfg_attr(feature = "contract-schema", derive(schemars::JsonSchema))]
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ScheduleConfirm {
    pub schedule_id: EntityId,
    pub due_date: FinanceDate,
    #[serde(
        default,
        deserialize_with = "present",
        skip_serializing_if = "Option::is_none"
    )]
    #[cfg_attr(feature = "contract-schema", schemars(with = "EntityId"))]
    pub imported_transaction_id: Option<EntityId>,
}
#[cfg_attr(feature = "contract-schema", derive(schemars::JsonSchema))]
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ScheduleSkip {
    pub schedule_id: EntityId,
    pub due_date: FinanceDate,
}
#[cfg_attr(feature = "contract-schema", derive(schemars::JsonSchema))]
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "commandType")]
pub enum Command {
    #[serde(rename = "account.save")]
    AccountSave(SaveCommand),
    #[serde(rename = "categoryGroup.save")]
    CategoryGroupSave(SaveCommand),
    #[serde(rename = "category.save")]
    CategorySave(SaveCommand),
    #[serde(rename = "payee.save")]
    PayeeSave(SaveCommand),
    #[serde(rename = "transaction.save")]
    TransactionSave(SaveCommand),
    #[serde(rename = "transfer.save")]
    TransferSave(SaveCommand),
    #[serde(rename = "importMapping.save")]
    ImportMappingSave(SaveCommand),
    #[serde(rename = "importBatch.save")]
    ImportBatchSave(SaveCommand),
    #[serde(rename = "rule.save")]
    RuleSave(SaveCommand),
    #[serde(rename = "schedule.save")]
    ScheduleSave(SaveCommand),
    #[serde(rename = "account.archive")]
    AccountArchive(AggregateCommand),
    #[serde(rename = "category.archive")]
    CategoryArchive(AggregateCommand),
    #[serde(rename = "transaction.delete")]
    TransactionDelete(AggregateCommand),
    #[serde(rename = "transfer.delete")]
    TransferDelete(AggregateCommand),
    #[serde(rename = "rule.delete")]
    RuleDelete(AggregateCommand),
    #[serde(rename = "payee.merge")]
    PayeeMerge(PayeeMerge),
    #[serde(rename = "reconciliation.confirm")]
    ReconciliationConfirm(ReconciliationConfirm),
    #[serde(rename = "reconciliation.unlock")]
    ReconciliationUnlock(ReconciliationUnlock),
    #[serde(rename = "rule.reorder")]
    RuleReorder(RuleReorder),
    #[serde(rename = "import.commit")]
    ImportCommit(ImportCommit),
    #[serde(rename = "schedule.confirm")]
    ScheduleConfirm(ScheduleConfirm),
    #[serde(rename = "schedule.skip")]
    ScheduleSkip(ScheduleSkip),
}
