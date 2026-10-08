// SPDX-License-Identifier: AGPL-3.0-or-later
import Foundation
let mode = CommandLine.arguments[1]
while let request = readLine() {
    if mode == "execute" { print(executeJson(request: request)) }
    else if mode == "calculate" { print(calculateJson(request: request)) }
    else if mode == "roundtrip" { print(roundtripJson(request: request)) }
    else { fatalError("Unbekannte Testaktion") }
}
