// SPDX-License-Identifier: AGPL-3.0-or-later
import org.wimm.core.localPortFromJson
import org.wimm.core.validateLocalPortFormV2
import org.wimm.localcontracts.LocalPortCommand
import org.wimm.localcontracts.LocalFormStatus
import org.wimm.privatecontracts.ContractException
fun main() {
    generateSequence(::readlnOrNull).forEach { input ->
        var typed = false; var valid = false
        try {
            val parts = input.split('\t', limit = 2)
            val request = localPortFromJson(parts[1])
            when (parts[0]) {
                "catalog" -> Unit
                "version" -> request.contractVersion = 99u
                "uuid" -> request.command = LocalPortCommand.ReadAggregate("privat – ungültig 🏠")
                else -> error("Unbekannter Portmodus.")
            }
            typed = true
            val result = validateLocalPortFormV2(request)
            check(result.contractVersion == 2u && result.status == LocalFormStatus.FORM_VALID); valid = true
        } catch (error: ContractException) {check(error is ContractException.Rejected && error.contractVersion == 2u)}
        println("{\"typed\":$typed,\"valid\":$valid}")
    }
}
