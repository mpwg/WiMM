// SPDX-License-Identifier: AGPL-3.0-or-later
//! Alle vorhandenen Berechnungen mit gemeinsamer typisierter Ein-/Ausgabe.
use crate::{CoreResult, automation, schedule_dates};
use wimm_finance_types::{
    calculation_contracts::{CalculationOutcome, CalculationRequest},
    scalars::MoneyCents,
};

pub fn calculate(request: CalculationRequest) -> CoreResult<CalculationOutcome> {
    let (binding, domain) = request.versions();
    if binding != 1 || domain != 1 {
        return Err((
            "UPDATE_REQUIRED",
            "Der Enginevertrag wird nicht unterstützt.",
        ));
    }
    match request {
        CalculationRequest::MoneyParse(request) => Ok(CalculationOutcome::Money {
            contract_version: 1,
            value: MoneyCents::new(crate::parse_money(&request.text)?)?,
        }),
        CalculationRequest::DueDates(request) => schedule_dates::calculate(request),
        request => automation::calculate(request),
    }
}

pub fn decode_calculation_request_v1(input: &str) -> CoreResult<CalculationRequest> {
    serde_json::from_value(crate::decode(input)?)
        .map_err(|_| ("INVALID_COMMAND", "Der Fachbefehl ist ungültig."))
}
