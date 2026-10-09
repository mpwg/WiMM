// SPDX-License-Identifier: AGPL-3.0-or-later
//! DAL01: dieselbe kleine Persistenzimplementierung nativ und im Browser.
//! Ausschließlich synthetische Datensätze; keine Produkt- oder Finanzengine.
#![forbid(unsafe_code)]

use diesel::connection::SimpleConnection;
use diesel::prelude::*;
use sea_query::{Alias, ColumnDef, Index, SqliteQueryBuilder, Table};
use serde::{Deserialize, Serialize};

diesel::table! { proof_entities (id) { id -> Text, revision -> BigInt, value -> Text, } }
diesel::table! { proof_outbox (id) { id -> Text, entity_id -> Text, } }
diesel::table! { proof_projections (id) { id -> Text, value -> Text, } }
diesel::table! { proof_migrations (number) { number -> Integer, } }
diesel::table! { sqlite_master (name) { name -> Text, #[sql_name = "type"] type_ -> Text, } }
diesel::allow_tables_to_appear_in_same_query!(
    proof_entities,
    proof_outbox,
    proof_projections,
    proof_migrations,
    sqlite_master
);

#[derive(Debug)]
pub enum ProofError {
    Database(diesel::result::Error),
    Conflict,
    Invalid,
    Unsupported,
    Injected,
}
impl From<diesel::result::Error> for ProofError {
    fn from(error: diesel::result::Error) -> Self {
        Self::Database(error)
    }
}
impl ProofError {
    fn code(&self) -> &'static str {
        match self {
            Self::Conflict => "REVISION_CONFLICT",
            Self::Invalid => "INVALID_REQUEST",
            Self::Unsupported => "UPDATE_REQUIRED",
            Self::Injected => "INJECTED_ROLLBACK",
            Self::Database(_) => "WRITE_FAILED",
        }
    }
}

#[derive(
    Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Queryable, Selectable, Insertable,
)]
#[diesel(table_name = proof_entities)]
#[serde(deny_unknown_fields)]
pub struct Entity {
    pub id: String,
    pub revision: i64,
    pub value: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Queryable, Insertable)]
#[diesel(table_name = proof_outbox)]
pub struct Outbox {
    pub id: String,
    pub entity_id: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Queryable, Insertable)]
#[diesel(table_name = proof_projections)]
pub struct Projection {
    pub id: String,
    pub value: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct Snapshot {
    pub entities: Vec<Entity>,
    pub outbox: Vec<Outbox>,
    pub projections: Vec<Projection>,
    pub migrations: Vec<i32>,
}

#[derive(Debug, Deserialize)]
#[serde(tag = "kind", rename_all = "camelCase", deny_unknown_fields)]
pub enum Request {
    Initialize,
    Batch {
        id: String,
        expected: i64,
        value: String,
        fail: bool,
    },
    Snapshot,
    Query {
        value: String,
    },
    Migrate {
        expected: i32,
        fail: bool,
    },
}

pub struct ProofDb {
    connection: SqliteConnection,
}
impl ProofDb {
    pub fn open(path: &str) -> Result<Self, String> {
        let mut connection =
            SqliteConnection::establish(path).map_err(|_| "OPEN_FAILED".to_owned())?;
        // Technische SQL-Ausnahme: Diesel besitzt keine Query-DSL für diese
        // verbindungsbezogenen SQLite-Einstellungen; keine Eingabewerte/SQLtexte.
        connection
            .batch_execute(
                "PRAGMA busy_timeout=3000; PRAGMA foreign_keys=ON; PRAGMA synchronous=FULL;",
            )
            .map_err(|_| "OPEN_FAILED".to_owned())?;
        Ok(Self { connection })
    }

    pub fn initialize(&mut self) -> Result<(), ProofError> {
        self.connection.immediate_transaction(|conn| {
            // Katalogabfrage ebenfalls über Diesel; Öffnen migriert nichts.
            let exists: i64 = sqlite_master::table
                .filter(sqlite_master::name.eq("proof_migrations"))
                .count()
                .get_result(conn)?;
            if exists != 0 {
                return supported(conn);
            }
            for (name, fields) in [
                (
                    "proof_entities",
                    vec![
                        ("id", true, false),
                        ("revision", false, true),
                        ("value", false, false),
                    ],
                ),
                (
                    "proof_outbox",
                    vec![("id", true, false), ("entity_id", false, false)],
                ),
                (
                    "proof_projections",
                    vec![("id", true, false), ("value", false, false)],
                ),
            ] {
                let mut table = Table::create();
                table.table(Alias::new(name));
                for (field, primary, integer) in fields {
                    let mut column = ColumnDef::new(Alias::new(field));
                    if integer {
                        column.big_integer();
                    } else {
                        column.text();
                    }
                    column.not_null();
                    if primary {
                        column.primary_key();
                    }
                    table.col(column);
                }
                conn.batch_execute(&table.to_string(SqliteQueryBuilder))?;
            }
            let sql = Table::create()
                .table(Alias::new("proof_migrations"))
                .col(
                    ColumnDef::new(Alias::new("number"))
                        .integer()
                        .not_null()
                        .primary_key(),
                )
                .to_string(SqliteQueryBuilder);
            conn.batch_execute(&sql)?;
            diesel::insert_into(proof_migrations::table)
                .values(proof_migrations::number.eq(1))
                .execute(conn)?;
            Ok(())
        })
    }

