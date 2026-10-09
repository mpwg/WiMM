// SPDX-License-Identifier: AGPL-3.0-or-later
import Foundation

func text(_ value: Substring) -> String {
    guard let data = Data(base64Encoded: String(value)), let result = String(data: data, encoding: .utf8) else {
        fatalError("Die synthetische UTF-8-Testeingabe ist ungültig.")
    }
    return result
}
while let line = readLine() {
    let parts = line.split(separator: "\t", omittingEmptySubsequences: false)
    guard parts.count == 4, let binding = UInt32(parts[0]), let domain = UInt32(parts[1]) else {
        fatalError("Der synthetische V2-Testrequest ist ungültig.")
    }
    let request = MoneyRequestV2(contractVersion: binding, domainSchemaVersion: domain, spaceId: text(parts[2]), text: text(parts[3]))
    let result = calculateMoneyV2(request: request)
    let status = result.status == .money ? "money" : "rejected"
    let message = result.message.map { Data($0.utf8).base64EncodedString() } ?? ""
    print([String(result.contractVersion), status, result.value.map { String($0) } ?? "", result.errorCode ?? "", message].joined(separator: "\t"))
}
