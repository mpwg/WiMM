<script setup lang="ts">
import type { Problem } from '~/utils/ledger'

defineProps<{ problem: Problem }>()

const labels: Record<string, string> = {
  accountId: 'Konto',
  amountCents: 'Betrag',
  categoryId: 'Kategorie',
  date: 'Datum',
  description: 'Beschreibung',
  from: 'Von',
  name: 'Name',
  to: 'Bis',
  dateColumn: 'Datumsspalte',
  amountColumn: 'Betragsspalte',
  descriptionColumn: 'Beschreibungsspalte',
  categoryColumn: 'Kategoriespalte',
}
</script>

<template>
  <div class="notice error" role="alert">
    <p>{{ problem.message }}</p>
    <ul v-if="problem.fields && Object.keys(problem.fields).length">
      <li v-for="(value, field) in problem.fields" :key="field">
        <strong v-if="labels[field]">{{ labels[field] }} </strong>{{ [value].flat().join(' ') }}
      </li>
    </ul>
  </div>
</template>