    pub fn batch(
        &mut self,
        id: &str,
        expected: i64,
        value: &str,
        fail: bool,
    ) -> Result<(), ProofError> {
        if id.is_empty()
            || id.len() > 100
            || value.len() > 1000
            || !(0..9_007_199_254_740_991).contains(&expected)
        {
            return Err(ProofError::Invalid);
        }
        self.connection.immediate_transaction(|conn| {
            supported(conn)?;
            let previous: Option<i64> = proof_entities::table
                .find(id)
                .select(proof_entities::revision)
                .first(conn)
                .optional()?;
            if previous.unwrap_or(0) != expected {
                return Err(ProofError::Conflict);
            }
            let entity = Entity {
                id: id.into(),
                revision: expected + 1,
                value: value.into(),
            };
            diesel::insert_into(proof_entities::table)
                .values(&entity)
                .on_conflict(proof_entities::id)
                .do_update()
                .set((
                    proof_entities::revision.eq(entity.revision),
                    proof_entities::value.eq(&entity.value),
                ))
                .execute(conn)?;
            if fail {
                return Err(ProofError::Injected);
            }
            let operation = Outbox {
                id: format!("{id}:{}", expected + 1),
                entity_id: id.into(),
            };
            diesel::insert_into(proof_outbox::table)
                .values(&operation)
                .execute(conn)?;
            let projection = Projection {
                id: id.into(),
                value: value.into(),
            };
            diesel::insert_into(proof_projections::table)
                .values(&projection)
                .on_conflict(proof_projections::id)
                .do_update()
                .set(proof_projections::value.eq(value))
                .execute(conn)?;
            Ok(())
        })
    }

    pub fn migrate(&mut self, expected: i32, fail: bool) -> Result<(), ProofError> {
        self.connection.immediate_transaction(|conn| {
            supported(conn)?;
            let numbers: Vec<i32> = proof_migrations::table
                .select(proof_migrations::number)
                .order(proof_migrations::number)
                .load(conn)?;
            if numbers.last().copied() != Some(expected) {
                return Err(ProofError::Conflict);
            }
            if expected != 1 {
                return Err(ProofError::Unsupported);
            }
            let sql = Index::create()
                .name("proof_entities_by_value")
                .table(Alias::new("proof_entities"))
                .col(Alias::new("value"))
                .col(Alias::new("id"))
                .to_string(SqliteQueryBuilder);
            conn.batch_execute(&sql)?;
            diesel::insert_into(proof_migrations::table)
                .values(proof_migrations::number.eq(2))
                .execute(conn)?;
            if fail {
                return Err(ProofError::Injected);
            }
            Ok(())
        })
    }

    pub fn snapshot(&mut self) -> Result<Snapshot, ProofError> {
        self.connection.transaction(|conn| {
            supported(conn)?;
            Ok(Snapshot {
                entities: proof_entities::table.order(proof_entities::id).load(conn)?,
                outbox: proof_outbox::table.order(proof_outbox::id).load(conn)?,
                projections: proof_projections::table
                    .order(proof_projections::id)
                    .load(conn)?,
                migrations: proof_migrations::table
                    .select(proof_migrations::number)
                    .order(proof_migrations::number)
                    .load(conn)?,
            })
        })
    }

    pub fn query(&mut self, value: &str) -> Result<Vec<Entity>, ProofError> {
        supported(&mut self.connection)?;
        Ok(proof_entities::table
            .filter(proof_entities::value.eq(value))
            .order(proof_entities::id)
            .limit(20)
            .load(&mut self.connection)?)
    }

