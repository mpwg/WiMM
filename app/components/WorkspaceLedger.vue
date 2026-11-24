<script setup lang="ts">
import type { Problem, Session, Workspace } from '~/utils/ledger'
import { workspaceApi } from '~/utils/ledger'

const props = defineProps<{
  workspace: Workspace
  session: Session
  isCurrent: (workspaceId: string, csrfToken: string) => boolean
}>()
const emit = defineEmits<{ unauthorized: [problem: Problem] }>()
const route = useRoute()
const api = workspaceApi(props.workspace, props.session, problem => emit('unauthorized', problem),
  () => props.isCurrent(props.workspace.id, props.session.csrfToken))
</script>

<template>
  <ResourceDirectory v-if="route.query.ansicht === 'konten'" :api="api" :workspace="workspace" kind="accounts" />
  <ResourceDirectory v-else-if="route.query.ansicht === 'kategorien'" :api="api" :workspace="workspace" kind="categories" />
  <CsvImport v-else-if="route.query.ansicht === 'import' && workspace.role !== 'reader'" :api="api" :workspace="workspace" />
  <BookingLedger v-else :api="api" :workspace="workspace" />
</template>
