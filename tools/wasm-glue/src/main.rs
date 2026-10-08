// SPDX-License-Identifier: AGPL-3.0-or-later
#![forbid(unsafe_code)]
fn main() {
    let input = std::env::args().nth(1).expect("WASM-Eingabedatei fehlt");
    let output = std::env::args().nth(2).expect("Ausgabeverzeichnis fehlt");
    wasm_bindgen_cli_support::Bindgen::new()
        .input_path(input)
        .typescript(true)
        .web(true)
        .expect("Web-Bindingziel ist ungültig")
        .generate(output)
        .expect("WASM-Bindings konnten nicht erzeugt werden");
}
