// SPDX-License-Identifier: AGPL-3.0-or-later
import org.wimm.core.commandRequestFromV1
import org.wimm.core.commandOutcomeToV1
import org.wimm.core.commandErrorToV1
import org.wimm.core.executeV2
import org.wimm.privatecontracts.ContractException
import org.wimm.privatecontracts.Command
import org.wimm.privatecontracts.Aggregate
import org.wimm.privatecontracts.SaveCommand
fun main() {
    generateSequence(::readlnOrNull).forEach { input ->
        try {
            val parts = input.split('\t', limit = 2)
            check(parts.size == 2) { "Synthetischer Bindingmodus fehlt." }
            val request = commandRequestFromV1(parts[1])
            when (parts[0]) {
                "catalog" -> Unit
                "version" -> request.contractVersion = 1u
                "mixedVersion" -> {
                    request.contractVersion = 99u
                    request.spaceId = "privat – ungültig 🏠"
                }
                "mixedDomain" -> {
                    request.domainSchemaVersion = 99u
                    request.context.occurredAt = "2026-10-09T25:00:00Z"
                }
                "uuid" -> request.spaceId = "privat – ungültig 🏠"
                "utc" -> request.context.occurredAt = "2026-10-09T25:00:00Z"
                "list" -> request.command = Command.AccountSave(SaveCommand(emptyList()))
                "cent" -> {
                    var found = false
                    request.aggregates.forEach { aggregate ->
                        if (aggregate is Aggregate.Transaction) {
                            aggregate.v1.amount = Long.MAX_VALUE
                            found = true
                        }
                    }
                    check(found) { "Synthetische Centfixture fehlt." }
                }
                else -> error("Unbekannter synthetischer Bindingmodus.")
            }
            // Echte generierte Records/Enums für den eigentlichen typisierten Aufruf.
            val result = executeV2(request)
            println(commandOutcomeToV1(result))
        } catch (error: ContractException) {
            println(commandErrorToV1(error))
        }
    }
}
