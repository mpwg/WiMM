// SPDX-License-Identifier: AGPL-3.0-or-later
//! JSON-Grenze für typisierte Buchungsbefehle.
use crate::{
    CoreResult,
    command_contracts::{self, COMMAND_ERROR, Request},
};
use serde_json::Value;
pub fn execute(decoded: Value) -> CoreResult<Value> {
    let request: Request = serde_json::from_value(decoded).map_err(|_| COMMAND_ERROR)?;
    command_contracts::to_wire(crate::typed_financial::execute(request)?)
}
