// SPDX-License-Identifier: AGPL-3.0-or-later
#![forbid(unsafe_code)]
use std::io::{self, BufRead};
fn main() {
    let path = std::env::args()
        .nth(1)
        .expect("Der isolierte Testdatenpfad fehlt.");
    let mut db = wimm_dal_proof::ProofDb::open(&path)
        .expect("Der Testspeicher konnte nicht geöffnet werden.");
    for line in io::stdin().lock().lines() {
        println!(
            "{}",
            db.request(&line.expect("Der Testrequest ist nicht lesbar."))
        );
    }
}
