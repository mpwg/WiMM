// SPDX-License-Identifier: AGPL-3.0-or-later
//! Typisierter AR02-Einstieg; V1 bleibt ein unabhängiger Kompatibilitätsvertrag.
use wimm_finance_core::scalars::EntityId;

pub const BINDING_VERSION: u32 = wimm_finance_types::versions::ENGINE_BINDING_VERSION;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
#[cfg_attr(feature = "contract-schema", derive(schemars::JsonSchema))]
#[cfg_attr(feature = "native", derive(uniffi::Record))]
#[cfg_attr(feature = "wasm", wasm_bindgen::prelude::wasm_bindgen)]
pub struct MoneyRequestV2 {
    #[cfg_attr(feature = "wasm", wasm_bindgen(skip))]
    pub contract_version: u32,
    #[cfg_attr(feature = "wasm", wasm_bindgen(skip))]
    pub domain_schema_version: u32,
    #[cfg_attr(feature = "wasm", wasm_bindgen(skip))]
    #[cfg_attr(feature = "contract-schema", schemars(with = "EntityId"))]
    pub space_id: String,
    #[cfg_attr(feature = "wasm", wasm_bindgen(skip))]
    pub text: String,
}

#[cfg(feature = "wasm")]
#[wasm_bindgen::prelude::wasm_bindgen]
impl MoneyRequestV2 {
    #[wasm_bindgen::prelude::wasm_bindgen(constructor)]
    pub fn new(
        contract_version: f64,
        domain_schema_version: f64,
        space_id: String,
        text: String,
    ) -> Self {
        Self {
            contract_version: exact_version(contract_version),
            domain_schema_version: exact_version(domain_schema_version),
            space_id,
            text,
        }
    }
    #[wasm_bindgen::prelude::wasm_bindgen(getter, js_name = contractVersion)]
    pub fn wasm_contract_version(&self) -> u32 {
        self.contract_version
    }
    #[wasm_bindgen::prelude::wasm_bindgen(getter, js_name = domainSchemaVersion)]
    pub fn wasm_domain_schema_version(&self) -> u32 {
        self.domain_schema_version
    }
    #[wasm_bindgen::prelude::wasm_bindgen(getter, js_name = spaceId)]
    pub fn wasm_space_id(&self) -> String {
        self.space_id.clone()
    }
    #[wasm_bindgen::prelude::wasm_bindgen(getter, js_name = text)]
    pub fn wasm_text(&self) -> String {
        self.text.clone()
    }
}

// WASM darf eine unbekannte Version nicht durch u32-Trunkierung in V2 verwandeln.
#[cfg(feature = "wasm")]
fn exact_version(value: f64) -> u32 {
    if value.is_finite() && value.fract() == 0.0 && (0.0..=u32::MAX as f64).contains(&value) {
        value as u32
    } else {
        0
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
#[cfg_attr(feature = "contract-schema", derive(schemars::JsonSchema))]
#[cfg_attr(feature = "native", derive(uniffi::Enum))]
#[cfg_attr(feature = "wasm", wasm_bindgen::prelude::wasm_bindgen)]
pub enum MoneyStatusV2 {
    Money,
    Rejected,
}

/// Nur Ausgabevertrag: ein Erfolg hat Cent, eine Ablehnung Code/Meldung.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
#[cfg_attr(feature = "contract-schema", derive(schemars::JsonSchema))]
#[cfg_attr(feature = "native", derive(uniffi::Record))]
#[cfg_attr(feature = "wasm", wasm_bindgen::prelude::wasm_bindgen)]
pub struct MoneyResultV2 {
    contract_version: u32,
    status: MoneyStatusV2,
    #[cfg_attr(
        feature = "contract-schema",
        schemars(with = "Option<wimm_finance_types::scalars::MoneyCents>")
    )]
    value: Option<i64>,
    error_code: Option<String>,
    message: Option<String>,
}

impl MoneyResultV2 {
    /// Expliziter V1-Adapter; Finanz-/Bindingversionen werden nicht global geändert.
    pub fn to_v1_json(&self) -> String {
        match self.value {
            Some(value) => serde_json::json!({"contractVersion":1,"status":"money","value":value}),
            None => serde_json::json!({"contractVersion":1,"status":"rejected","error":{"code":self.error_code,"message":self.message}}),
        }.to_string()
    }
    pub fn contract_version(&self) -> u32 {
        self.contract_version
    }
    pub fn status(&self) -> MoneyStatusV2 {
        self.status
    }
    pub fn value(&self) -> Option<i64> {
        self.value
    }
    pub fn error_code(&self) -> Option<String> {
        self.error_code.clone()
    }
    pub fn message(&self) -> Option<String> {
        self.message.clone()
    }
}

#[cfg(feature = "wasm")]
#[wasm_bindgen::prelude::wasm_bindgen]
impl MoneyResultV2 {
    #[wasm_bindgen::prelude::wasm_bindgen(getter, js_name = contractVersion)]
    pub fn wasm_contract_version(&self) -> u32 {
        self.contract_version
    }
    #[wasm_bindgen::prelude::wasm_bindgen(getter, js_name = status)]
    pub fn wasm_status(&self) -> MoneyStatusV2 {
        self.status
    }
    // Exakte Darstellung bereits geprüfter sicherer Cent, keine Geldarithmetik.
    #[wasm_bindgen::prelude::wasm_bindgen(getter, js_name = value)]
    pub fn wasm_value(&self) -> Option<f64> {
        self.value.map(|value| value as f64)
    }
    #[wasm_bindgen::prelude::wasm_bindgen(getter, js_name = errorCode)]
    pub fn wasm_error_code(&self) -> Option<String> {
        self.error_code()
    }
    #[wasm_bindgen::prelude::wasm_bindgen(getter, js_name = message)]
    pub fn wasm_message(&self) -> Option<String> {
        self.message()
    }
}

#[cfg_attr(feature = "native", uniffi::export)]
#[cfg_attr(feature = "wasm", wasm_bindgen::prelude::wasm_bindgen)]
pub fn calculate_money_v2(request: MoneyRequestV2) -> MoneyResultV2 {
    let result = (|| {
        if request.contract_version != BINDING_VERSION || request.domain_schema_version != 1 {
            return Err((
                "UPDATE_REQUIRED",
                "Der Enginevertrag wird nicht unterstützt.",
            ));
        }
        EntityId::new(request.space_id)
            .map_err(|_| ("INVALID_COMMAND", "Der Fachbefehl ist ungültig."))?;
        wimm_finance_core::parse_money(&request.text)
    })();
    match result {
        Ok(value) => MoneyResultV2 {
            contract_version: BINDING_VERSION,
            status: MoneyStatusV2::Money,
            value: Some(value),
            error_code: None,
            message: None,
        },
        Err((code, message)) => MoneyResultV2 {
            contract_version: BINDING_VERSION,
            status: MoneyStatusV2::Rejected,
            value: None,
            error_code: Some(code.into()),
            message: Some(message.into()),
        },
    }
}

#[cfg(feature = "contract-schema")]
pub fn money_schemas() -> Vec<(&'static str, schemars::Schema)> {
    vec![
        (
            "private-v2-money-class-request.schema.json",
            wimm_finance_types::schema::binding_v2(schemars::schema_for!(MoneyRequestV2)),
        ),
        (
            "private-v2-money-class-outcome.schema.json",
            wimm_finance_types::schema::binding_v2(schemars::schema_for!(MoneyResultV2)),
        ),
    ]
}
