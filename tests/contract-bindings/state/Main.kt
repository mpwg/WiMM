// SPDX-License-Identifier: AGPL-3.0-or-later
import org.wimm.core.projectionRequestFromV1
import org.wimm.core.validationRequestFromV1
import org.wimm.core.projectV2
import org.wimm.core.validateV2
import org.wimm.core.projectionOutcomeToV1
import org.wimm.core.validationOutcomeToV1
import org.wimm.core.commandErrorToV1
import org.wimm.core.reverseRequestFromV1
import org.wimm.core.reverseV2
import org.wimm.core.commandOutcomeToV1
import org.wimm.privatecontracts.ContractException
fun main() {
    generateSequence(::readlnOrNull).forEach { input ->
        var typed = false
        val output = try {
            val parts = input.split('\t', limit = 2)
            check(parts.size == 2) { "Synthetische Bindingaktion fehlt." }
            when (parts[0]) {
                "project" -> {
                    val request = projectionRequestFromV1(parts[1])
                    typed = true
                    projectionOutcomeToV1(projectV2(request))
                }
                "validate" -> {
                    val request = validationRequestFromV1(parts[1])
                    typed = true
                    validationOutcomeToV1(validateV2(request))
                }
                "reverse" -> {
                    val request = reverseRequestFromV1(parts[1])
                    typed = true
                    commandOutcomeToV1(reverseV2(request))
                }
                else -> error("Unbekannte synthetische Bindingaktion.")
            }
        } catch (error: ContractException) {
            commandErrorToV1(error)
        }
        println("{\"typed\":$typed,\"output\":$output}")
    }
}
