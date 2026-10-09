// SPDX-License-Identifier: AGPL-3.0-or-later
//! AR02-Schemaexport: native Rusttypen sind die einzige Formfeldquelle.
#![forbid(unsafe_code)]
use std::{fs, path::Path};
fn private_form(action: &str, value: serde_json::Value) -> bool {
    use wimm_finance_types::{
        calculation_contracts::CalculationRequest,
        command_contracts::Request,
        reverse_contracts::ReverseRequest,
        state_contracts::{ProjectionRequest, ValidationRequest},
        versions::{DOMAIN_SCHEMA_VERSION, ENGINE_BINDING_VERSION},
    };
    let supported = |binding: u32, domain: u32| {
        binding == ENGINE_BINDING_VERSION && domain == DOMAIN_SCHEMA_VERSION
    };
    match action {
        "execute" => serde_json::from_value::<Request>(value)
            .is_ok_and(|r| supported(r.contract_version.value(), r.domain_schema_version.value())),
        "calculate" => serde_json::from_value::<CalculationRequest>(value).is_ok_and(|r| {
            let (b, d) = r.versions();
            supported(b.value(), d.value())
        }),
        "reverse" => serde_json::from_value::<ReverseRequest>(value)
            .is_ok_and(|r| supported(r.contract_version.value(), r.domain_schema_version.value())),
        "project" => serde_json::from_value::<ProjectionRequest>(value)
            .is_ok_and(|r| supported(r.contract_version.value(), r.domain_schema_version.value())),
        "validate" => serde_json::from_value::<ValidationRequest>(value).is_ok_and(|r| {
            let (b, d) = r.versions();
            supported(b.value(), d.value())
        }),
        _ => false,
    }
}
fn exports() -> Vec<(&'static str, String)> {
    use wimm_finance_types::schema;
    let schemas = [
        ("private-aggregate.schema.json", schema::aggregate()),
        ("private-command.schema.json", schema::command()),
        ("private-request.schema.json", schema::request()),
    ];
    let mut exports: Vec<_> = schemas
        .into_iter()
        .chain(schema::private_v2())
        .map(|(name, schema)| {
            (
                name,
                serde_json::to_string_pretty(&schema).expect("Ein Schema ist serialisierbar")
                    + "\n",
            )
        })
        .collect();
    let manifest = serde_json::json!({
        "bindingVersion": wimm_finance_types::versions::ENGINE_BINDING_VERSION,
        "domainSchemaVersion": wimm_finance_types::versions::DOMAIN_SCHEMA_VERSION,
        "scope": "private",
        "files": exports.iter().map(|(name, _)| *name).collect::<Vec<_>>(),
        "exports": [
            {"name":"execute_v2", "request":"private-v2-execute-request.schema.json", "result":"private-v2-command-outcome.schema.json", "error":"private-v2-error.schema.json"},
            {"name":"calculate_v2", "request":"private-v2-calculation-request.schema.json", "result":"private-v2-calculation-outcome.schema.json", "error":"private-v2-error.schema.json"},
            {"name":"reverse_v2", "request":"private-v2-reverse-request.schema.json", "result":"private-v2-command-outcome.schema.json", "error":"private-v2-error.schema.json"},
            {"name":"project_v2", "request":"private-v2-projection-request.schema.json", "result":"private-v2-projection-outcome.schema.json", "error":"private-v2-error.schema.json"},
            {"name":"validate_v2", "request":"private-v2-validation-request.schema.json", "result":"private-v2-validation-outcome.schema.json", "error":"private-v2-error.schema.json"}
        ]
    });
    exports.push((
        "manifest.json",
        serde_json::to_string_pretty(&manifest).unwrap() + "\n",
    ));
    exports
}
fn run(args: &[String]) -> Result<(), String> {
    run_exports(args, exports())
}
fn run_exports(args: &[String], data: Vec<(&str, String)>) -> Result<(), String> {
    if args.is_empty() {
        for (name, body) in &data {
            println!("{name}\n{body}");
        }
        return Ok(());
    }
    if args.len() != 2 || !["--write", "--check"].contains(&args[0].as_str()) {
        return Err("Verwendung: wimm-contract-schema [--write|--check VERZEICHNIS]".to_owned());
    }
    let root = Path::new(&args[1]);
    if args[0] == "--write" {
        fs::create_dir_all(root).map_err(|e| e.to_string())?;
    }
    let exports = data;
    if args[0] == "--check" {
        let mut actual = Vec::new();
        for entry in fs::read_dir(root).map_err(|e| e.to_string())? {
            let name = entry
                .map_err(|e| e.to_string())?
                .file_name()
                .into_string()
                .map_err(|_| "Der Schema-Dateiname ist kein UTF-8.".to_owned())?;
            if name.ends_with(".json") {
                actual.push(name);
            }
        }
        let mut expected = exports
            .iter()
            .map(|(name, _)| name.to_string())
            .collect::<Vec<_>>();
        actual.sort();
        expected.sort();
        if actual != expected {
            return Err(format!("Vertragsdrift: Dateiinventar {}", root.display()));
        }
    }
    for (name, body) in exports {
        let file = root.join(name);
        if args[0] == "--write" {
            fs::write(&file, body).map_err(|e| e.to_string())?;
        } else {
            let actual =
                fs::read_to_string(&file).map_err(|e| format!("{}: {e}", file.display()))?;
            if actual != body {
                return Err(format!("Vertragsdrift: {}", file.display()));
            }
        }
    }
    Ok(())
}
fn main() {
    let args = std::env::args().skip(1).collect::<Vec<_>>();
    if args.first().is_some_and(|a| a == "--local") {
        if let Err(error) = run_exports(&args[1..], local_exports()) {
            eprintln!("{error}");
            std::process::exit(1);
        }
        return;
    }
    if args == ["--probe-local-v2"] {
        use std::io::BufRead;
        for line in std::io::stdin().lock().lines() {
            let valid = line
                .ok()
                .and_then(|l| {
                    serde_json::from_str::<wimm_local_contracts::models::StorageMigrationPlan>(&l)
                        .ok()
                })
                .is_some();
            println!("{}", serde_json::json!({"valid":valid}));
        }
        return;
    }
    if args.first().is_some_and(|a| a == "--public") {
        if let Err(error) = run_exports(&args[1..], public_exports()) {
            eprintln!("{error}");
            std::process::exit(1);
        }
        return;
    }
    if args == ["--probe-public-v2"] {
        use std::io::BufRead;
        for line in std::io::stdin().lock().lines() {
            let valid = line
                .ok()
                .and_then(|l| serde_json::from_str::<serde_json::Value>(&l).ok())
                .is_some_and(|v| match v["action"].as_str() {
                    Some("operation") => serde_json::from_value::<
                        wimm_public_contracts::envelopes::EncryptedOperation,
                    >(v["request"].clone())
                    .is_ok(),
                    Some("roster") => serde_json::from_value::<
                        wimm_public_contracts::envelopes::SignedKeyRoster,
                    >(v["request"].clone())
                    .is_ok(),
                    _ => false,
                });
            println!("{}", serde_json::json!({"valid":valid}));
        }
        return;
    }
    if args == ["--probe-private-v2"] {
        use std::io::BufRead;
        for line in std::io::stdin().lock().lines() {
            let valid = line
                .ok()
                .and_then(|line| serde_json::from_str::<serde_json::Value>(&line).ok())
                .is_some_and(|value| {
                    value["action"]
                        .as_str()
                        .is_some_and(|action| private_form(action, value["request"].clone()))
                });
            println!("{}", serde_json::json!({"valid":valid}));
        }
        return;
    }
    if let Err(error) = run(&args) {
        eprintln!("{error}");
        std::process::exit(1);
    }
}
fn public_exports() -> Vec<(&'static str, String)> {
    let mut exports = wimm_public_contracts::schema::exports()
        .into_iter()
        .map(|(name, schema)| (name, serde_json::to_string_pretty(&schema).unwrap() + "\n"))
        .collect::<Vec<_>>();
    let manifest = serde_json::json!({"scope":"public","bindingVersion":2,"protocolVersion":1,"files":exports.iter().map(|(name,_)|*name).collect::<Vec<_>>(),"requiresRustRelationalValidation":true,"exports":[{"name":"validate_public_operation_form_v2","request":"public-operation.schema.json","result":"public-form-outcome.schema.json","error":"public-binding-error.schema.json"},{"name":"validate_public_roster_form_v2","request":"public-signed-roster.schema.json","result":"public-form-outcome.schema.json","error":"public-binding-error.schema.json"}]});
    exports.push((
        "manifest.json",
        serde_json::to_string_pretty(&manifest).unwrap() + "\n",
    ));
    exports
}

