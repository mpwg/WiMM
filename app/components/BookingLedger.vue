<script setup lang="ts">
import type { Booking, BookingPage, Problem, Resource, Summary, Workspace, WorkspaceApi } from '~/utils/ledger'
import { formatDate, formatMoney, readProblem } from '~/utils/ledger'

const props = defineProps<{ api: WorkspaceApi; workspace: Workspace }>()
type Filters = { from: string; to: string; accountId: string; categoryId: string }
const emptyFilters = (): Filters => ({ from: '', to: '', accountId: '', categoryId: '' })

const accounts = shallowRef<Resource[]>([])
const categories = shallowRef<Resource[]>([])
const summary = shallowRef<Summary>()
const bookings = shallowRef<Booking[]>([])
const cursor = ref<string | null>(null)
const readFailure = shallowRef<Problem>()
const summaryFailure = shallowRef<Problem>()
const pageFailure = shallowRef<Problem>()
const referenceFailure = shallowRef<Problem>()
const loading = ref(true)
const loadingPage = ref(false)
const loadingReferences = ref(true)
const editId = ref<string | null>()
const status = ref('')
const filterNotice = ref('')
const fields = reactive<Filters>(emptyFilters())
const filters = shallowRef<Filters>(emptyFilters())
const searchOpen = ref(false)
const writable = computed(() => props.workspace.role !== 'reader')
const activeAccount = computed(() => accounts.value.some(account => !account.archived))
const selectedCount = computed(() => Object.values(filters.value).filter(Boolean).length)
const accountNames = computed(() => Object.fromEntries(accounts.value.map(item => [item.id, item.name])))
const categoryNames = computed(() => Object.fromEntries(categories.value.map(item => [item.id, item.name])))
const startField = useTemplateRef('startField')
const filterToggle = useTemplateRef('filterToggle')
const filterHeading = useId()
const filterPanel = useId()
let reading: AbortController | undefined
onScopeDispose(() => reading?.abort())

async function loadReferences() {
  loadingReferences.value = true
  referenceFailure.value = undefined
  try {
    const values = await Promise.all([
      props.api.request<Resource[]>('/accounts'),
      props.api.request<Resource[]>('/categories'),
    ])
    accounts.value = values[0]
    categories.value = values[1]
  } catch (error) {
    referenceFailure.value = readProblem(error)
  } finally {
    loadingReferences.value = false
  }
}

function query() {
  return Object.fromEntries(Object.entries(filters.value).filter(([, value]) => value))
}

async function loadBookings() {
  reading?.abort()
  const current = new AbortController()
  reading = current
  const options = { query: query(), signal: current.signal }
  loading.value = true
  loadingPage.value = false
  bookings.value = []
  summary.value = undefined
  cursor.value = null
  readFailure.value = undefined
  summaryFailure.value = undefined
  pageFailure.value = undefined
  try {
    const [page, totals] = await Promise.allSettled([
      props.api.request<BookingPage>('/bookings', options),
      props.api.request<Summary>('/summary', options),
    ])
    if (reading !== current || current.signal.aborted) return
    if (page.status === 'fulfilled') {
      bookings.value = page.value.items
      cursor.value = page.value.nextCursor
    } else readFailure.value = readProblem(page.reason)
    if (totals.status === 'fulfilled') summary.value = totals.value
    else summaryFailure.value = readProblem(totals.reason)
  } finally {
    if (reading === current) loading.value = false
  }
}

async function nextPage() {
  if (!cursor.value || loadingPage.value || !reading) return
  const current = reading
  loadingPage.value = true
  pageFailure.value = undefined
  try {
    const page = await props.api.request<BookingPage>('/bookings', {
      query: { ...query(), cursor: cursor.value },
      signal: current.signal,
    })
    if (reading !== current || current.signal.aborted) return
    const ids = new Set(bookings.value.map(booking => booking.id))
    bookings.value = [...bookings.value, ...page.items.filter(booking => !ids.has(booking.id))]
    cursor.value = page.nextCursor
  } catch (error) {
    if (reading === current && !current.signal.aborted) pageFailure.value = readProblem(error)
  } finally {
    if (reading === current) loadingPage.value = false
  }
}

function applyFilters() {
  if (fields.from && fields.to && fields.from > fields.to) {
    filterNotice.value = 'Das Anfangsdatum muss vor oder am Enddatum liegen.'
    startField.value?.focus()
    return
  }
  filterNotice.value = ''
  filters.value = { ...fields }
  searchOpen.value = false
  const button = filterToggle.value?.$el as HTMLElement | undefined
  if (button?.offsetParent) button.focus()
  void loadBookings()
}

function resetFilters() {
  Object.assign(fields, emptyFilters())
  applyFilters()
}

function changed(message: string) {
  status.value = message
  editId.value = undefined
  void loadBookings()
}

onMounted(() => {
  void loadReferences()
  void loadBookings()
})
</script>

