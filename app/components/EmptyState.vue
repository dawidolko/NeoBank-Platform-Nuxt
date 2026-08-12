<script setup lang="ts">
withDefaults(
  defineProps<{
    icon?: string
    title: string
    description?: string
  }>(),
  { icon: 'inbox', description: undefined },
)
</script>

<template>
  <div class="empty">
    <span class="empty-icon"><AppIcon :name="icon as never" :size="26" /></span>
    <p class="empty-title">{{ title }}</p>
    <p v-if="description" class="small muted empty-text">{{ description }}</p>
    <div v-if="$slots.action" class="empty-action">
      <slot name="action" />
    </div>
  </div>
</template>

<style scoped>
.empty { display: flex; flex-direction: column; align-items: center; }

.empty-icon {
  display: grid;
  place-items: center;
  width: 52px;
  height: 52px;
  margin-bottom: var(--space-4);
  border-radius: var(--radius-full);
  background: var(--surface-muted);
  color: var(--text-subtle);
}

.empty-title { font-weight: var(--weight-semibold); color: var(--text); }
.empty-text { max-width: 40ch; margin-top: var(--space-1); }
.empty-action { margin-top: var(--space-4); }
</style>
