// SPDX-License-Identifier: AGPL-3.0-or-later
#![forbid(unsafe_code)]
use std::io::BufRead;
fn main() {
    for line in std::io::stdin().lock().lines() {
        let line = line.expect("Lesbare synthetische Eingabe");
        match wimm_core_bindings::run_stateful_runtime_probe(line) {
            Ok(output) => println!("{output}"),
            Err(_) => {
                eprintln!("Ungültige synthetische Runtimeeingabe.");
                std::process::exit(1);
            }
        }
    }
}
