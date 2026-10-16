use serde::Serialize;

/// Stable error categories shared by native callers and browser clients.
#[derive(Debug, thiserror::Error, Serialize)]
#[serde(tag = "code", content = "message", rename_all = "snake_case")]
pub enum Error {
    #[error("Validation failed: {0}")]
    Validation(String),
    #[error("Not found: {0}")]
    NotFound(String),
    #[error("Invalid import: {0}")]
    InvalidImport(String),
    #[error("Unsupported format version: {0}")]
    UnsupportedFormatVersion(u64),
    #[error("Storage error: {0}")]
    Storage(String),
}

impl From<diesel::result::Error> for Error {
    fn from(error: diesel::result::Error) -> Self {
        Self::Storage(error.to_string())
    }
}

pub type Result<T> = std::result::Result<T, Error>;
