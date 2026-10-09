// SPDX-License-Identifier: AGPL-3.0-or-later
import java.util.Base64
import org.wimm.core.MoneyRequestV2
import org.wimm.core.MoneyStatusV2
import org.wimm.core.calculateMoneyV2

fun main() {
    generateSequence(::readlnOrNull).forEach { line ->
        val parts = line.split('\t')
        check(parts.size == 4) { "Der synthetische V2-Testrequest ist ungültig." }
        fun text(value: String) = String(Base64.getDecoder().decode(value), Charsets.UTF_8)
        val request = MoneyRequestV2(parts[0].toUInt(), parts[1].toUInt(), text(parts[2]), text(parts[3]))
        val result = calculateMoneyV2(request)
        val status = if (result.status == MoneyStatusV2.MONEY) "money" else "rejected"
        val message = result.message?.let { Base64.getEncoder().encodeToString(it.toByteArray(Charsets.UTF_8)) } ?: ""
        println(listOf(result.contractVersion.toString(), status, result.value?.toString() ?: "", result.errorCode ?: "", message).joinToString("\t"))
    }
}
