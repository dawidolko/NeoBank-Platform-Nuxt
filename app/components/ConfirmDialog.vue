<script setup lang="ts">
withDefaults(
  defineProps<{
    open: boolean
    title: string
    description?: string
    confirmLabel?: string
    cancelLabel?: string
    tone?: 'primary' | 'danger'
    pending?: boolean
  }>(),
  {
    description: undefined,
    confirmLabel: 'Confirm',
    cancelLabel: 'Cancel',
    tone: 'primary',
    pending: false,
  },
)

const emit = defineEmits<{ confirm: []; cancel: [] }>()
</script>

<template>
  <AppModal :open="open" :title="title" :description="description" @close="emit('cancel')">
    <template #footer>
      <button class="btn btn-secondary" type="button" :disabled="pending" @click="emit('cancel')">
        {{ cancelLabel }}
      </button>
      <button
        class="btn"
        :class="tone === 'danger' ? 'btn-danger' : ''"
        type="button"
        :disabled="pending"
        @click="emit('confirm')"
      >
        <span v-if="pending" class="spinner" />
        {{ pending ? 'Working…' : confirmLabel }}
      </button>
    </template>
  </AppModal>
</template>
