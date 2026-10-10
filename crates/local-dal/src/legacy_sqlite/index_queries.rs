// SPDX-License-Identifier: AGPL-3.0-or-later
//! Begrenzte ORM-Abfragen auf registrierten Bestandsindizes; kein Scan-/Backendfallback.
use super::*;
use diesel::{
    dsl::sql,
    sql_types::{Bool, Nullable, Text},
};
use wimm_local_contracts::{Validate, commit::SnapshotValidationPort, index_ports::*};
diesel::define_sql_function! { #[sql_name="json_extract"] fn json_text(payload:Text,path:Text)->Nullable<Text>; }
diesel::table! { transaction_categories (profile_id,handle,category_id) { profile_id -> Text,handle -> Text,space_id -> Text,category_id -> Text,date -> Text, } }
diesel::allow_tables_to_appear_in_same_query!(transaction_categories, aggregates);
fn path(name: &'static str) -> diesel::expression::SqlLiteral<Text> {
    sql::<Text>(name)
}
fn required(c: &mut SqliteConnection) -> Result<(), ReadError> {
    if supported(c)? != 2 {
        return Err(StorageFailure::not_committed(StorageFailureCode::UpdateRequired).into());
    }
    Ok(())
}
fn invalid_query() -> StorageFailure {
    StorageFailure::not_committed(StorageFailureCode::WriteFailed)
}
impl<V: SnapshotValidationPort> LocalIndexQueryPort for writer::LegacySqliteWriter<V> {
    fn query_transactions(
        &self,
        q: TransactionIndexQuery,
    ) -> Result<Vec<StoredAggregate>, StorageFailure> {
        q.validate().map_err(|_| invalid_query())?;
        self.store
            .connection
            .borrow_mut()
            .transaction::<_, ReadError, _>(|c| {
                required(c)?;
                let p = self.store.profile.as_str();
                let space = q.space_id.as_str();
                let date = json_text(aggregates::payload, path("'$.date'"));
                let live = json_text(aggregates::payload, path("'$.deletedAt'"));
                let kind = json_text(aggregates::payload, path("'$.aggregateType'"));
                let columns = (
                    aggregates::handle,
                    aggregates::space_id,
                    aggregates::revision,
                    aggregates::payload,
                );
                let rows: Vec<(String, String, i64, String)> = if q.kind == ReferenceKind::Category
                {
                    let mut select = transaction_categories::table
                        .inner_join(
                            aggregates::table.on(aggregates::profile_id
                                .eq(transaction_categories::profile_id)
                                .and(aggregates::handle.eq(transaction_categories::handle))),
                        )
                        .filter(transaction_categories::profile_id.eq(p))
                        .filter(transaction_categories::space_id.eq(space))
                        .filter(transaction_categories::category_id.eq(&q.reference))
                        .filter(aggregates::space_id.eq(space))
                        .filter(kind.eq(path("'transaction'").nullable()))
                        .filter(live.is_null())
                        .filter(
                            transaction_categories::date.ge(q
                                .from_date
                                .as_ref()
                                .map(|v| v.as_str())
                                .unwrap_or("")),
                        )
                        .filter(
                            transaction_categories::date.le(q
                                .through_date
                                .as_ref()
                                .map(|v| v.as_str())
                                .unwrap_or("9999-12-31")),
                        )
                        .order((transaction_categories::date, transaction_categories::handle))
                        .limit(i64::from(q.limit))
                        .select(columns)
                        .into_boxed();
                    if let Some(after) = &q.after {
                        select = select.filter(
                            sql::<Bool>(
                                "(transaction_categories.date,transaction_categories.handle) > (",
                            )
                            .bind::<Text, _>(after.date.as_str())
                            .sql(",")
                            .bind::<Text, _>(after.handle.as_str())
                            .sql(")"),
                        );
                    }
                    #[cfg(feature = "receipt-probe")]
                    record_plan(c, &select, &self.query_plans)?;
                    select.load(c)?
                } else {
                    let reference_path = if q.kind == ReferenceKind::Account {
                        "'$.accountId'"
                    } else {
                        "'$.importReference'"
                    };
                    let mut select = aggregates::table
                        .filter(aggregates::profile_id.eq(p))
                        .filter(aggregates::space_id.eq(space))
                        .filter(kind.eq(path("'transaction'").nullable()))
                        .filter(live.is_null())
                        .filter(
                            json_text(aggregates::payload, path(reference_path)).eq(&q.reference),
                        )
                        .filter(
                            date.clone()
                                .ge(q.from_date.as_ref().map(|v| v.as_str()).unwrap_or("")),
                        )
                        .filter(
                            date.clone().le(q
                                .through_date
                                .as_ref()
                                .map(|v| v.as_str())
                                .unwrap_or("9999-12-31")),
                        )
                        .order((date, aggregates::handle))
                        .limit(i64::from(q.limit))
                        .select(columns)
                        .into_boxed();
                    if let Some(after) = &q.after {
                        select = select.filter(
                            sql::<Bool>(
                                "(json_extract(aggregates.payload,'$.date'),aggregates.handle) > (",
                            )
                            .bind::<Text, _>(after.date.as_str())
                            .sql(",")
                            .bind::<Text, _>(after.handle.as_str())
                            .sql(")"),
                        );
                    }
                    #[cfg(feature = "receipt-probe")]
                    record_plan(c, &select, &self.query_plans)?;
                    select.load(c)?
                };
                rows.into_iter()
                    .map(aggregate)
                    .collect::<Result<_, _>>()
                    .map_err(Into::into)
            })
            .map_err(|e| e.0)
    }
    fn query_pending(&self, q: PendingIndexQuery) -> Result<Vec<PendingOperation>, StorageFailure> {
        q.validate().map_err(|_| invalid_query())?;
        self.store.connection.borrow_mut().transaction::<_,ReadError,_>(|c| {
            required(c)?;let state=serde_json::to_value(q.state).map_err(|_|invalid())?;let state=state.as_str().ok_or_else(invalid)?;
            // Fester CASE-Ausdruck ist exakt der registrierte Legacyindex; keine freie SQL-Eingabe.
            let created=sql::<Text>("CASE WHEN json_type(payload,'$.createdAt')='text' THEN json_extract(payload,'$.createdAt') WHEN json_type(payload,'$.draft.occurredAt')='text' THEN json_extract(payload,'$.draft.occurredAt') ELSE '' END");
            let select=outbox::table.filter(outbox::profile_id.eq(self.store.profile.as_str())).filter(outbox::space_id.eq(q.space_id.as_str())).filter(outbox::state.eq(state))
                .order((created,outbox::operation_id)).limit(i64::from(q.limit)).select((outbox::operation_id,outbox::state,outbox::payload));
            #[cfg(feature="receipt-probe")]
            record_plan(c,&select,&self.query_plans)?;
            let rows:Vec<(String,String,String)>=select.load(c)?;
            rows.into_iter().map(|(id,state,value)| {
                let row:PendingOperation=decode(&value)?;
                let actual=serde_json::to_value(row.state).map_err(|_|invalid())?;
                if row.operation_id.as_str()!=id || row.space_id!=q.space_id || actual.as_str()!=Some(state.as_str()) {return Err(invalid().into());}Ok(row)
            }).collect()
        }).map_err(|e|e.0)
    }
    fn query_imported(&self, q: ImportSourceQuery) -> Result<Vec<StoredAggregate>, StorageFailure> {
        q.validate().map_err(|_| invalid_query())?;
        self.store
            .connection
            .borrow_mut()
            .transaction::<_, ReadError, _>(|c| {
                required(c)?;
                let p = self.store.profile.as_str();
                let space = q.space_id.as_str();
                let source = diesel::alias!(super::aggregates as fingerprints);
                let fingerprint_ids = source
                    .filter(source.field(aggregates::profile_id).eq(p))
                    .filter(source.field(aggregates::space_id).eq(space))
                    .filter(
                        json_text(source.field(aggregates::payload), path("'$.aggregateType'"))
                            .eq(path("'importFingerprint'").nullable()),
                    )
                    .filter(
                        json_text(source.field(aggregates::payload), path("'$.deletedAt'"))
                            .is_null(),
                    )
                    .filter(
                        json_text(source.field(aggregates::payload), path("'$.accountId'"))
                            .eq(q.account_id.as_str()),
                    )
                    .filter(
                        json_text(source.field(aggregates::payload), path("'$.parserSource'"))
                            .eq(&q.parser_source),
                    )
                    .filter(
                        json_text(source.field(aggregates::payload), path("'$.externalId'"))
                            .eq(&q.external_id),
                    )
                    .select(
                        json_text(source.field(aggregates::payload), path("'$.transactionId'"))
                            .assume_not_null(),
                    )
                    .distinct();
                let select = aggregates::table
                    .filter(aggregates::profile_id.eq(p))
                    .filter(aggregates::space_id.eq(space))
                    .filter(aggregates::handle.eq_any(fingerprint_ids))
                    .filter(
                        json_text(aggregates::payload, path("'$.aggregateType'"))
                            .eq(path("'transaction'").nullable()),
                    )
                    .filter(json_text(aggregates::payload, path("'$.deletedAt'")).is_null())
                    .order((
                        json_text(aggregates::payload, path("'$.date'")),
                        aggregates::handle,
                    ))
                    .limit(i64::from(q.limit))
                    .select((
                        aggregates::handle,
                        aggregates::space_id,
                        aggregates::revision,
                        aggregates::payload,
                    ));
                #[cfg(feature = "receipt-probe")]
                record_plan(c, &select, &self.query_plans)?;
                let rows: Vec<(String, String, i64, String)> = select.load(c)?;
                rows.into_iter()
                    .map(aggregate)
                    .collect::<Result<_, _>>()
                    .map_err(Into::into)
            })
            .map_err(|e| e.0)
    }
}

#[cfg(feature = "receipt-probe")]
fn record_plan<Q: diesel::query_builder::QueryFragment<diesel::sqlite::Sqlite>>(
    c: &mut SqliteConnection,
    q: &Q,
    plans: &RefCell<Vec<String>>,
) -> Result<(), ReadError> {
    use diesel::{
        query_builder::{AstPass, Query, QueryFragment, QueryId},
        sql_types::Integer,
        sqlite::Sqlite,
    };
    struct Explain<'a, Q>(&'a Q);
    impl<Q> QueryId for Explain<'_, Q> {
        type QueryId = ();
        const HAS_STATIC_QUERY_ID: bool = false;
    }
    impl<Q> Query for Explain<'_, Q> {
        type SqlType = (Integer, Integer, Integer, Text);
    }
    impl<Q: QueryFragment<Sqlite>> QueryFragment<Sqlite> for Explain<'_, Q> {
        fn walk_ast<'b>(&'b self, mut out: AstPass<'_, 'b, Sqlite>) -> diesel::QueryResult<()> {
            out.push_sql("EXPLAIN QUERY PLAN ");
            self.0.walk_ast(out.reborrow())
        }
    }
    impl<Q> RunQueryDsl<SqliteConnection> for Explain<'_, Q> {}
    let rows = Explain(q).load::<(i32, i32, i32, String)>(c)?;
    plans
        .borrow_mut()
        .extend(rows.into_iter().map(|(_, _, _, detail)| detail));
    Ok(())
}
