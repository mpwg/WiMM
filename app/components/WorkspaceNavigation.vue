<script setup lang="ts">
import type { Workspace } from '~/utils/ledger'

defineProps<{ workspace: Workspace }>()
const route = useRoute()
const links = [
  { key: '', label: 'Buchungen', icon: 'i-lucide-list' },
  { key: 'konten', label: 'Konten', icon: 'i-lucide-wallet' },
  { key: 'kategorien', label: 'Kategorien', icon: 'i-lucide-tags' },
  { key: 'import', label: 'CSV-Import', icon: 'i-lucide-upload' },
]
</script>

<template>
  <nav aria-label="Bereichsansichten" class="rail-navigation">
    <NuxtLink
      v-for="item in links.filter(link => link.key !== 'import' || workspace.role !== 'reader')"
      :key="item.key"
      :to="{ path: '/', query: item.key ? { ansicht: item.key } : {} }"
      :aria-current="(route.query.ansicht || '') === item.key ? 'page' : undefined"
      :aria-label="item.label"
    >
      <UIcon :name="item.icon" aria-hidden="true" />
      <span>{{ item.label }}</span>
    </NuxtLink>
  </nav>
</template>
