<script setup lang="ts">
const props = defineProps<{ status: string }>()

/** Maps every enum value the API can return onto a badge tone. */
const TONES: Record<string, string> = {
  COMPLETED: 'badge-success',
  ACTIVE: 'badge-success',
  PENDING: 'badge-warning',
  FROZEN: 'badge-warning',
  SUSPENDED: 'badge-warning',
  FAILED: 'badge-danger',
  CLOSED: 'badge-danger',
  BLOCKED: 'badge-danger',
  REVERSED: 'badge-danger',
  EXPIRED: 'badge-danger',
  ADMIN: 'badge-primary',
}

const toneClass = computed(() => TONES[props.status] ?? '')
const label = computed(() => props.status.charAt(0) + props.status.slice(1).toLowerCase())
</script>

<template>
  <span class="badge" :class="toneClass">{{ label }}</span>
</template>
