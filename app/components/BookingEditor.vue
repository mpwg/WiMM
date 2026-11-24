<script setup lang="ts">
import type { BookingDetail, BookingInput, Problem, Receipt, Resource, WorkspaceApi } from '~/utils/ledger'
import { formatDate, formatMoney, formatSize, inputMoney, parseMoney, readProblem, today, uncertainWrite, writeProblem } from '~/utils/ledger'

const props = defineProps<{
  id: string | null
  api: WorkspaceApi
  accounts: Resource[]
  categories: Resource[]
  writable: boolean
}>()
const emit = defineEmits<{ close: []; changed: [message: string]; reconcile: [] }>()
const path = props.id ? `/bookings/${props.id}` : '/bookings'
const booking = shallowRef<BookingDetail>()
const receiptFile = shallowRef<File>()
const problem = shallowRef<Problem>()
const detailFailure = shallowRef<Problem>()
const loading = ref(Boolean(props.id))
const busy = ref(false)
const conflict = ref(false)
const removingBooking = ref(false)
const removingReceipt = ref<string>()
const status = ref('')
const amountError = ref('')
const amountFieldId = useId()
const amountHelpId = useId()
const amountErrorId = useId()
const amountField = useTemplateRef('amountField')
const cancelDeletion = useTemplateRef('cancelDeletion')
const receiptField = useTemplateRef('receiptField')
const receiptFieldId = useId()
const receiptHelpId = useId()
const dialog = useTemplateRef('dialog')
const fields = reactive({
  date: today(),
  accountId: props.accounts.find(item => !item.archived)?.id ?? '',
  categoryId: '',
  expense: 'expense',
  amount: '',
  description: '',
})

const accountsForBooking = computed(() => props.accounts.filter(item => !item.archived || item.id === booking.value?.accountId))
const categoriesForBooking = computed(() => props.categories.filter(item => !item.archived || item.id === booking.value?.categoryId))
const title = computed(() => !props.id ? 'Neue Buchung' : props.writable ? 'Buchung bearbeiten' : 'Buchung')

async function loadBooking(replaceDraft = true) {
  if (!props.id) return
  loading.value = true
  detailFailure.value = undefined
  try {
    const latest = await props.api.request<BookingDetail>(path)
    if (!replaceDraft && latest.version !== booking.value?.version) conflict.value = true
    booking.value = latest
    if (replaceDraft) {
      Object.assign(fields, {
        date: latest.date,
        accountId: latest.accountId,
        categoryId: latest.categoryId ?? '',
        expense: latest.amountCents.startsWith('-') ? 'expense' : 'income',
        amount: inputMoney(latest.amountCents),
        description: latest.description,
      })
      conflict.value = false
      problem.value = undefined
      amountError.value = ''
    }
  } catch (error) {
    detailFailure.value = readProblem(error)
  } finally {
    loading.value = false
  }
}

function handleWriteFailure(error: unknown) {
  const failure = writeProblem(error)
  problem.value = failure
  if (failure.status === 409 || failure.code === 'version_conflict') {
    conflict.value = true
    removingBooking.value = false
  }
  if (uncertainWrite(failure) || failure.status === 409 || failure.status === 404) {
    emit('reconcile')
    if (props.id && !conflict.value) void loadBooking(false)
  }
}

function changed(message: string) {
  dialog.value?.dismiss()
  emit('changed', message)
}

function validateAmount() {
  const cents = parseMoney(fields.amount, fields.expense === 'expense')
  amountError.value = cents ? '' : 'Gib einen Betrag größer als null mit höchstens zwei Nachkommastellen ein.'
  return cents
}

function clearAmountError() {
  if (amountError.value && parseMoney(fields.amount, fields.expense === 'expense')) amountError.value = ''
}

async function save() {
  if (busy.value || conflict.value) return
  const amountCents = validateAmount()
  if (!amountCents) {
    await nextTick()
    amountField.value?.focus()
    return
  }
  const body: BookingInput = {
    accountId: fields.accountId,
    categoryId: fields.categoryId || null,
    date: fields.date,
    amountCents,
    description: fields.description,
  }
  busy.value = true
  problem.value = undefined
  try {
    if (booking.value) {
      await props.api.request(path, { method: 'PATCH', body: { ...body, version: booking.value.version } })
      changed('Buchung gespeichert.')
    } else {
      await props.api.request(path, { method: 'POST', body: { ...body } })
      changed('Buchung angelegt.')
    }
  } catch (error) {
    handleWriteFailure(error)
  } finally {
    busy.value = false
  }
}

async function askToRemove() {
  removingBooking.value = true
  await nextTick()
  cancelDeletion.value?.focus()
}

