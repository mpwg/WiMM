// SPDX-License-Identifier: AGPL-3.0-or-later
import Foundation
let codes: [StorageFailureCode] = [.revisionConflict,.quota,.resourceUnavailable,.writeFailed,.updateRequired,.epochMismatch,.cancelled,.commitUnknown,.invalidResponse,.operationIdReused]
var count = 0
for code in codes {
    let input = StorageFailure(contractVersion: 2, code: code, commitState: code == .commitUnknown ? .unknown : .notCommitted)
    let result = try roundtripStorageFailureV2(input: input)
    guard result == input else { fatalError("Fehlercode oder Commitstatus verloren.") }
    count += 1
}
for input in [StorageFailure(contractVersion: 99, code: .quota, commitState: .notCommitted),StorageFailure(contractVersion: 2, code: .commitUnknown, commitState: .notCommitted)] {
    do { _ = try roundtripStorageFailureV2(input: input); fatalError("Ungültige Fehlerhülle angenommen.") }
    catch let error as LocalContractError { guard case .Rejected(let version,_,_) = error, version == 2 else { fatalError("Fehlerhülle falsch.") } }
    count += 1
}
print("{\"typedCalls\":\(count)}")
