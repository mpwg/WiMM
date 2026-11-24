<script setup lang="ts">
import type { Problem, Session } from '~/utils/ledger'
import { readProblem } from '~/utils/ledger'

const route = useRoute()
const session = shallowRef<Session>()
const workspaceId = ref('')
const pending = ref(true)
const loggingOut = ref(false)
const loginProblem = ref('')
const connectionProblem = ref('')
const logoutProblem = ref('')
let sessionRead = 0

const workspace = computed(() => session.value?.workspaces.find(item => item.id === workspaceId.value))
const loginMessage = computed(() => loginProblem.value || ({
  failed: 'Die Anmeldung ist fehlgeschlagen. Versuche es erneut.',
  unavailable: 'Der Anmeldedienst ist derzeit nicht erreichbar. Versuche es später erneut.',
}[String(route.query.login)] ?? ''))

async function loadSession() {
  const request = ++sessionRead
  pending.value = true
  connectionProblem.value = ''
  try {
    const current = await $fetch<Session>('/api/session', { cache: 'no-store', retry: 0 })
    if (request !== sessionRead) return
    workspaceId.value = current.workspaces.some(item => item.id === workspaceId.value)
      ? workspaceId.value
      : current.workspaces[0]?.id ?? ''
    session.value = current
  } catch (error) {
    if (request !== sessionRead) return
    const problem = readProblem(error)
    if (problem.status === 401) endSession(problem, Boolean(session.value))
    else connectionProblem.value = problem.message
  } finally {
    if (request === sessionRead) pending.value = false
  }
}

function endSession(problem: Problem, expired = true) {
  sessionRead++
  pending.value = false
  session.value = undefined
  workspaceId.value = ''
  if (!expired && problem.code !== 'reauth_required') return
  loginProblem.value = 'Deine Sitzung ist abgelaufen. Melde dich erneut an.'
  if (problem.code === 'reauth_required') window.location.assign('/auth/oidc')
}

async function logout() {
  if (!session.value || loggingOut.value) return
  loggingOut.value = true
  logoutProblem.value = ''
  try {
    await $fetch('/api/logout', {
      method: 'POST',
      headers: { 'X-CSRF-Token': session.value.csrfToken },
      retry: 0,
    })
    sessionRead++
    session.value = undefined
    workspaceId.value = ''
    loginProblem.value = ''
    await navigateTo('/', { replace: true })
  } catch (error) {
    const problem = readProblem(error)
    if (problem.status === 401) endSession(problem)
    else {
      logoutProblem.value = 'Die Abmeldung konnte nicht bestätigt werden.'
      session.value = undefined
      await loadSession()
      if (!session.value && !connectionProblem.value) logoutProblem.value = ''
    }
  } finally {
    loggingOut.value = false
  }
}

onMounted(loadSession)
</script>

<template>
  <main v-if="pending || !session" class="entry">
    <div class="entry-panel">
      <div class="brand" aria-label="WiMM">
        <img src="/icons/wimm-192.png" alt="" width="44" height="44">
        <span>WiMM</span>
      </div>
      <h1>Einnahmen und Ausgaben</h1>
      <p class="entry-description">Buchungen, Konten und Belege gemeinsam verwalten.</p>
      <p v-if="pending" role="status" class="state">Sitzung wird geprüft …</p>
      <template v-else-if="connectionProblem">
        <p class="notice error" role="alert">{{ connectionProblem }}</p>
        <UButton class="action primary" @click="loadSession">Erneut versuchen</UButton>
      </template>
      <template v-else>
        <p v-if="loginMessage" class="notice error" role="alert">{{ loginMessage }}</p>
        <UButton class="action primary" icon="i-lucide-log-in" to="/auth/oidc" external>Anmelden</UButton>
      </template>
    </div>
  </main>
  <div v-else class="app-shell">
    <aside class="rail">
      <div class="brand">
        <img src="/icons/wimm-192.png" alt="" width="40" height="40">
        <span>WiMM</span>
      </div>
      <div class="rail-user">
        <p>{{ session.user.displayName }}</p>
        <UButton class="action rail-button" icon="i-lucide-log-out" :disabled="loggingOut" @click="logout">Abmelden</UButton>
      </div>
      <div v-if="session.workspaces.length" class="field rail-field">
        <label for="workspace">Bereich</label>
        <select id="workspace" v-model="workspaceId" name="workspace">
          <option v-for="item in session.workspaces" :key="item.id" :value="item.id">{{ item.name }}</option>
        </select>
      </div>
      <WorkspaceNavigation v-if="workspace" :workspace="workspace" />
    </aside>
    <main class="workspace-main">
      <p v-if="logoutProblem" class="notice error" role="alert">{{ logoutProblem }}</p>
      <WorkspaceLedger
        v-if="workspace && !loggingOut"
        :key="session.user.id + ':' + session.csrfToken + ':' + workspace.id"
        :workspace="workspace"
        :session="session"
        :is-current="(id, token) => id === workspaceId && token === session?.csrfToken && !loggingOut"
        @unauthorized="endSession"
      />
      <p v-else-if="loggingOut" class="state" role="status">Abmeldung läuft …</p>
      <template v-else>
        <h1>Keine Bereiche verfügbar</h1>
        <p class="state">Dein Konto hat derzeit keine Berechtigung für einen Bereich.</p>
      </template>
    </main>
  </div>
</template>