<template>
  <header class="page-heading">
    <div>
      <p class="workspace-name">{{ workspace.name }}</p>
      <h1>Buchungen</h1>
    </div>
    <UButton
      v-if="writable && activeAccount"
      class="action primary"
      icon="i-lucide-plus"
      @click="editId = null"
    >Neue Buchung</UButton>
  </header>

  <p v-if="status" role="status" class="notice success">{{ status }}</p>
  <ProblemNotice v-if="referenceFailure" :problem="referenceFailure" />
  <UButton v-if="referenceFailure" class="action secondary" @click="loadReferences">Konten und Kategorien neu laden</UButton>
  <p v-else-if="writable && !loadingReferences && !activeAccount" class="notice">
    Für neue Buchungen braucht dieser Bereich ein aktives Konto.
    <NuxtLink v-if="workspace.role === 'owner'" :to="{ query: { ansicht: 'konten' } }">Konten verwalten</NuxtLink>
  </p>

  <ProblemNotice v-if="summaryFailure && !readFailure" :problem="summaryFailure" />
  <dl v-if="summary" class="totals" aria-label="Summen der gefilterten Buchungen">
    <div class="total-balance">
      <dt>Saldo</dt>
      <dd>{{ formatMoney(summary.balanceCents) }}</dd>
    </div>
    <div>
      <dt>Einnahmen</dt>
      <dd class="positive">{{ formatMoney(summary.incomeCents) }}</dd>
    </div>
    <div>
      <dt>Ausgaben</dt>
      <dd>{{ formatMoney(summary.expenseCents) }}</dd>
    </div>
  </dl>

  <div class="ledger-grid">
    <div class="filter-shell">
      <UButton
        ref="filterToggle"
        class="action secondary filter-toggle"
        icon="i-lucide-sliders-horizontal"
        :aria-expanded="searchOpen"
        :aria-controls="filterPanel"
        @click="searchOpen = !searchOpen"
      >Filter{{ selectedCount ? ` (${selectedCount})` : '' }}</UButton>
      <search :id="filterPanel" class="filter-panel" :class="{ 'filter-open': searchOpen }">
        <h2 :id="filterHeading">Filter</h2>
        <form :action="api.base + '/bookings'" method="get" :aria-labelledby="filterHeading" class="stack" @submit.prevent="applyFilters">
          <div class="filter-dates">
            <label class="field">
              <span>Von</span>
              <input ref="startField" v-model="fields.from" type="date" name="from" :aria-invalid="Boolean(filterNotice)" :aria-describedby="filterNotice ? 'filter-date-error' : undefined" @input="filterNotice = ''">
            </label>
            <label class="field">
              <span>Bis</span>
              <input v-model="fields.to" type="date" name="to" @input="filterNotice = ''">
            </label>
          </div>
          <label class="field">
            <span>Konto</span>
            <select v-model="fields.accountId" name="accountId">
              <option value="">Alle Konten</option>
              <option v-for="item in accounts" :key="item.id" :value="item.id">{{ item.name }}</option>
            </select>
          </label>
          <label class="field">
            <span>Kategorie</span>
            <select v-model="fields.categoryId" name="categoryId">
              <option value="">Alle Kategorien</option>
              <option v-for="item in categories" :key="item.id" :value="item.id">{{ item.name }}</option>
            </select>
          </label>
          <p v-if="filterNotice" id="filter-date-error" class="error-copy" role="alert">{{ filterNotice }}</p>
          <div class="actions">
            <UButton class="action primary" type="submit">Anwenden</UButton>
            <UButton class="action secondary" type="button" @click="resetFilters">Zurücksetzen</UButton>
          </div>
        </form>
      </search>
    </div>

    <section class="booking-list" aria-labelledby="booking-list">
      <div class="list-heading">
        <h2 id="booking-list">Buchungsliste</h2>
        <span v-if="bookings.length && !loading" class="muted">{{ bookings.length }} geladen</span>
      </div>
      <p v-if="loading" class="state" role="status">Buchungen werden geladen …</p>
      <template v-else-if="readFailure">
        <ProblemNotice :problem="readFailure" />
        <UButton class="action secondary" @click="loadBookings">Buchungen neu laden</UButton>
      </template>
      <p v-else-if="!bookings.length" class="state">
        {{ selectedCount ? 'Zu diesen Filtern gibt es keine Buchungen.' : 'In diesem Bereich gibt es noch keine Buchungen.' }}
      </p>
      <template v-else>
        <table class="booking-table">
          <thead>
            <tr><th scope="col">Datum</th><th scope="col">Buchung</th><th scope="col">Konto</th><th scope="col">Betrag</th></tr>
          </thead>
          <tbody>
            <tr v-for="booking in bookings" :key="booking.id">
              <td><time :datetime="booking.date">{{ formatDate(booking.date) }}</time></td>
              <td>
                <button type="button" class="booking-link" @click="editId = booking.id">{{ booking.description || 'Ohne Beschreibung' }}</button>
                <span class="row-category">{{ booking.categoryId ? categoryNames[booking.categoryId] || 'Kategorie' : 'Ohne Kategorie' }}</span>
              </td>
              <td>{{ accountNames[booking.accountId] || 'Konto' }}</td>
              <td :class="{ positive: !booking.amountCents.startsWith('-') }">{{ formatMoney(booking.amountCents) }}</td>
            </tr>
          </tbody>
        </table>
        <ProblemNotice v-if="pageFailure" :problem="pageFailure" />
        <UButton v-if="cursor" class="action secondary" :disabled="loadingPage" @click="nextPage">
          {{ loadingPage ? 'Wird geladen …' : 'Mehr Buchungen laden' }}
        </UButton>
      </template>
    </section>
  </div>

  <BookingEditor
    v-if="editId !== undefined"
    :key="editId ?? 'new'"
    :id="editId"
    :api="api"
    :accounts="accounts"
    :categories="categories"
    :writable="writable"
    @close="editId = undefined"
    @changed="changed"
    @reconcile="loadBookings"
  />
</template>
