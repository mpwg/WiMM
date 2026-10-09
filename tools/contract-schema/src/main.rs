// SPDX-License-Identifier: AGPL-3.0-or-later
//! AR02-Schemaexport: native Rusttypen sind die einzige Formfeldquelle.
#![forbid(unsafe_code)]
use std::{fs, path::Path};
fn exports() -> Vec<(&'static str, String)> {
    use wimm_finance_core::schema;
    [
        ("private-aggregate.schema.json", schema::aggregate()),
        ("private-command.schema.json", schema::command()),
        ("private-request.schema.json", schema::request()),
    ]
    .into_iter()
    .map(|(name, schema)| {
        (
            name,
            serde_json::to_string_pretty(&schema).expect("Ein Schema ist serialisierbar") + "\n",
        )
    })
    .collect()
}
fn run(args: &[String]) -> Result<(), String> {
    if args.is_empty() {
        for (name, body) in exports() {
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
    for (name, body) in exports() {
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
    if let Err(error) = run(&std::env::args().skip(1).collect::<Vec<_>>()) {
        eprintln!("{error}");
        std::process::exit(1);
    }
}
#[cfg(test)]
mod tests {
    use super::*;
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
