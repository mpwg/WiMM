// SPDX-License-Identifier: AGPL-3.0-or-later
import Foundation
while let input = readLine() {
    var typed = false
    var output = "null"
    var valid = false
    do {
        let parts = input.split(separator: "\t", maxSplits: 1, omittingEmptySubsequences: false)
        guard parts.count == 2 else { fatalError("Synthetischer Snapshotmodus fehlt.") }
        var snapshot = try localSnapshotFromV1Json(input: String(parts[1]))
        switch parts[0] {
        case "catalog": break
        case "version": snapshot.storageSchemaVersion = 99
        case "mixedVersion": snapshot.storageSchemaVersion = 99; snapshot.profileId = "privat – ungültig 🏠"
        case "uuid": snapshot.profileId = "privat – ungültig 🏠"
        case "cursor": snapshot.syncState = SyncState(profileId: snapshot.profileId, spaceId: snapshot.spaceId, epoch: snapshot.epoch, cursor: "00")
        case "revision":
            if case .transaction(var tx) = snapshot.aggregates[0].aggregate { tx.revision = 0; snapshot.aggregates[0].aggregate = .transaction(tx) }
        case "cent":
            if case .transaction(var tx) = snapshot.aggregates[0].aggregate { tx.amount = 9_007_199_254_740_992; snapshot.aggregates[0].aggregate = .transaction(tx) }
        case "draft": snapshot.pending = [PendingOperation(operationId: snapshot.profileId, spaceId: snapshot.spaceId, expectedRevisions: [], dependsOn: [], state: .queued, draft: "{", retryCount: 0, createdAt: nil)]
        default: fatalError("Unbekannter Snapshotmodus.")
        }
        typed = true
        let result = try roundtripLocalSnapshotV2(snapshot: snapshot)
        guard result.contractVersion == 2 && result.status == .snapshot else { fatalError("Snapshot-Ergebnisform falsch.") }
        output = try localSnapshotToV1Json(snapshot: result.snapshot)
        valid = true
    } catch let error as ContractError {
        guard case .Rejected(let version, _, _) = error, version == 2 else { fatalError("Snapshot-Fehlerform falsch.") }
    } catch { fatalError("Unerwarteter Snapshot-Bindingfehler.") }
    print("{\"typed\":\(typed),\"valid\":\(valid),\"snapshot\":\(output)}")
}
