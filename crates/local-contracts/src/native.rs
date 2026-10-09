// SPDX-License-Identifier: AGPL-3.0-or-later
//! Lokale Scalarbrands liefern denselben lokalen versionierten Formfehler.
use crate::{errors::LocalContractError, scalars::*};
macro_rules! text {($name:ident)=>{uniffi::custom_type!($name,String,{lower:|v|v.as_str().to_owned(),try_lift:|v|Ok($name::new(v).map_err(|_|LocalContractError::invalid())?)});};}
text!(LocalId);
text!(LocalHash);
macro_rules! integer {($name:ident)=>{uniffi::custom_type!($name,i64,{lower:|v|v.value(),try_lift:|v|Ok($name::new(v).map_err(|_|LocalContractError::invalid())?)});};}
integer!(LocalRevision);
integer!(LocalPositive);
