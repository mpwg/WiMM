// SPDX-License-Identifier: AGPL-3.0-or-later
import Foundation
while let input = readLine() {
    var typed = false
    var valid = false
    do {
        let parts = input.split(separator: "\t", maxSplits: 1, omittingEmptySubsequences: false)
        guard parts.count == 2 else { fatalError("Synthetischer lokaler Formmodus fehlt.") }
        var plan = try localMigrationFromJson(input: String(parts[1]))
        switch parts[0] {
        case "catalog": break
        case "negative": plan.expectedMigrationNumber = -1
        case "unsafe": plan.expectedMigrationNumber = 9_007_199_254_740_992
        case "stepZero": plan.steps[0].number = 0
        case "backwards": plan.steps[0].to.storageSchemaVersion = 1
        case "empty": plan.steps = []
        case "gap": plan.steps[0].number = 2
        case "chain": plan.steps[0].from.storageSchemaVersion = 2
        case "domainZero": plan.from.domainSchemaVersion = 0
        default: fatalError("Unbekannter lokaler Formmodus.")
        }
        typed = true
        let result = try validateLocalMigrationFormV2(plan: plan)
        guard result.contractVersion == 2 && result.status == .formValid else { fatalError("Lokale Ergebnisform falsch.") }
        valid = true
    } catch let error as LocalContractError {
        guard case .Rejected(let version, let code, _) = error, version == 2, code == "INVALID_LOCAL_CONTRACT" else { fatalError("Lokale Fehlerform falsch.") }
    } catch { fatalError("Unerwarteter technischer lokaler Bindingfehler.") }
    print("{\"typed\":\(typed),\"valid\":\(valid)}")
}
