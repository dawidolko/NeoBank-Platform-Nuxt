<script setup lang="ts">
defineProps<{
  label: string
  error?: string
  hint?: string
  optional?: boolean
}>()

const id = useId()
const errorId = `${id}-error`
const hintId = `${id}-hint`
</script>

<template>
  <div class="field">
    <label class="field-label" :for="id">
      {{ label }}
      <span v-if="optional" class="muted">(optional)</span>
    </label>

    <slot
      :id="id"
      :invalid="Boolean(error)"
      :described-by="error ? errorId : hint ? hintId : undefined"
    />

    <span v-if="error" :id="errorId" class="field-error" role="alert">{{ error }}</span>
    <span v-else-if="hint" :id="hintId" class="field-hint">{{ hint }}</span>
  </div>
</template>
