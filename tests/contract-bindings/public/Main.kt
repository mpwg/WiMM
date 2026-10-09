// SPDX-License-Identifier: AGPL-3.0-or-later
import org.wimm.core.publicOperationFromJson
import org.wimm.core.publicRosterFromJson
import org.wimm.core.validatePublicOperationFormV2
import org.wimm.core.validatePublicRosterFormV2
import org.wimm.publiccontracts.PublicContractException
import org.wimm.publiccontracts.PublicErrorCode
import org.wimm.publiccontracts.PublicValidationStatus
fun main() {
    generateSequence(::readlnOrNull).forEach { input ->
        var typed = false
        var valid = false
        try {
            val parts = input.split('\t', limit = 3)
            check(parts.size == 3) { "Synthetischer Formmodus fehlt." }
            val result = if (parts[0] == "operation") {
                val value = publicOperationFromJson(parts[2])
                when (parts[1]) {
                    "catalog" -> Unit
                    "protocol" -> value.header.protocolVersion = 99u
                    "uuid" -> value.header.deviceId = "privat – ungültig 🏠"
                    "nonce" -> value.nonce = "a="
                    "revision" -> value.header.writes[0].expectedRevision = 9_007_199_254_740_992L
                    "cas" -> value.header.writes[0].proposedRevision = 2L
                    "writes" -> value.header.writes = emptyList()
                    else -> error("Unbekannter Formmodus.")
                }
                typed = true
                validatePublicOperationFormV2(value)
            } else {
                val value = publicRosterFromJson(parts[2])
                when (parts[1]) {
                    "catalog" -> Unit
                    "rosterPrevious" -> value.roster.rosterVersion = 2L
                    "members" -> value.roster.members = emptyList()
                    else -> error("Unbekannter Formmodus.")
                }
                typed = true
                validatePublicRosterFormV2(value)
            }
            check(result.contractVersion == 2u && result.status == PublicValidationStatus.FORM_VALID)
            valid = true
        } catch (error: PublicContractException) {
            check(error is PublicContractException.Rejected && error.contractVersion == 2u && (error.code == PublicErrorCode.INVALID_ENVELOPE || error.code == PublicErrorCode.UPDATE_REQUIRED))
        }
        println("{\"typed\":$typed,\"valid\":$valid}")
    }
}
