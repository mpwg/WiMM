// SPDX-License-Identifier: AGPL-3.0-or-later
//! Admissibilität unverändert vor Standard-JSON; Traversierung im JS-Realm vermeidet Feld-für-Feld-FFI.
use wasm_bindgen::prelude::*;
#[wasm_bindgen(module = "/js/data.js")]
extern "C" {
    #[wasm_bindgen(catch,js_name=checkData)]
    fn check_data(value: &JsValue) -> Result<bool, JsValue>;
}
pub fn check(value: &JsValue) -> bool {
    check_data(value).unwrap_or(false)
}
