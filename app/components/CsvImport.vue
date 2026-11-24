<script setup lang="ts">
import type { ImportPreview, Problem, Resource, Workspace, WorkspaceApi } from '~/utils/ledger'
import { formatDate, formatMoney, formatTimestamp, readProblem, uncertainWrite, writeProblem } from '~/utils/ledger'

const props = defineProps<{ api: WorkspaceApi; workspace: Workspace }>()
const accounts = shallowRef<Resource[]>([])
const categories = shallowRef<Resource[]>([])
const file = shallowRef<File>()
const form = reactive({
  accountId: '',
  hasHeader: true,
  delimiter: ';',
  decimalSeparator: ',',
  dateFormat: 'DD.MM.YYYY',
  dateColumn: 1,
  amountColumn: 2,
  descriptionColumn: 3,
  categoryColumn: undefined as number | string | undefined,
})
const categoryMappings = shallowRef<Map<string, string | null>>(new Map())
const loading = ref(true)
const busy = ref(false)
const referenceFailure = shallowRef<Problem>()
const failure = shallowRef<Problem>()
const preview = shallowRef<ImportPreview>()
const previewHeading = useTemplateRef('previewHeading')
const formHeading = useTemplateRef('formHeading')
const fileField = useTemplateRef('fileField')
const fileFieldId = useId()
const fileHelpId = useId()
const linesVisible = ref(30)
const errorsVisible = ref(30)
const categoryNames = computed(() => Object.fromEntries(categories.value.map(item => [item.id, item.name])))
const unresolved = computed(() => [...new Set(preview.value?.errors
  .filter(error => error.field === 'category' && typeof error.value === 'string')
  .map(error => error.value!) ?? [])])
const labels: Record<string, string> = { date: 'Datum', amount: 'Betrag', amountCents: 'Betrag', description: 'Beschreibung', category: 'Kategorie', row: 'Zeile' }

async function loadReferences() {
  loading.value = true
  referenceFailure.value = undefined
  try {
    const values = await Promise.all([
      props.api.request<Resource[]>('/accounts'),
      props.api.request<Resource[]>('/categories'),
    ])
    accounts.value = values[0].filter(item => !item.archived)
    categories.value = values[1].filter(item => !item.archived)
    if (!accounts.value.some(item => item.id === form.accountId)) form.accountId = accounts.value[0]?.id ?? ''
  } catch (error) {
    referenceFailure.value = readProblem(error)
  } finally {
    loading.value = false
  }
}

function chooseFile(event: Event) {
  file.value = (event.currentTarget as HTMLInputElement).files?.[0]
  categoryMappings.value = new Map()
  failure.value = undefined
}

function chooseCategory(value: string, event: Event) {
  const choice = (event.currentTarget as HTMLSelectElement).value
  const next = new Map(categoryMappings.value)
  if (choice === '') next.delete(value)
  else next.set(value, choice === '__none' ? null : choice)
  categoryMappings.value = next
}

async function createPreview() {
  if (!file.value || busy.value) return
  failure.value = undefined
  if (file.value.size > 5 * 1024 * 1024) {
    failure.value = { status: 413, code: '', message: 'Wähle eine CSV-Datei mit höchstens 5 MiB.' }
    return
  }
  const mapping = {
    ...form,
    dateColumn: Number(form.dateColumn) - 1,
    amountColumn: Number(form.amountColumn) - 1,
    descriptionColumn: Number(form.descriptionColumn) - 1,
    categoryColumn: form.categoryColumn ? Number(form.categoryColumn) - 1 : undefined,
    categoryMapping: form.categoryColumn ? Object.fromEntries(categoryMappings.value) : undefined,
  }
  const payload = new FormData()
  payload.append('file', file.value)
  payload.append('mapping', JSON.stringify(mapping))
  busy.value = true
  try {
    preview.value = await props.api.request<ImportPreview>('/imports', { method: 'POST', body: payload })
    linesVisible.value = errorsVisible.value = 30
    await nextTick()
    previewHeading.value?.focus()
  } catch (error) {
    failure.value = readProblem(error)
  } finally {
    busy.value = false
  }
}

function backToMapping() {
  preview.value = undefined
  failure.value = undefined
  void nextTick(() => formHeading.value?.focus())
}

function resetImport() {
  file.value = undefined
  if (fileField.value) fileField.value.value = ''
  categoryMappings.value = new Map()
  backToMapping()
}

