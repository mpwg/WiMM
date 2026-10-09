// SPDX-License-Identifier: AGPL-3.0-or-later
import Foundation
while let input = readLine() {
    var typed = false
    var valid = false
    do {
        let parts = input.split(separator: "\t", maxSplits: 1, omittingEmptySubsequences: false)
        var request = try localPortFromJson(input: String(parts[1]))
        switch parts[0] {
        case "catalog": break
        case "version": request.contractVersion = 99
        case "uuid": request.command = .readAggregate(handle: "privat – ungültig 🏠")
        default: fatalError("Unbekannter Portmodus.")
        }
        typed = true
        let result = try validateLocalPortFormV2(request: request)
        guard result.contractVersion == 2 && result.status == .formValid else { fatalError("Port-Ergebnisform falsch.") }
        valid = true
    } catch let error as ContractError {
        guard case .Rejected(let version, _, _) = error, version == 2 else { fatalError("Port-Fehlerform falsch.") }
    } catch { fatalError("Unerwarteter Port-Bindingfehler.") }
    print("{\"typed\":\(typed),\"valid\":\(valid)}")
}
