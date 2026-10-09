// SPDX-License-Identifier: AGPL-3.0-or-later
//! Admissibilität von JS-Daten vor Standard-JSON: keine stillen NaN-/Objektkonvertierungen.
use wasm_bindgen::JsValue;
pub fn check(value: &JsValue) -> bool {
    walk(value, false, &mut Vec::new()).is_ok()
}
fn walk(value: &JsValue, strict: bool, stack: &mut Vec<JsValue>) -> Result<(), ()> {
    if value.is_null() || value.as_bool().is_some() || value.as_string().is_some() {
        return Ok(());
    }
    if value.is_undefined() {
        return if strict { Err(()) } else { Ok(()) };
    }
    if let Some(number) = value.as_f64() {
        return if number.is_finite() { Ok(()) } else { Err(()) };
    }
    if !value.is_object() || value.is_function() || stack.iter().any(|v| v == value) {
        return Err(());
    }
    if stack.len() >= 128 {
        return Err(());
    }
    stack.push(value.clone());
    if js_sys::Array::is_array(value) {
        for child in js_sys::Array::from(value).iter() {
            walk(&child, true, stack)?;
        }
    } else {
        let object = js_sys::Object::from(value.clone());
        let proto = js_sys::Reflect::get_prototype_of(&object).map_err(|_| ())?;
        let plain = js_sys::Reflect::get_prototype_of(&js_sys::Object::new()).map_err(|_| ())?;
        if !proto.is_null() && proto != plain {
            return Err(());
        }
        for key in js_sys::Reflect::own_keys(&object).map_err(|_| ())?.iter() {
            let name = key.as_string().ok_or(())?;
            let child = js_sys::Reflect::get(value, &key).map_err(|_| ())?;
            walk(
                &child,
                strict || ["draft", "mapping", "profile"].contains(&name.as_str()),
                stack,
            )?;
        }
    }
    stack.pop();
    Ok(())
}
