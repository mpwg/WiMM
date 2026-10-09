// SPDX-License-Identifier: AGPL-3.0-or-later
import Foundation
while let input = readLine() {
    do {
        let parts = input.split(separator: "\t", maxSplits: 1, omittingEmptySubsequences: false)
        guard parts.count == 2 else { fatalError("Synthetischer Bindingmodus fehlt.") }
        var request = try commandRequestFromV1(input: String(parts[1]))
        switch parts[0] {
        case "catalog": break
        case "version": request.contractVersion = 1
        case "mixedVersion":
            request.contractVersion = 99
            request.spaceId = "privat – ungültig 🏠"
        case "mixedDomain":
            request.domainSchemaVersion = 99
            request.context.occurredAt = "2026-10-09T25:00:00Z"
        case "uuid": request.spaceId = "privat – ungültig 🏠"
        case "utc": request.context.occurredAt = "2026-10-09T25:00:00Z"
        case "list": request.command = .accountSave(SaveCommand(aggregates: []))
        case "cent":
            var found = false
            request.aggregates = request.aggregates.map { aggregate in
                if case .transaction(var transaction) = aggregate {
                    transaction.amount = 9_007_199_254_740_992
                    found = true
                    return .transaction(transaction)
                }
                return aggregate
            }
            guard found else { fatalError("Synthetische Centfixture fehlt.") }
        default: fatalError("Unbekannter synthetischer Bindingmodus.")
        }
        // Der zweite Aufruf überträgt echte generierte Records/Enums, keinen JSON-Request.
        let result = try executeV2(request: request)
        print(try commandOutcomeToV1(outcome: result))
    } catch let error as ContractError {
        print(commandErrorToV1(error: error))
    } catch {
        fatalError("Unerwarteter technischer Bindingfehler im synthetischen Katalog.")
    }
}
