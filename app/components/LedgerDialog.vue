<script setup lang="ts">
const props = defineProps<{ title: string; busy?: boolean }>()
const emit = defineEmits<{ close: [] }>()
const dialog = useTemplateRef('dialog')
const heading = useId()

onMounted(() => dialog.value?.showModal())

function dismiss() {
  dialog.value?.close()
}

function close() {
  if (!props.busy) dismiss()
}

defineExpose({ dismiss })
</script>

<template>
  <dialog ref="dialog" :aria-labelledby="heading" class="dialog" @cancel="busy && $event.preventDefault()" @close="emit('close')">
    <div class="dialog-header">
      <h1 :id="heading">{{ title }}</h1>
      <UButton class="action icon-only" icon="i-lucide-x" aria-label="Schließen" :disabled="busy" @click="close" />
    </div>
    <slot :close="close" />
  </dialog>
</template>
