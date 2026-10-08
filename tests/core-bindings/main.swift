// SPDX-License-Identifier: AGPL-3.0-or-later
import Foundation
let mode = CommandLine.arguments[1]
while let request = readLine() {
    if mode == "cache" { print(cacheJson(request: request)) }
    else if mode == "reverse" { print(reverseJson(request: request)) }
    else if mode == "execute" { print(executeJson(request: request)) }
    else if mode == "calculate" { print(calculateJson(request: request)) }
    else if mode == "validate" { print(validateJson(request: request)) }
    else if mode == "project" { print(projectJson(request: request)) }
    else if mode == "primitive" { print(primitiveJson(request: request)) }
    else if mode == "roundtrip" { print(roundtripJson(request: request)) }
    else { fatalError("Unbekannte Testaktion") }
}
