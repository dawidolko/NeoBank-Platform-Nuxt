<script setup lang="ts">
defineProps<{
  icon?: string
  title: string
  description?: string
}>()
</script>

<template>
  <div class="empty">
    <div class="empty-icon">{{ icon ?? '📭' }}</div>
    <p class="empty-title">{{ title }}</p>
    <p v-if="description" class="small muted">{{ description }}</p>
    <div v-if="$slots.action" class="empty-action">
      <slot name="action" />
    </div>
  </div>
</template>

<style scoped>
.empty-title { font-weight: 600; color: var(--text); margin-bottom: 4px; }
.empty-action { margin-top: 16px; }
</style>
