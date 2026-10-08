// SPDX-License-Identifier: AGPL-3.0-or-later
use std::io::{BufRead, Write};
fn main() {
    let mode = std::env::args()
        .nth(1)
        .expect("execute oder calculate fehlt");
    for line in std::io::stdin().lock().lines() {
        let request = line.expect("Testanfrage kann nicht gelesen werden");
        let result = match mode.as_str() {
            "execute" => wimm_finance_core::execute_json(&request),
            "calculate" => wimm_finance_core::calculate_json(&request),
            "roundtrip" => wimm_finance_core::roundtrip_json(&request),
            _ => panic!("Unbekannte Testaktion"),
        };
        println!("{result}");
        std::io::stdout()
            .flush()
            .expect("Testresultat kann nicht geschrieben werden");
    }
}
