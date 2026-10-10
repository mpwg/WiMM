// SPDX-License-Identifier: AGPL-3.0-or-later
#![forbid(unsafe_code)]
#[cfg(not(target_family = "wasm"))]
fn main() {
    use std::io::{self, BufRead};
    let args: Vec<String> = std::env::args().collect();
    let profile = wimm_finance_types::scalars::EntityId::new(
        args.get(2)
            .expect("Die synthetische Profil-ID fehlt.")
            .clone(),
    )
    .expect("Die synthetische Profil-ID ist ungültig.");
    let mut db = wimm_local_dal::sqlite_commit::SqliteCommitStore::open(
        std::path::Path::new(args.get(1).expect("Der isolierte Testspeicher fehlt.")),
        profile,
    )
    .expect("Der isolierte Testspeicher ist nicht verfügbar.");
    for line in io::stdin().lock().lines() {
        let result = wimm_local_dal::receipt_probe::run(
            &mut db,
            &line.expect("Der Testrequest ist nicht lesbar."),
        );
        match result {
            Ok(value) => println!("{value}"),
            Err(error) => println!(
                "{}",
                serde_json::to_string(&error).expect("Strukturierter Fehler")
            ),
        }
    }
}
#[cfg(target_family = "wasm")]
fn main() {}
