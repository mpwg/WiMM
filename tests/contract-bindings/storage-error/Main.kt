// SPDX-License-Identifier: AGPL-3.0-or-later
import org.wimm.core.roundtripStorageFailureV2
import org.wimm.localcontracts.StorageFailure
import org.wimm.localcontracts.StorageFailureCode
import org.wimm.localcontracts.FailureCommitState
import org.wimm.localcontracts.LocalContractException
fun main() {
    var count = 0
    for (code in StorageFailureCode.entries) {
        val input = StorageFailure(2u,code,if (code == StorageFailureCode.COMMIT_UNKNOWN) FailureCommitState.UNKNOWN else FailureCommitState.NOT_COMMITTED)
        check(roundtripStorageFailureV2(input) == input); count++
    }
    for (input in listOf(StorageFailure(99u,StorageFailureCode.QUOTA,FailureCommitState.NOT_COMMITTED),StorageFailure(2u,StorageFailureCode.COMMIT_UNKNOWN,FailureCommitState.NOT_COMMITTED))) {
        try { roundtripStorageFailureV2(input); error("Ungültige Fehlerhülle angenommen.") }
        catch (error: LocalContractException) { check(error is LocalContractException.Rejected && error.contractVersion == 2u) }
        count++
    }
    println("{\"typedCalls\":$count}")
}
