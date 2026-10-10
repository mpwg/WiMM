// SPDX-License-Identifier: AGPL-3.0-or-later
//! Begrenzte bestehende Sekundärreferenzabfragen; keine Finanzberechnung oder SQL.
use crate::persistence_errors::StorageFailure;
use crate::storage::*;
use crate::{Validate, record};
use wimm_finance_types::scalars::{EntityId, FinanceDate, present};
#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
#[cfg_attr(feature = "contract-schema", derive(schemars::JsonSchema))]
#[cfg_attr(feature = "native-bindings", derive(uniffi::Enum))]
#[cfg_attr(feature = "wasm-bindings", derive(tsify::Tsify))]
pub enum ReferenceKind {
    Account,
    Category,
    Import,
}
record!(TransactionCursor {
    date: FinanceDate,
    handle: EntityId
});
impl Validate for TransactionCursor {
    fn validate(&self) -> Result<(), &'static str> {
        Ok(())
    }
}
record!(TransactionIndexQuery{space_id:EntityId,kind:ReferenceKind,reference:String,
 #[serde(default,deserialize_with="present",skip_serializing_if="Option::is_none")]
 #[cfg_attr(feature="contract-schema",schemars(with="FinanceDate"))]from_date:Option<FinanceDate>,
 #[serde(default,deserialize_with="present",skip_serializing_if="Option::is_none")]
 #[cfg_attr(feature="contract-schema",schemars(with="FinanceDate"))]through_date:Option<FinanceDate>,
 #[serde(default,deserialize_with="present",skip_serializing_if="Option::is_none")]
 #[cfg_attr(feature="contract-schema",schemars(with="TransactionCursor"))]after:Option<TransactionCursor>,
 #[cfg_attr(feature="contract-schema",schemars(range(min=1,max=1000)))]#[serde(deserialize_with="wimm_contract_primitives::unsigned32")]limit:u32});
impl Validate for TransactionIndexQuery {
    fn validate(&self) -> Result<(), &'static str> {
        if !(1..=1000).contains(&self.limit)
            || self.reference.is_empty()
            || self.kind != ReferenceKind::Import && EntityId::new(self.reference.clone()).is_err()
            || matches!((&self.from_date,&self.through_date),(Some(a),Some(b)) if a.as_str()>b.as_str())
        {
            Err("Ungültige begrenzte Indexabfrage.")
        } else {
            Ok(())
        }
    }
}
record!(PendingIndexQuery {
    space_id: EntityId,
    state: PendingState,
    #[cfg_attr(feature = "contract-schema", schemars(range(min = 1, max = 1000)))]
    #[serde(deserialize_with = "wimm_contract_primitives::unsigned32")]
    limit: u32
});
impl Validate for PendingIndexQuery {
    fn validate(&self) -> Result<(), &'static str> {
        if (1..=1000).contains(&self.limit) {
            Ok(())
        } else {
            Err("Ungültige Seitengrenze.")
        }
    }
}
record!(ImportSourceQuery {
    space_id: EntityId,
    account_id: EntityId,
    parser_source: String,
    external_id: String,
    #[cfg_attr(feature = "contract-schema", schemars(range(min = 1, max = 1000)))]
    #[serde(deserialize_with = "wimm_contract_primitives::unsigned32")]
    limit: u32
});
impl Validate for ImportSourceQuery {
    fn validate(&self) -> Result<(), &'static str> {
        if (1..=1000).contains(&self.limit)
            && !self.parser_source.is_empty()
            && !self.external_id.is_empty()
        {
            Ok(())
        } else {
            Err("Ungültige Importquellabfrage.")
        }
    }
}
pub trait LocalIndexQueryPort {
    fn query_transactions(
        &self,
        query: TransactionIndexQuery,
    ) -> Result<Vec<StoredAggregate>, StorageFailure>;
    fn query_pending(
        &self,
        query: PendingIndexQuery,
    ) -> Result<Vec<PendingOperation>, StorageFailure>;
    fn query_imported(
        &self,
        query: ImportSourceQuery,
    ) -> Result<Vec<StoredAggregate>, StorageFailure>;
}
