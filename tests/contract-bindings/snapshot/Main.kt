// SPDX-License-Identifier: AGPL-3.0-or-later
import org.wimm.core.localSnapshotFromV1Json
import org.wimm.core.localSnapshotToV1Json
import org.wimm.core.roundtripLocalSnapshotV2
import org.wimm.localcontracts.SyncState
import org.wimm.localcontracts.PendingOperation
import org.wimm.localcontracts.PendingState
import org.wimm.localcontracts.SnapshotStatus
import org.wimm.privatecontracts.ContractException
import org.wimm.privatecontracts.Aggregate
fun main() {
    generateSequence(::readlnOrNull).forEach { input ->
        var typed = false; var valid = false; var output = "null"
        try {
            val parts = input.split('\t', limit = 2); check(parts.size == 2)
            val snapshot = localSnapshotFromV1Json(parts[1])
            when (parts[0]) {
                "catalog" -> Unit
                "version" -> snapshot.storageSchemaVersion = 99u
                "mixedVersion" -> {snapshot.storageSchemaVersion = 99u; snapshot.profileId = "privat – ungültig 🏠"}
                "uuid" -> snapshot.profileId = "privat – ungültig 🏠"
                "cursor" -> snapshot.syncState = SyncState(snapshot.profileId, snapshot.spaceId, snapshot.epoch, "00")
                "revision" -> (snapshot.aggregates[0].aggregate as Aggregate.Transaction).v1.revision = 0L
                "cent" -> (snapshot.aggregates[0].aggregate as Aggregate.Transaction).v1.amount = 9_007_199_254_740_992L
                "draft" -> snapshot.pending = listOf(PendingOperation(snapshot.profileId, snapshot.spaceId, emptyList(), emptyList(), PendingState.QUEUED, "{", 0L, null))
                else -> error("Unbekannter Snapshotmodus.")
            }
            typed = true
            val result = roundtripLocalSnapshotV2(snapshot)
            check(result.contractVersion == 2u && result.status == SnapshotStatus.SNAPSHOT)
            output = localSnapshotToV1Json(result.snapshot); valid = true
        } catch (error: ContractException) {check(error is ContractException.Rejected && error.contractVersion == 2u)}
        println("{\"typed\":$typed,\"valid\":$valid,\"snapshot\":$output}")
    }
}