async function removeBooking() {
  if (!booking.value || busy.value || conflict.value) return
  busy.value = true
  problem.value = undefined
  try {
    await props.api.request(path, {
      method: 'DELETE',
      headers: { 'If-Match': `"${booking.value.version}"` },
    })
    changed('Buchung gelöscht.')
  } catch (error) {
    handleWriteFailure(error)
  } finally {
    busy.value = false
  }
}

function selectReceipt(event: Event) {
  receiptFile.value = (event.currentTarget as HTMLInputElement).files?.[0]
}

async function uploadReceipt() {
  if (!receiptFile.value || busy.value) return
  if (receiptFile.value.size > 10 * 1024 * 1024) {
    problem.value = { status: 413, code: '', message: 'Wähle einen Beleg mit höchstens 10 MiB.' }
    receiptField.value?.focus()
    return
  }
  busy.value = true
  status.value = ''
  problem.value = undefined
  const form = new FormData()
  form.append('file', receiptFile.value)
  try {
    await props.api.request(path + '/receipts', { method: 'POST', body: form })
    receiptFile.value = undefined
    if (receiptField.value) receiptField.value.value = ''
    status.value = 'Beleg hinzugefügt.'
    await loadBooking(false)
  } catch (error) {
    handleWriteFailure(error)
  } finally {
    busy.value = false
  }
}

async function downloadReceipt(receipt: Receipt) {
  if (busy.value) return
  busy.value = true
  problem.value = undefined
  try {
    await props.api.download(`/receipts/${receipt.id}`, receipt.originalName)
  } catch (error) {
    problem.value = readProblem(error)
  } finally {
    busy.value = false
  }
}

async function removeReceipt(receiptId: string) {
  if (busy.value) return
  busy.value = true
  problem.value = undefined
  status.value = ''
  try {
    await props.api.request(`/receipts/${receiptId}`, { method: 'DELETE' })
    removingReceipt.value = undefined
    status.value = 'Beleg entfernt.'
    await loadBooking(false)
  } catch (error) {
    handleWriteFailure(error)
  } finally {
    busy.value = false
  }
}

onMounted(() => loadBooking())
</script>

