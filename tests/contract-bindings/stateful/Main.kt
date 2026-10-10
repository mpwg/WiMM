// SPDX-License-Identifier: AGPL-3.0-or-later
import org.wimm.core.*
import org.wimm.application.*
import org.wimm.privatecontracts.Aggregate
import org.wimm.localcontracts.*
class Backend(snapshot: RuntimeSnapshotV2, var mode: String): NativeRuntimeHost {
    val scope = snapshot.context.copy()
    val rows = snapshot.aggregates.associateBy(::aggregateIdProbe).toMutableMap()
    val receipts = mutableMapOf<String,LocalCommitReceipt>()
    var journal = byteArrayOf()
    var writes = 0
    @Synchronized override fun load(context:CommitContext):RuntimeSnapshotV2 {if(mode=="readException")throw IllegalStateException("synthetischer Lesefehler");return RuntimeSnapshotV2(if(mode=="badSnapshot")1u else 2u,scope.copy(),rows.entries.sortedBy { it.key }.map { it.value })}
    @Synchronized override fun commit(request:LocalCommitRequest,context:CommitContext,cancelled:Boolean):RuntimeCommitResultV2 {
        writes++
        if(mode=="exception")throw IllegalStateException("synthetischer Callbackfehler")
        if(cancelled)return RuntimeCommitResultV2.NotCommitted(StorageFailure(2u,StorageFailureCode.CANCELLED,FailureCommitState.NOT_COMMITTED))
        if(mode=="rollback")return RuntimeCommitResultV2.NotCommitted(StorageFailure(2u,StorageFailureCode.WRITE_FAILED,FailureCommitState.NOT_COMMITTED))
        for(expected in request.batch.expectedRevisions)if((rows[expected.handle]?.let(::aggregateRevisionProbe)?:0)!=expected.expectedRevision)return RuntimeCommitResultV2.NotCommitted(StorageFailure(2u,StorageFailureCode.REVISION_CONFLICT,FailureCommitState.NOT_COMMITTED))
        val receipt=runtimeReceiptProbe(request)
        for(row in request.batch.aggregates)rows[row.handle]=row.aggregate
        receipts[request.identity.operationId]=receipt
        if(mode=="lateScope")scope.sessionGeneration+=1
        if(mode=="lost"){mode="normal";return RuntimeCommitResultV2.Unknown(request.identity)}
        if(mode=="badReceipt"){mode="normal";return RuntimeCommitResultV2.Committed(receipt.copy(contentHash="0".repeat(64)))}
        return RuntimeCommitResultV2.Committed(receipt)
    }
    @Synchronized override fun lookup(identity:LocalOperationIdentity)=receipts[identity.operationId]
    @Synchronized override fun journalLoad()=if(mode=="journalCorrupt")byteArrayOf(0) else journal.copyOf()
    @Synchronized override fun journalSave(bytes:ByteArray):Boolean {if(journal.isNotEmpty())return false;journal=bytes.copyOf();return true}
    @Synchronized override fun journalClear(bytes:ByteArray):Boolean {if(!journal.contentEquals(bytes))return false;journal=byteArrayOf();return true}
    override fun seal(request:LocalCommitRequest)=sealRuntimeProbe(request)
    override fun unseal(bytes:ByteArray)=unsealRuntimeProbe(bytes)
    @Synchronized override fun current()=scope.copy()
    @Synchronized override fun cancelled()=mode=="cancelled"
}
fun main(){generateSequence(::readlnOrNull).forEach { line ->
    val parts=line.split('\t');val snapshot=runtimeSnapshotFromJson(parts[0]);val backend=Backend(snapshot,parts[1]);
    val session=RuntimeSessionV2(snapshot.context,if(parts[2]=="connected")AreaMode.CONNECTED else AreaMode.STANDALONE,backend)
    val events=parts.drop(3).map{runtimeEventToJson(session.invoke(runtimeRequestFromJson(it)))}.toMutableList()
    val pages=mutableListOf<String>();try{var offset=0u;while(true){val value=session.page(offset,100u);pages.add(runtimePageToJson(value));if(value.aggregates.size<100)break;offset+=100u;}}catch(error:org.wimm.privatecontracts.ContractException){pages.clear()}
    val page=pages.firstOrNull()?:"null"
    events.add(runtimeEventToJson(session.shutdown()));events.add(runtimeEventToJson(session.invoke(runtimeRequestFromJson(parts[3]))));
    println("{\"events\":[${events.joinToString(",")}],\"page\":$page,\"pages\":[${pages.joinToString(",")}],\"writes\":${backend.writes}}")
    session.close()
}}