fn local_exports() -> Vec<(&'static str, String)> {
    let mut exports = wimm_local_contracts::schema::exports()
        .into_iter()
        .map(|(name, schema)| (name, serde_json::to_string_pretty(&schema).unwrap() + "\n"))
        .collect::<Vec<_>>();
    let manifest = serde_json::json!({"scope":"local","bindingVersion":2,"files":exports.iter().map(|(name,_)|*name).collect::<Vec<_>>(),"requiresRustRelationalValidation":true,"exports":[{"name":"validate_local_migration_form_v2","request":"local-migration-plan.schema.json","result":"local-form-outcome.schema.json","error":"local-binding-error.schema.json"}],"storageOrExportMigration":false});
    exports.push((
        "manifest.json",
        serde_json::to_string_pretty(&manifest).unwrap() + "\n",
    ));
    exports
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn private_forms_have_native_assertions_for_the_380_product_catalog_inputs() {
        let cases: Vec<serde_json::Value> = serde_json::from_str(include_str!(
            "../../../crates/finance-core/tests/fixtures/contract-catalog.json"
        ))
        .unwrap();
        let mut counts = [0, 0];
        for case in cases {
            let action = case["method"].as_str().unwrap();
            if !["execute", "calculate", "project", "validate", "reverse"].contains(&action) {
                continue;
            }
            let mut request = if let Some(raw) = case["request"].as_str() {
                serde_json::from_str(raw).unwrap_or(serde_json::Value::Null)
            } else {
                case["request"].clone()
            };
            if let Some(version) = request.get_mut("contractVersion") {
                *version = if version.as_f64() == Some(1.0) {
                    2.into()
                } else {
                    99.into()
                };
            }
            let valid = private_form(action, request);
            counts[usize::from(!valid)] += 1;
        }
        assert_eq!(counts, [354, 26]);
    }

    #[test]
    fn private_header_numbers_keep_json_integer_notation_without_coercion() {
        for (version, valid) in [
            ("2", true),
            ("2.0", true),
            ("2e0", true),
            ("2.1", false),
            ("\"2\"", false),
            ("null", false),
            ("4294967296", false),
        ] {
            let raw = format!(
                "{{\"contractVersion\":{version},\"domainSchemaVersion\":1.0,\"spaceId\":\"40000000-0000-4000-8000-000000000000\",\"aggregates\":[]}}"
            );
            assert_eq!(
                private_form("project", serde_json::from_str(&raw).unwrap()),
                valid,
                "{version}"
            );
        }
    }
    #[test]
    fn check_detects_drift_without_overwriting_the_changed_file() {
        let root =
            Path::new(env!("CARGO_MANIFEST_DIR")).join("../../test-results/contract-schema-cli");
        let path = root.to_string_lossy().into_owned();
        run(&["--write".into(), path.clone()]).unwrap();
        run(&["--check".into(), path.clone()]).unwrap();
        let file = root.join("private-command.schema.json");
        let changed = "{\"absichtlich\":\"verändert\"}\n";
        fs::write(&file, changed).unwrap();
        assert!(
            run(&["--check".into(), path])
                .unwrap_err()
                .contains("Vertragsdrift")
        );
        assert_eq!(fs::read_to_string(file).unwrap(), changed);
    }
}
