// SPDX-License-Identifier: AGPL-3.0-or-later
import org.wimm.core.localMigrationFromJson
import org.wimm.core.validateLocalMigrationFormV2
import org.wimm.localcontracts.LocalContractException
import org.wimm.localcontracts.LocalFormStatus
fun main() {
    generateSequence(::readlnOrNull).forEach { input ->
        var typed = false
        var valid = false
        try {
            val parts = input.split('\t', limit = 2)
            check(parts.size == 2) { "Synthetischer lokaler Formmodus fehlt." }
            val plan = localMigrationFromJson(parts[1])
            when (parts[0]) {
                "catalog" -> Unit
                "negative" -> plan.expectedMigrationNumber = -1L
                "unsafe" -> plan.expectedMigrationNumber = 9_007_199_254_740_992L
                "stepZero" -> plan.steps[0].number = 0L
                "backwards" -> plan.steps[0].to.storageSchemaVersion = 1L
                "empty" -> plan.steps = emptyList()
                "gap" -> plan.steps[0].number = 2L
                "chain" -> plan.steps[0].from.storageSchemaVersion = 2L
                "domainZero" -> plan.from.domainSchemaVersion = 0L
                else -> error("Unbekannter lokaler Formmodus.")
            }
            typed = true
            val result = validateLocalMigrationFormV2(plan)
            check(result.contractVersion == 2u && result.status == LocalFormStatus.FORM_VALID)
            valid = true
        } catch (error: LocalContractException) {
            check(error is LocalContractException.Rejected && error.contractVersion == 2u && error.code == "INVALID_LOCAL_CONTRACT")
        }
        println("{\"typed\":$typed,\"valid\":$valid}")
    }
}
