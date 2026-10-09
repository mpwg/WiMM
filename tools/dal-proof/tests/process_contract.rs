// SPDX-License-Identifier: AGPL-3.0-or-later
#![forbid(unsafe_code)]
use serde_json::{Value, json};
use std::{
    io::Write,
    path::Path,
    process::{Command, Stdio},
};

fn run(path: &Path, requests: &[Value]) -> Vec<Value> {
    let mut child = Command::new(env!("CARGO_BIN_EXE_wimm-dal-proof"))
        .arg(path)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .spawn()
        .unwrap();
    let mut input = child.stdin.take().unwrap();
    for request in requests {
        writeln!(input, "{request}").unwrap();
    }
    drop(input);
    let output = child.wait_with_output().unwrap();
    assert!(output.status.success());
    String::from_utf8(output.stdout)
        .unwrap()
        .lines()
        .map(|line| serde_json::from_str(line).unwrap())
        .collect()
}
fn isolated_path(name: &str) -> std::path::PathBuf {
    let directory = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("../../test-results/dal-proof/native");
    std::fs::create_dir_all(&directory).unwrap();
    directory.join(format!(
        "{name}-{}-{}.sqlite3",
        std::process::id(),
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos()
    ))
}
#[test]
fn actual_process_restart_preserves_batch_and_dsl_journal() {
    let path = isolated_path("restart");
    let first = run(
        &path,
        &[
            json!({"kind":"initialize"}),
            json!({"kind":"batch","id":"a","expected":0,"value":"dauerhaft","fail":false}),
            json!({"kind":"migrate","expected":1,"fail":false}),
            json!({"kind":"snapshot"}),
        ],
    );
    let second = run(&path, &[json!({"kind":"snapshot"})]);
    assert_eq!(first[3], second[0]);
    assert_eq!(second[0]["value"]["entities"][0]["value"], "dauerhaft");
    assert_eq!(second[0]["value"]["migrations"], json!([1, 2]));
    std::fs::remove_file(path).unwrap();
}
#[test]
fn actual_connections_accept_exactly_one_stale_revision() {
    let path = isolated_path("cas");
    run(&path, &[json!({"kind":"initialize"})]);
    let a = path.clone();
    let b = path.clone();
    let first = std::thread::spawn(move || {
        run(
            &a,
            &[json!({"kind":"batch","id":"race","expected":0,"value":"a","fail":false})],
        )
    });
    let second = std::thread::spawn(move || {
        run(
            &b,
            &[json!({"kind":"batch","id":"race","expected":0,"value":"b","fail":false})],
        )
    });
    let results = [
        first.join().unwrap()[0].clone(),
        second.join().unwrap()[0].clone(),
    ];
    assert_eq!(results.iter().filter(|r| r["ok"] == true).count(), 1);
    assert_eq!(
        results
            .iter()
            .filter(|r| r["code"] == "REVISION_CONFLICT")
            .count(),
        1
    );
    let stored = run(&path, &[json!({"kind":"snapshot"})]);
    assert_eq!(stored[0]["value"]["outbox"].as_array().unwrap().len(), 1);
    assert_eq!(
        stored[0]["value"]["projections"].as_array().unwrap().len(),
        1
    );
    std::fs::remove_file(path).unwrap();
}
