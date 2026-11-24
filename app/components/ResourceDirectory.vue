<script setup lang="ts">
import type { Problem, Resource, Workspace, WorkspaceApi } from '~/utils/ledger'
import { readProblem, uncertainWrite, writeProblem } from '~/utils/ledger'

const props = defineProps<{ api: WorkspaceApi; workspace: Workspace; kind: 'accounts' | 'categories' }>()
const path = '/' + props.kind
const labels = props.kind === 'accounts'
  ? { heading: 'Konten', create: 'Konto anlegen', change: 'Konto bearbeiten', archived: 'Konto archiviert.', saved: 'Konto gespeichert.', created: 'Konto angelegt.', empty: 'In diesem Bereich gibt es noch keine Konten.', archive: 'Konto archivieren', archiveCopy: 'Das Konto bleibt in vorhandenen Buchungen sichtbar.' }
  : { heading: 'Kategorien', create: 'Kategorie anlegen', change: 'Kategorie bearbeiten', archived: 'Kategorie archiviert.', saved: 'Kategorie gespeichert.', created: 'Kategorie angelegt.', empty: 'In diesem Bereich gibt es noch keine Kategorien.', archive: 'Kategorie archivieren', archiveCopy: 'Die Kategorie bleibt in vorhandenen Buchungen sichtbar.' }
const items = shallowRef<Resource[]>([])
const draft = shallowRef<Resource | null>()
const readFailure = shallowRef<Problem>()
const formFailure = shallowRef<Problem>()
const name = ref('')
const loading = ref(true)
const busy = ref(false)
const confirmArchive = ref(false)
const status = ref('')
const owner = computed(() => props.workspace.role === 'owner')
const archiveCancel = useTemplateRef('archiveCancel')
const input = useTemplateRef('name')
const dialog = useTemplateRef('dialog')

async function load() {
  loading.value = true
  readFailure.value = undefined
  try {
    items.value = await props.api.request<Resource[]>(path)
  } catch (error) {
    readFailure.value = readProblem(error)
    items.value = []
  } finally {
    loading.value = false
  }
}

function edit(item: Resource | null) {
  draft.value = item
  name.value = item?.name ?? ''
  formFailure.value = undefined
  confirmArchive.value = false
}

async function askToArchive() {
  confirmArchive.value = true
  await nextTick()
  archiveCancel.value?.focus()
}

async function save(archive = false) {
  if (busy.value) return
  if (!archive && !name.value.trim()) {
    formFailure.value = { status: 422, code: '', message: 'Gib einen Namen ein.' }
    input.value?.focus()
    return
  }
  const target = draft.value
  busy.value = true
  formFailure.value = undefined
  status.value = ''
  try {
    if (target) await props.api.request(`${path}/${target.id}`, { method: 'PATCH', body: archive ? { archived: true } : { name: name.value.trim() } })
    else await props.api.request(path, { method: 'POST', body: { name: name.value.trim() } })
    status.value = archive ? labels.archived : target ? labels.saved : labels.created
    dialog.value?.dismiss()
    draft.value = undefined
    await load()
  } catch (error) {
    formFailure.value = writeProblem(error)
    if (uncertainWrite(formFailure.value) || formFailure.value.status === 404) await load()
  } finally {
    busy.value = false
  }
}

onMounted(load)
</script>

<template>
  <header class="page-heading">
    <div>
      <p class="workspace-name">{{ workspace.name }}</p>
      <h1>{{ labels.heading }}</h1>
    </div>
    <UButton v-if="owner" class="action primary" icon="i-lucide-plus" @click="edit(null)">{{ labels.create }}</UButton>
  </header>
  <p v-if="status" class="notice success" role="status">{{ status }}</p>
  <p v-if="loading" class="state" role="status">{{ labels.heading }} werden geladen …</p>
  <template v-else-if="readFailure">
    <ProblemNotice :problem="readFailure" />
    <UButton class="action secondary" @click="load">Erneut versuchen</UButton>
  </template>
  <p v-else-if="!items.length" class="state">{{ labels.empty }}</p>
  <ul v-else class="directory-list">
    <li v-for="item in items" :key="item.id">
      <span class="resource-name">{{ item.name }}</span>
      <span v-if="item.archived" class="resource-status">Archiviert</span>
      <UButton v-else-if="owner" class="action secondary" icon="i-lucide-pencil" :aria-label="`${item.name} bearbeiten`" @click="edit(item)">Bearbeiten</UButton>
    </li>
  </ul>

  <LedgerDialog
    v-if="draft !== undefined"
    ref="dialog"
    v-slot="{ close }"
    :title="draft ? labels.change : labels.create"
    :busy="busy"
    @close="draft = undefined"
  >
    <ProblemNotice v-if="formFailure" :problem="formFailure" />
    <template v-if="confirmArchive">
      <p>{{ labels.archiveCopy }}</p>
      <div class="actions">
        <button ref="archiveCancel" class="action secondary" type="button" :disabled="busy" @click="confirmArchive = false">Behalten</button>
        <UButton class="action danger-solid" :disabled="busy" @click="save(true)">{{ labels.archive }}</UButton>
      </div>
    </template>
    <form
      v-else
      :action="draft ? api.base + path + '/' + draft.id : api.base + path"
      method="post"
      :aria-label="draft ? labels.change : labels.create"
      class="stack"
      @submit.prevent="save()"
    >
      <label class="field">
        <span>Name *</span>
        <input ref="name" v-model="name" name="name" required maxlength="120" autofocus @input="formFailure = undefined">
      </label>
      <div class="actions">
        <UButton class="action primary" type="submit" :disabled="busy">{{ draft ? 'Änderungen speichern' : labels.create }}</UButton>
        <UButton class="action secondary" type="button" :disabled="busy" @click="close">Schließen</UButton>
      </div>
    </form>
    <UButton v-if="draft && !confirmArchive" class="action danger" icon="i-lucide-archive" :disabled="busy" @click="askToArchive">
      {{ labels.archive }}
    </UButton>
  </LedgerDialog>
</template>
