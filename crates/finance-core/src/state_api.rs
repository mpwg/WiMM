// SPDX-License-Identifier: AGPL-3.0-or-later
//! Typisierte Bestandsaktionen; dieselben Regeln wie an der V1-Grenze.
use crate::{CoreResult, projections, references, state_validation};
use wimm_finance_types::state_contracts::{ProjectionRequest, ProjectionSet, ValidationRequest};

pub fn project(request: ProjectionRequest) -> CoreResult<ProjectionSet> {
    check_versions(
        request.contract_version.value(),
        request.domain_schema_version.value(),
    )?;
    state_validation::typed_validate(&request.aggregates, request.space_id.as_str())?;
    projections::typed_rebuild(&request.aggregates)
}

pub fn validate(request: ValidationRequest) -> CoreResult<()> {
    let (binding, domain) = request.versions();
    check_versions(binding.value(), domain.value())?;
    match request {
        ValidationRequest::Historical {
            space_id,
            aggregates,
            ..
        } => state_validation::typed_validate(&aggregates, space_id.as_str()),
        ValidationRequest::Mutation {
            space_id,
            before,
            after,
            ..
        } => {
            state_validation::typed_validate(&before, space_id.as_str())?;
            state_validation::typed_validate(&after, space_id.as_str())?;
            references::typed_validate(&after, &before)
        }
    }
}

/// Reiner Formadapter für vorhandene V1-Aufrufer und unveränderte Kataloge.
pub fn decode_projection_request_v1(input: &str) -> CoreResult<ProjectionRequest> {
    serde_json::from_value(crate::decode(input)?)
        .map_err(|_| ("INVALID_COMMAND", "Der Fachbefehl ist ungültig."))
}

pub fn decode_validation_request_v1(input: &str) -> CoreResult<ValidationRequest> {
    serde_json::from_value(crate::decode(input)?)
        .map_err(|_| ("INVALID_COMMAND", "Der Fachbefehl ist ungültig."))
}

fn check_versions(binding: u32, domain: u32) -> CoreResult<()> {
    if binding == 1 && domain == 1 {
        Ok(())
    } else {
        Err((
            "UPDATE_REQUIRED",
            "Der Enginevertrag wird nicht unterstützt.",
        ))
    }
}

/// Referenzen gegen vollständigen Bestand prüfen; Monatsauswahl gehört erst in die Projektion.
pub fn project_month(
    request: ProjectionRequest,
    month: &str,
) -> CoreResult<wimm_finance_types::state_contracts::Consumption> {
    check_versions(
        request.contract_version.value(),
        request.domain_schema_version.value(),
    )?;
    crate::calendar::parse_year_month(month)?;
    state_validation::typed_validate(&request.aggregates, request.space_id.as_str())?;
    let selected = request
        .aggregates
        .into_iter()
        .filter(|entry| match entry {
            wimm_finance_types::models::Aggregate::Transaction(tx) => {
                tx.date.as_str().starts_with(month)
            }
            _ => true,
        })
        .collect::<Vec<_>>();
    projections::typed_consumption(&selected)
}
