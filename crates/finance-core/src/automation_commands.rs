// SPDX-License-Identifier: AGPL-3.0-or-later
//! JSON-Grenze für typisierte Automatisierungsbefehle.
use crate::{
    CoreResult,
    command_contracts::{COMMAND_ERROR, Request},
};
use serde_json::Value;
pub fn execute(decoded: Value) -> CoreResult<Value> {
    let request: Request = serde_json::from_value(decoded).map_err(|_| COMMAND_ERROR)?;
    crate::typed_automation_commands::execute(request)?.to_wire()
}
