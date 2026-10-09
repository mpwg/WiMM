// SPDX-License-Identifier: AGPL-3.0-or-later
import Foundation
while let input = readLine() {
    var typed = false
    var valid = false
    do {
        let parts = input.split(separator: "\t", maxSplits: 2, omittingEmptySubsequences: false)
        guard parts.count == 3 else { fatalError("Synthetischer Formmodus fehlt.") }
        let result: PublicValidationOutcome
        if parts[0] == "operation" {
            var value = try publicOperationFromJson(input: String(parts[2]))
            switch parts[1] {
            case "catalog": break
            case "protocol": value.header.protocolVersion = 99
            case "uuid": value.header.deviceId = "privat – ungültig 🏠"
            case "nonce": value.nonce = "a="
            case "revision": value.header.writes[0].expectedRevision = 9_007_199_254_740_992
            case "cas": value.header.writes[0].proposedRevision = 2
            case "writes": value.header.writes = []
            default: fatalError("Unbekannter Formmodus.")
            }
            typed = true
            result = try validatePublicOperationFormV2(operation: value)
        } else {
            var value = try publicRosterFromJson(input: String(parts[2]))
            switch parts[1] {
            case "catalog": break
            case "rosterPrevious": value.roster.rosterVersion = 2
            case "members": value.roster.members = []
            default: fatalError("Unbekannter Formmodus.")
            }
            typed = true
            result = try validatePublicRosterFormV2(roster: value)
        }
        guard result.contractVersion == 2 && result.status == .formValid else { fatalError("Öffentliche Ergebnisform falsch.") }
        valid = true
    } catch let error as PublicContractError {
        guard case .Rejected(let version, let code, _) = error, version == 2,
              code == .invalidEnvelope || code == .updateRequired else { fatalError("Öffentliche Fehlerform falsch.") }
    } catch { fatalError("Unerwarteter technischer Bindingfehler.") }
    print("{\"typed\":\(typed),\"valid\":\(valid)}")
}
