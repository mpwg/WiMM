// SPDX-License-Identifier: AGPL-3.0-or-later
#![forbid(unsafe_code)]
use std::{
    io::Write,
    process::{Command, Stdio},
};
#[test]
fn rustprobe_verarbeitet_mehrere_anfragen_ohne_ergebnisvermischung() {
    let mut child = Command::new(env!("CARGO_BIN_EXE_wimm-core-probe"))
        .arg("calculate")
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .unwrap();
    let mut input = child.stdin.take().unwrap();
    input
        .write_all(b"{\"contractVersion\":999,\"domainSchemaVersion\":1}\n{kaputt}\n")
        .unwrap();
    drop(input);
    let output = child.wait_with_output().unwrap();
    assert!(output.status.success());
    assert!(output.stderr.is_empty());
    let stdout = String::from_utf8(output.stdout).unwrap();
    let lines: Vec<_> = stdout.lines().collect();
    assert_eq!(lines.len(), 2);
    assert!(lines[0].contains("UPDATE_REQUIRED"));
    assert!(lines[1].contains("INVALID_COMMAND"));
    assert!(!stdout.contains("kaputt"));
}