    pub fn request(&mut self, json: &str) -> String {
        let result: Result<serde_json::Value, ProofError> = (|| {
            let request: Request = serde_json::from_str(json).map_err(|_| ProofError::Invalid)?;
            match request {
                Request::Initialize => {
                    self.initialize()?;
                    Ok(serde_json::json!({"status":"initialized"}))
                }
                Request::Batch {
                    id,
                    expected,
                    value,
                    fail,
                } => {
                    self.batch(&id, expected, &value, fail)?;
                    Ok(serde_json::json!({"status":"committed"}))
                }
                Request::Migrate { expected, fail } => {
                    self.migrate(expected, fail)?;
                    Ok(serde_json::json!({"status":"migrated"}))
                }
                Request::Snapshot => {
                    serde_json::to_value(self.snapshot()?).map_err(|_| ProofError::Invalid)
                }
                Request::Query { value } => {
                    serde_json::to_value(self.query(&value)?).map_err(|_| ProofError::Invalid)
                }
            }
        })();
        match result {
            Ok(value) => serde_json::json!({"ok":true,"value":value}),
            Err(error) => serde_json::json!({"ok":false,"code":error.code()}),
        }
        .to_string()
    }
}

fn supported(conn: &mut SqliteConnection) -> Result<(), ProofError> {
    let numbers: Vec<i32> = proof_migrations::table
        .select(proof_migrations::number)
        .order(proof_migrations::number)
        .load(conn)?;
    if numbers == [1] || numbers == [1, 2] {
        Ok(())
    } else {
        Err(ProofError::Unsupported)
    }
}

#[cfg(target_family = "wasm")]
mod browser {
    use super::ProofDb;
    use std::cell::RefCell;
    use wasm_bindgen::prelude::*;
    thread_local! { static DB: RefCell<Option<ProofDb>> = const { RefCell::new(None) }; }

    #[wasm_bindgen]
    pub async fn open_proof(scope: String) -> Result<(), JsValue> {
        if scope.is_empty()
            || scope.len() > 64
            || !scope
                .bytes()
                .all(|c| c.is_ascii_alphanumeric() || c == b'-')
        {
            return Err(JsValue::from_str("INVALID_SCOPE"));
        }
        let options = sqlite_wasm_vfs::sahpool::OpfsSAHPoolCfgBuilder::new()
            .directory(&format!("wimm-dal-proof-{scope}"))
            .build();
        sqlite_wasm_vfs::sahpool::install::<sqlite_wasm_rs::WasmOsCallback>(&options, false)
            .await
            .map_err(|_| JsValue::from_str("OPFS_UNAVAILABLE"))?;
        let db = ProofDb::open("file:wimm-dal-proof.db?vfs=opfs-sahpool")
            .map_err(|e| JsValue::from_str(&e))?;
        DB.with(|slot| *slot.borrow_mut() = Some(db));
        Ok(())
    }

    #[wasm_bindgen]
    pub fn proof_request(request: &str) -> Result<String, JsValue> {
        DB.with(|slot| slot.borrow_mut().as_mut().map(|db| db.request(request)))
            .ok_or_else(|| JsValue::from_str("NOT_OPEN"))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn native_batch_cas_and_rollback() {
        let mut db = ProofDb::open(":memory:").unwrap();
        db.initialize().unwrap();
        db.batch("alpha", 0, "eins", false).unwrap();
        let before = db.snapshot().unwrap();
        assert!(matches!(
            db.batch("alpha", 0, "veraltet", false),
            Err(ProofError::Conflict)
        ));
        assert!(matches!(
            db.batch("alpha", 1, "teilweise", true),
            Err(ProofError::Injected)
        ));
        assert_eq!(db.snapshot().unwrap(), before);
        assert_eq!(db.query("eins").unwrap(), before.entities);
    }
    #[test]
    fn native_explicit_dsl_migration_and_rollback() {
        let mut db = ProofDb::open(":memory:").unwrap();
        db.initialize().unwrap();
        db.batch("alpha", 0, "erhalten", false).unwrap();
        let before = db.snapshot().unwrap();
        assert!(matches!(db.migrate(1, true), Err(ProofError::Injected)));
        assert_eq!(db.snapshot().unwrap(), before);
        assert_eq!(
            sqlite_master::table
                .filter(sqlite_master::name.eq("proof_entities_by_value"))
                .count()
                .get_result::<i64>(&mut db.connection)
                .unwrap(),
            0
        );
        db.migrate(1, false).unwrap();
        assert_eq!(db.snapshot().unwrap().entities, before.entities);
        assert_eq!(db.snapshot().unwrap().migrations, [1, 2]);
        assert!(matches!(db.migrate(1, false), Err(ProofError::Conflict)));
        assert!(matches!(db.migrate(2, false), Err(ProofError::Unsupported)));
    }
    #[test]
    fn native_open_does_not_initialize_or_migrate() {
        let mut db = ProofDb::open(":memory:").unwrap();
        assert!(db.snapshot().is_err());
        db.initialize().unwrap();
        assert_eq!(db.snapshot().unwrap().migrations, [1]);
        assert!(matches!(
            db.batch("alpha", -1, "ungültig", false),
            Err(ProofError::Invalid)
        ));
    }
}
