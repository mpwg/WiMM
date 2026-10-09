// SPDX-License-Identifier: AGPL-3.0-or-later
//! Geschützte öffentliche Skalare für tatsächliche UniFFI-Records.
use crate::{errors::PublicContractError, scalars::*};
macro_rules! string {
    ($name:ident) => {uniffi::custom_type!($name,String,{lower:|v|v.as_str().to_owned(),try_lift:|v|Ok($name::new(v).map_err(public_form_error)?)});};
}
fn public_form_error(_: &'static str) -> PublicContractError {
    PublicContractError::invalid()
}
string!(PublicId);
string!(Base64Url);
string!(NonEmptyString);
macro_rules! revision {($name:ident)=>{uniffi::custom_type!($name,i64,{lower:|v|v.value(),try_lift:|v|Ok($name::new(v).map_err(public_form_error)?)});};}
revision!(PublicRevision);
revision!(PositiveRevision);
uniffi::custom_type!(ProtocolVersion,u32,{lower:|v|v.value(),try_lift:|v|Ok(ProtocolVersion::new(v).map_err(|_|PublicContractError::update_required())?)});
