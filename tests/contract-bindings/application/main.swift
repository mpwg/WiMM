// SPDX-License-Identifier: AGPL-3.0-or-later
import Foundation
while let input = readLine() {
    do {
        let request = try applicationRequestFromJson(input: input)
        let result = try prepareApplicationV2(input: request)
        print(applicationPreparationToJson(result: result))
    } catch is ContractError {
        print("{\"formError\":true}")
    } catch { fatalError("Unerwarteter Bindingfehler: \(error)") }
}
