// SPDX-License-Identifier: AGPL-3.0-or-later
import org.wimm.core.executeJson
import org.wimm.core.calculateJson
import org.wimm.core.roundtripJson
fun main(args: Array<String>) {
    generateSequence(::readlnOrNull).forEach { request ->
        when (args[0]) {
            "execute" -> println(executeJson(request))
            "calculate" -> println(calculateJson(request))
            "roundtrip" -> println(roundtripJson(request))
            else -> error("Unbekannte Testaktion")
        }
    }
}
