//! Internal worker bindings. Applications consume the typed browser package.
#[cfg(target_arch = "wasm32")]
mod browser {
    use libwimm::{AccountInput, BookingInput, Error, Uuid, WiMM};
    use serde::Deserialize;
    use sqlite_wasm_vfs::sahpool::{OpfsSAHPoolCfgBuilder, OpfsSAHPoolUtil, install};
    use wasm_bindgen::prelude::*;

    #[derive(Deserialize)]
    #[serde(
        tag = "method",
        content = "params",
        rename_all = "snake_case",
        deny_unknown_fields
    )]
    enum Command {
        CreateAccount(AccountInput),
        GetAccount {
            id: Uuid,
        },
        ListAccounts,
        UpdateAccount {
            id: Uuid,
            input: AccountInput,
        },
        DeleteAccount {
            id: Uuid,
        },
        CreateBooking {
            account_id: Uuid,
            input: BookingInput,
        },
        GetBooking {
            account_id: Uuid,
            id: Uuid,
        },
        ListBookings {
            account_id: Uuid,
        },
        UpdateBooking {
            account_id: Uuid,
            id: Uuid,
            input: BookingInput,
        },
        DeleteBooking {
            account_id: Uuid,
            id: Uuid,
        },
        ExportJson,
        ReplaceFromJson {
            json: String,
        },
        CurrencyMinorUnits {
            code: String,
        },
    }

    fn js_error(error: Error) -> JsValue {
        JsValue::from_str(&serde_json::to_string(&error).expect("error is serializable"))
    }

    #[wasm_bindgen]
    pub struct BrowserCore {
        core: Option<WiMM>,
        pool: OpfsSAHPoolUtil,
    }

    #[wasm_bindgen]
    impl BrowserCore {
        pub async fn open(name: &str) -> std::result::Result<BrowserCore, JsValue> {
            if name.is_empty()
                || name.len() > 64
                || !name
                    .bytes()
                    .all(|b| b.is_ascii_alphanumeric() || b == b'-' || b == b'_')
            {
                return Err(js_error(Error::Validation(
                    "database name must contain 1–64 ASCII letters, digits, '-' or '_'".into(),
                )));
            }
            let config = OpfsSAHPoolCfgBuilder::new()
                .directory(&format!(".libwimm-{name}"))
                .build();
            let pool = install::<sqlite_wasm_rs::WasmOsCallback>(&config, true)
                .await
                .map_err(|e| {
                    js_error(Error::Storage(format!("OPFS initialization failed: {e}")))
                })?;
            match WiMM::open("wimm.sqlite3") {
                Ok(core) => Ok(Self {
                    core: Some(core),
                    pool,
                }),
                Err(error) => {
                    let _ = pool.pause();
                    Err(js_error(error))
                }
            }
        }

        pub fn close(&mut self) -> std::result::Result<(), JsValue> {
            self.core.take();
            self.pool
                .pause()
                .map_err(|e| js_error(Error::Storage(e.to_string())))
        }

        pub fn invoke(&mut self, json: &str) -> std::result::Result<String, JsValue> {
            self.dispatch(json).map_err(js_error)
        }
    }

    impl BrowserCore {
        fn dispatch(&mut self, json: &str) -> libwimm::Result<String> {
            let command: Command =
                serde_json::from_str(json).map_err(|e| Error::Validation(e.to_string()))?;
            let core = self
                .core
                .as_mut()
                .ok_or_else(|| Error::Storage("database is closed".into()))?;
            macro_rules! encode {
                ($expression:expr) => {
                    serde_json::to_string(&$expression?).map_err(|e| Error::Storage(e.to_string()))
                };
            }
            match command {
                Command::CreateAccount(input) => encode!(core.create_account(input)),
                Command::GetAccount { id } => encode!(core.get_account(id)),
                Command::ListAccounts => encode!(core.list_accounts()),
                Command::UpdateAccount { id, input } => encode!(core.update_account(id, input)),
                Command::DeleteAccount { id } => encode!(core.delete_account(id)),
                Command::CreateBooking { account_id, input } => {
                    encode!(core.create_booking(account_id, input))
                }
                Command::GetBooking { account_id, id } => encode!(core.get_booking(account_id, id)),
                Command::ListBookings { account_id } => encode!(core.list_bookings(account_id)),
                Command::UpdateBooking {
                    account_id,
                    id,
                    input,
                } => encode!(core.update_booking(account_id, id, input)),
                Command::DeleteBooking { account_id, id } => {
                    encode!(core.delete_booking(account_id, id))
                }
                Command::ExportJson => encode!(core.export_json()),
                Command::ReplaceFromJson { json } => encode!(core.replace_from_json(&json)),
                Command::CurrencyMinorUnits { code } => {
                    encode!(libwimm::currency_minor_units(&code))
                }
            }
        }
    }
}
