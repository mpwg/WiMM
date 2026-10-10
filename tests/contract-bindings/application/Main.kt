// SPDX-License-Identifier: AGPL-3.0-or-later
import org.wimm.core.applicationRequestFromJson
import org.wimm.core.applicationPreparationToJson
import org.wimm.core.prepareApplicationV2
import org.wimm.privatecontracts.ContractException
fun main() {
    generateSequence(::readlnOrNull).forEach { input ->
        try {
            val request = applicationRequestFromJson(input)
            val result = prepareApplicationV2(request)
            println(applicationPreparationToJson(result))
        } catch (error: ContractException) {
            println("{\"formError\":true}")
        }
    }
}