async function confirm() {
  if (!preview.value || preview.value.errors.length || preview.value.status === 'confirmed' || busy.value) return
  const path = `/imports/${preview.value.id}`
  busy.value = true
  failure.value = undefined
  try {
    preview.value = await props.api.request<ImportPreview>(path + '/confirm', { method: 'POST' })
  } catch (error) {
    const problem = writeProblem(error)
    failure.value = problem
    if (uncertainWrite(problem)) {
      try {
        preview.value = await props.api.request<ImportPreview>(path)
        if (preview.value.status === 'confirmed') failure.value = undefined
      } catch (readError) {
        if (readProblem(readError).status === 410) failure.value = readProblem(readError)
      }
    }
  } finally {
    busy.value = false
  }
}

onMounted(loadReferences)
</script>

<template>
  <header class="page-heading">
    <div>
      <p class="workspace-name">{{ workspace.name }}</p>
      <h1>CSV-Import</h1>
    </div>
  </header>
  <p v-if="loading" class="state" role="status">Konten und Kategorien werden geladen …</p>
  <template v-else-if="referenceFailure">
    <ProblemNotice :problem="referenceFailure" />
    <UButton class="action secondary" @click="loadReferences">Erneut versuchen</UButton>
  </template>
  <p v-else-if="!accounts.length" class="notice">
    Für einen Import braucht dieser Bereich ein aktives Konto.
    <NuxtLink v-if="workspace.role === 'owner'" :to="{ query: { ansicht: 'konten' } }">Konten verwalten</NuxtLink>
  </p>
  <template v-else>
    <ProblemNotice v-if="failure" :problem="failure" />
    <section v-show="!preview" class="import-panel" aria-labelledby="csv-mapping">
      <h2 id="csv-mapping" ref="formHeading" tabindex="-1">Datei und Spalten</h2>
      <form :action="api.base + '/imports'" method="post" enctype="multipart/form-data" aria-labelledby="csv-mapping" class="stack" @submit.prevent="createPreview">
        <div class="field">
          <label :for="fileFieldId">CSV-Datei *</label>
          <span :id="fileHelpId" class="muted">UTF-8, bis 5 MiB und 5.000 Buchungen</span>
          <input :id="fileFieldId" ref="fileField" type="file" name="file" accept=".csv,text/csv" :aria-describedby="fileHelpId" required @change="chooseFile">
        </div>
        <label class="field">
          <span>Zielkonto *</span>
          <select v-model="form.accountId" name="accountId" required>
            <option v-for="item in accounts" :key="item.id" :value="item.id">{{ item.name }}</option>
          </select>
        </label>

        <fieldset class="stack">
          <legend>CSV-Format</legend>
          <label class="check-field"><input v-model="form.hasHeader" type="checkbox" name="hasHeader"> Erste Zeile enthält Spaltenüberschriften</label>
          <div class="form-grid">
            <label class="field">
              <span>Trennzeichen</span>
              <select v-model="form.delimiter" name="delimiter">
                <option value=";">Strichpunkt (;)</option><option value=",">Komma (,)</option><option :value="'\t'">Tabulator</option>
              </select>
            </label>
            <label class="field">
              <span>Dezimalzeichen</span>
              <select v-model="form.decimalSeparator" name="decimalSeparator">
                <option value=",">Komma (,)</option><option value=".">Punkt (.)</option>
              </select>
            </label>
            <label class="field">
              <span>Datumsformat</span>
              <select v-model="form.dateFormat" name="dateFormat">
                <option>DD.MM.YYYY</option><option>YYYY-MM-DD</option><option>DD/MM/YYYY</option><option>MM/DD/YYYY</option>
              </select>
            </label>
          </div>
        </fieldset>

        <fieldset class="stack" aria-describedby="csv-columns">
          <legend>Spaltenpositionen</legend>
          <p id="csv-columns" class="muted">Die erste Spalte hat die Nummer 1. Negative Beträge sind Ausgaben.</p>
          <div class="form-grid">
            <label class="field">
              <span>Datum *</span>
              <input v-model.number="form.dateColumn" type="number" name="dateColumn" inputmode="numeric" min="1" step="1" required>
            </label>
            <label class="field">
              <span>Betrag *</span>
              <input v-model.number="form.amountColumn" type="number" name="amountColumn" inputmode="numeric" min="1" step="1" required>
            </label>
            <label class="field">
              <span>Beschreibung *</span>
              <input v-model.number="form.descriptionColumn" type="number" name="descriptionColumn" inputmode="numeric" min="1" step="1" required>
            </label>
            <label class="field">
              <span>Kategorie</span>
              <input v-model.number="form.categoryColumn" type="number" name="categoryColumn" inputmode="numeric" min="1" step="1">
            </label>
          </div>
        </fieldset>
        <div><UButton class="action primary" type="submit" :disabled="busy" icon="i-lucide-file-search">{{ busy ? 'Datei wird geprüft …' : 'Vorschau erstellen' }}</UButton></div>
      </form>
    </section>

    <section v-if="preview" aria-labelledby="csv-preview" class="import-panel">
      <h2 id="csv-preview" ref="previewHeading" tabindex="-1">
        {{ preview.status === 'confirmed' ? 'Import abgeschlossen' : 'Importvorschau' }}
      </h2>
      <template v-if="preview.status === 'confirmed'">
        <p class="notice success" role="status">{{ preview.result?.length ?? preview.rows.length }} Buchungen wurden übernommen.</p>
        <div class="actions">
          <NuxtLink class="action primary" to="/">Zu den Buchungen</NuxtLink>
          <UButton class="action secondary" @click="resetImport">Weitere Datei importieren</UButton>
        </div>
      </template>
      <template v-else>
        <p class="muted">
          Zielkonto {{ accounts.find(item => item.id === preview?.accountId)?.name }}.
          {{ preview.rows.length }} gültige Zeilen.
          Vorschau gültig bis {{ formatTimestamp(preview.expiresAt) }}.
        </p>
        <p v-if="preview.duplicate" class="notice warning" role="status">Dieselbe Datei wurde bereits in dieses Konto importiert. Bei erneuter Übernahme entstehen zusätzliche Buchungen.</p>
        <div v-if="preview.errors.length" class="notice error">
          <h3>{{ preview.errors.length }} Fehler in der Datei</h3>
          <ul class="error-list">
            <li v-for="(error, index) in preview.errors.slice(0, errorsVisible)" :key="index">
              {{ error.row ? `Zeile ${error.row}` : 'Datei' }} · {{ labels[error.field] ?? error.field }}: {{ error.message }}
            </li>
          </ul>
          <UButton v-if="errorsVisible < preview.errors.length" class="action secondary" @click="errorsVisible += 30">Mehr Fehler anzeigen</UButton>
        </div>
        <form
          v-if="unresolved.length"
          :action="api.base + '/imports'"
          method="post"
          aria-labelledby="category-mapping"
          class="stack"
          @submit.prevent="createPreview"
        >
          <h3 id="category-mapping">Unbekannte Kategorien zuordnen</h3>
          <label v-for="(value, index) in unresolved" :key="value" class="field">
            <span>{{ value }} *</span>
            <select :name="`category-${index}`" :value="categoryMappings.has(value) ? categoryMappings.get(value) ?? '__none' : ''" required @change="chooseCategory(value, $event)">
              <option value="" disabled>Zuordnung wählen</option>
              <option value="__none">Ohne Kategorie übernehmen</option>
              <option v-for="item in categories" :key="item.id" :value="item.id">{{ item.name }}</option>
            </select>
          </label>
          <div><UButton class="action secondary" type="submit" :disabled="busy">Vorschau neu erstellen</UButton></div>
        </form>
        <table v-if="preview.rows.length" class="preview-table">
          <thead><tr><th scope="col">Datum</th><th scope="col">Buchung</th><th scope="col">Betrag</th></tr></thead>
          <tbody>
            <tr v-for="line in preview.rows.slice(0, linesVisible)" :key="line.row">
              <td><time :datetime="line.date">{{ formatDate(line.date) }}</time></td>
              <td>{{ line.description || 'Ohne Beschreibung' }}<span class="row-category">{{ line.categoryId ? categoryNames[line.categoryId] : 'Ohne Kategorie' }}</span></td>
              <td>{{ formatMoney(line.amountCents) }}</td>
            </tr>
          </tbody>
        </table>
        <div><UButton v-if="linesVisible < preview.rows.length" class="action secondary" @click="linesVisible += 30">Mehr Zeilen anzeigen</UButton></div>
        <div class="actions">
          <UButton
            v-if="!preview.errors.length && failure?.status !== 410"
            class="action primary"
            :disabled="busy"
            @click="confirm"
          >{{ busy ? 'Import läuft …' : preview.duplicate ? 'Erneut importieren' : 'Buchungen importieren' }}</UButton>
          <UButton class="action secondary" :disabled="busy" @click="backToMapping">Datei und Spalten ändern</UButton>
        </div>
      </template>
    </section>
  </template>
</template>
