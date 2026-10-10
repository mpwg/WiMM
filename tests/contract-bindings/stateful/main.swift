// SPDX-License-Identifier: AGPL-3.0-or-later
import Foundation
import Synchronization
struct BackendState: Sendable {
    var context: CommitContext
    var rows: [String: Aggregate]
    var receipts: [String: LocalCommitReceipt] = [:]
    var journal = Data()
    var writes = 0
    var mode: String
}
final class Backend: NativeRuntimeHost {
    let state: Mutex<BackendState>
    init(snapshot: RuntimeSnapshotV2, mode: String) {
        state = Mutex(BackendState(context: snapshot.context, rows: Dictionary(uniqueKeysWithValues: snapshot.aggregates.map { (aggregateIdProbe(value: $0), $0) }), mode: mode))
    }
    func load(context: CommitContext) throws -> RuntimeSnapshotV2 {
        if state.withLock({ $0.mode == "readException" }) { throw NSError(domain:"synthetischer Lesefehler",code:1) }
        return state.withLock { RuntimeSnapshotV2(contractVersion: $0.mode == "badSnapshot" ? 1 : 2, context: $0.context, aggregates: $0.rows.values.sorted { aggregateIdProbe(value: $0) < aggregateIdProbe(value: $1) }) }
    }
    func commit(request: LocalCommitRequest, context:CommitContext, cancelled: Bool) throws -> RuntimeCommitResultV2 {
        try state.withLock { state in
            state.writes += 1
            if state.mode == "exception" { throw NSError(domain: "synthetischer Callbackfehler", code: 1) }
            if cancelled { return .notCommitted(error: StorageFailure(contractVersion: 2, code: .cancelled, commitState: .notCommitted)) }
            if state.mode == "rollback" { return .notCommitted(error: StorageFailure(contractVersion: 2, code: .writeFailed, commitState: .notCommitted)) }
            for expected in request.batch.expectedRevisions {
                let actual = state.rows[expected.handle].map { aggregateRevisionProbe(value: $0) } ?? 0
                if actual != expected.expectedRevision { return .notCommitted(error: StorageFailure(contractVersion: 2, code: .revisionConflict, commitState: .notCommitted)) }
            }
            let receipt = try runtimeReceiptProbe(request: request)
            for row in request.batch.aggregates { state.rows[row.handle] = row.aggregate }
            state.receipts[request.identity.operationId] = receipt
            if state.mode == "lateScope" { state.context.sessionGeneration += 1 }
            if state.mode == "lost" { state.mode = "normal"; return .unknown(identity: request.identity) }
            if state.mode == "badReceipt" { state.mode="normal";var broken=receipt;broken.contentHash=String(repeating:"0",count:64);return .committed(receipt:broken) }
            return .committed(receipt: receipt)
        }
    }
    func lookup(identity: LocalOperationIdentity) throws -> LocalCommitReceipt? { state.withLock { $0.receipts[identity.operationId] } }
    func journalLoad() throws -> Data { state.withLock { $0.mode == "journalCorrupt" ? Data([0]) : $0.journal } }
    func journalSave(bytes: Data) throws -> Bool { state.withLock { if !$0.journal.isEmpty { return false }; $0.journal = bytes; return true } }
    func journalClear(bytes: Data) throws -> Bool { state.withLock { if $0.journal != bytes { return false }; $0.journal = Data(); return true } }
    func seal(request: LocalCommitRequest) throws -> Data { try sealRuntimeProbe(request: request) }
    func unseal(bytes: Data) throws -> LocalCommitRequest { try unsealRuntimeProbe(bytes: bytes) }
    func current() throws -> CommitContext { state.withLock { $0.context } }
    func cancelled() throws -> Bool { state.withLock { $0.mode == "cancelled" } }
}
while let line = readLine() {
    let parts = line.split(separator: "\t", omittingEmptySubsequences: false).map(String.init)
    do {
        let snapshot = try runtimeSnapshotFromJson(input: parts[0])
        let backend = Backend(snapshot: snapshot, mode: parts[1])
        let session = RuntimeSessionV2(context: snapshot.context, mode: parts[2] == "connected" ? .connected : .standalone, host: backend)
        var events: [String] = []
        for action in parts.dropFirst(3) { events.append(runtimeEventToJson(input: try session.invoke(input: runtimeRequestFromJson(input: action)))) }
        var pages: [String] = []
        do { var offset: UInt32 = 0; while true { let value = try session.page(offset: offset, limit: 100); pages.append(runtimePageToJson(input: value)); if value.aggregates.count < 100 { break }; offset += 100 } } catch is ContractError { pages = [] }
        let page = pages.first ?? "null"
        events.append(runtimeEventToJson(input: try session.shutdown()))
        events.append(runtimeEventToJson(input: try session.invoke(input: runtimeRequestFromJson(input: parts[3]))))
        let writes = backend.state.withLock { $0.writes }
        print("{\"events\":[\(events.joined(separator: ","))],\"page\":\(page),\"pages\":[\(pages.joined(separator: ","))],\"writes\":\(writes)}")
    } catch { fatalError("Unerwarteter synthetischer Bindingfehler: \(error)") }
}
