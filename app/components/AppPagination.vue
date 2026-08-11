<script setup lang="ts">
const props = defineProps<{
  page: number
  pages: number
  total: number
  /** Plural noun for the paged records, e.g. "transactions". */
  label: string
}>()

const emit = defineEmits<{ 'update:page': [value: number] }>()

const canPrevious = computed(() => props.page > 1)
const canNext = computed(() => props.page < props.pages)
</script>

<template>
  <nav v-if="pages > 1" class="pagination" :aria-label="`${label} pagination`">
    <button
      class="btn btn-secondary btn-sm"
      type="button"
      :disabled="!canPrevious"
      :aria-label="`Previous page of ${label}`"
      @click="emit('update:page', page - 1)"
    >
      Previous
    </button>

    <span class="small muted" aria-live="polite">
      Page {{ page }} of {{ pages }} · {{ total }} {{ label }}
    </span>

    <button
      class="btn btn-secondary btn-sm"
      type="button"
      :disabled="!canNext"
      :aria-label="`Next page of ${label}`"
      @click="emit('update:page', page + 1)"
    >
      Next
    </button>
  </nav>
</template>

<style scoped>
.pagination {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding-top: 15px;
  margin-top: 6px;
  border-top: 1px solid var(--border);
  flex-wrap: wrap;
}
</style>
