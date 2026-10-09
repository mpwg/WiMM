// SPDX-License-Identifier: AGPL-3.0-or-later
import Foundation
while let input = readLine() {
    var typed = false
    let output: String
    do {
        let parts = input.split(separator: "\t", maxSplits: 1, omittingEmptySubsequences: false)
        guard parts.count == 2 else { fatalError("Synthetische Bindingaktion fehlt.") }
        switch parts[0] {
        case "project":
            let request = try projectionRequestFromV1(input: String(parts[1]))
            typed = true
            output = try projectionOutcomeToV1(outcome: projectV2(request: request))
        case "validate":
            let request = try validationRequestFromV1(input: String(parts[1]))
            typed = true
            output = try validationOutcomeToV1(outcome: validateV2(request: request))
        case "reverse":
            let request = try reverseRequestFromV1(input: String(parts[1]))
            typed = true
            output = try commandOutcomeToV1(outcome: reverseV2(request: request))
        case "calculate":
            let request = try calculationRequestFromV1(input: String(parts[1]))
            typed = true
            output = try calculationOutcomeToV1(outcome: calculateV2(request: request))
        default: fatalError("Unbekannte synthetische Bindingaktion.")
        }
    } catch let error as ContractError {
        output = commandErrorToV1(error: error)
    } catch {
        fatalError("Unerwarteter technischer Bindingfehler im synthetischen Katalog.")
    }
    print("{\"typed\":\(typed),\"output\":\(output)}")
}
