// SPDX-License-Identifier: AGPL-3.0-or-later
//! Ausschließlich öffentliche Serverportdaten; keine ORM-Entities/Finanzpayloads.
use crate::{FormResult, Validate, envelopes::EncryptedOperation, record, scalars::*};
macro_rules! plain {($name:ident {$($field:ident:$ty:ty),*$(,)?})=>{record!($name{$($field:$ty),*});impl Validate for $name{fn validate(&self)->FormResult<()>{Ok(())}}};}
plain!(OpaqueAggregateHead {
    handle: PublicId,
    revision: PublicRevision,
    ciphertext_hash: Base64Url
});
plain!(ServerOperationKey {
    space_id: PublicId,
    epoch: PublicId,
    operation_id: PublicId
});
plain!(OperationReceiptRecord {
    key: ServerOperationKey,
    content_hash: Base64Url,
    cursor: String
});
plain!(EncryptedSnapshotRecord {space_id:PublicId,epoch:PublicId,cursor:String,ciphertext_hash:Base64Url,bytes:Vec<u8>});
plain!(EncryptedChangeRecord {
    cursor: String,
    operation: EncryptedOperation
});
plain!(PublicIdentityRecord {
    identity_id: PublicId,
    revision: PublicRevision,
    issuer: String,
    subject: String
});