<template>
  <LedgerDialog ref="dialog" v-slot="{ close }" :title="title" :busy="busy" @close="emit('close')">
    <p v-if="loading && !booking" class="state" role="status">Buchung wird geladen …</p>
    <template v-if="detailFailure">
      <ProblemNotice :problem="detailFailure" />
      <UButton class="action secondary" :disabled="loading || busy" @click="loadBooking()">Buchung neu laden</UButton>
    </template>
    <ProblemNotice v-if="problem" :problem="problem" />
    <div v-if="conflict" class="notice error">
      <p role="alert">Die Buchung wurde inzwischen geändert. Lade die aktuelle Version, um weiterzuarbeiten.</p>
      <UButton class="action secondary" :disabled="loading || busy" @click="loadBooking()">Aktuelle Version laden</UButton>
    </div>

    <template v-if="writable && (!id || booking) && !removingBooking">
      <form
        :action="api.base + path"
        method="post"
        :aria-label="title"
        class="stack"
        @submit.prevent="save"
      >
        <fieldset class="inline-choice">
          <legend>Art</legend>
          <label><input v-model="fields.expense" name="type" type="radio" value="expense" @change="clearAmountError"> Ausgabe</label>
          <label><input v-model="fields.expense" name="type" type="radio" value="income" @change="clearAmountError"> Einnahme</label>
        </fieldset>
        <div class="form-grid">
          <div class="field">
            <label :for="amountFieldId">Betrag in Euro *</label>
            <span :id="amountHelpId" class="muted">Zum Beispiel 12,50</span>
            <input
              :id="amountFieldId"
              ref="amountField"
              autofocus
              v-model="fields.amount"
              name="amountCents"
              inputmode="decimal"
              autocomplete="off"
              maxlength="20"
              required
              :aria-describedby="[amountHelpId, amountError ? amountErrorId : ''].filter(Boolean).join(' ')"
              :aria-invalid="Boolean(amountError)"
              @blur="fields.amount && validateAmount()"
              @input="clearAmountError"
            >
            <span v-if="amountError" :id="amountErrorId" class="error-copy">{{ amountError }}</span>
          </div>
          <label class="field">
            <span>Datum *</span>
            <input v-model="fields.date" type="date" name="date" required>
          </label>
          <label class="field">
            <span>Konto *</span>
            <select v-model="fields.accountId" name="accountId" required>
              <option disabled value="">Konto wählen</option>
              <option v-for="item in accountsForBooking" :key="item.id" :value="item.id">
                {{ item.name }}{{ item.archived ? ' (archiviert)' : '' }}
              </option>
            </select>
          </label>
          <label class="field">
            <span>Kategorie</span>
            <select v-model="fields.categoryId" name="categoryId">
              <option value="">Ohne Kategorie</option>
              <option v-for="item in categoriesForBooking" :key="item.id" :value="item.id">
                {{ item.name }}{{ item.archived ? ' (archiviert)' : '' }}
              </option>
            </select>
          </label>
        </div>
        <label class="field">
          <span>Beschreibung</span>
          <textarea v-model="fields.description" name="description" maxlength="2000" rows="2" />
        </label>
        <div class="actions">
          <UButton class="action primary" type="submit" :disabled="busy || loading || conflict">
            {{ busy ? 'Bitte warten …' : id ? 'Änderungen speichern' : 'Buchung anlegen' }}
          </UButton>
          <UButton class="action secondary" type="button" :disabled="busy" @click="close">Schließen</UButton>
        </div>
      </form>
    </template>
    <dl v-else-if="booking && !removingBooking" class="detail-list">
      <div><dt>Beschreibung</dt><dd>{{ booking.description || 'Ohne Beschreibung' }}</dd></div>
      <div><dt>Betrag</dt><dd>{{ formatMoney(booking.amountCents) }}</dd></div>
      <div><dt>Datum</dt><dd>{{ formatDate(booking.date) }}</dd></div>
      <div><dt>Konto</dt><dd>{{ accounts.find(item => item.id === booking?.accountId)?.name || 'Konto' }}</dd></div>
      <div><dt>Kategorie</dt><dd>{{ categories.find(item => item.id === booking?.categoryId)?.name || 'Ohne Kategorie' }}</dd></div>
    </dl>

    <section v-if="booking && !removingBooking" class="dialog-section" aria-labelledby="receipt-heading">
      <h2 id="receipt-heading">Belege</h2>
      <p v-if="status" class="notice success" role="status">{{ status }}</p>
      <p v-if="!booking.receipts.length" class="muted">Zu dieser Buchung gibt es noch keine Belege.</p>
      <ul v-else class="receipt-list">
        <li v-for="receipt in booking.receipts" :key="receipt.id">
          <div class="receipt-name">
            <strong>{{ receipt.originalName }}</strong>
            <span class="muted">{{ formatSize(receipt.size) }}</span>
          </div>
          <div class="actions">
            <UButton class="action secondary" icon="i-lucide-download" :aria-label="`${receipt.originalName} herunterladen`" :disabled="busy" @click="downloadReceipt(receipt)">Herunterladen</UButton>
            <UButton
              v-if="writable && removingReceipt !== receipt.id"
              class="action danger"
              :aria-label="`${receipt.originalName} entfernen`"
              :disabled="busy"
              @click="removingReceipt = receipt.id"
            >Entfernen</UButton>
            <template v-else-if="writable">
              <UButton class="action secondary" :disabled="busy" @click="removingReceipt = undefined">Behalten</UButton>
              <UButton class="action danger" :disabled="busy" @click="removeReceipt(receipt.id)">Beleg endgültig entfernen</UButton>
            </template>
          </div>
        </li>
      </ul>
      <form
        v-if="writable"
        :action="api.base + path + '/receipts'"
        method="post"
        enctype="multipart/form-data"
        aria-label="Beleg hinzufügen"
        class="stack"
        @submit.prevent="uploadReceipt"
      >
        <div class="field">
          <label :for="receiptFieldId">Belegdatei *</label>
          <span :id="receiptHelpId" class="muted">PDF, JPG oder PNG, bis 10 MiB</span>
          <input :id="receiptFieldId" ref="receiptField" type="file" name="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" :aria-describedby="receiptHelpId" required @change="selectReceipt">
        </div>
        <div><UButton class="action secondary" icon="i-lucide-paperclip" type="submit" :disabled="busy">Beleg hinzufügen</UButton></div>
      </form>
    </section>

    <div v-if="writable && booking" class="dialog-section">
      <template v-if="removingBooking">
        <h2>Buchung löschen?</h2>
        <p>Die Buchung und alle zugehörigen Belege werden dauerhaft gelöscht.</p>
        <div class="actions">
          <button ref="cancelDeletion" class="action secondary" type="button" :disabled="busy" @click="removingBooking = false">Buchung behalten</button>
          <UButton class="action danger-solid" :disabled="busy || conflict" @click="removeBooking">Buchung endgültig löschen</UButton>
        </div>
      </template>
      <UButton v-else class="action danger" icon="i-lucide-trash-2" :disabled="busy || conflict" @click="askToRemove">Buchung löschen</UButton>
    </div>
  </LedgerDialog>
</template>
