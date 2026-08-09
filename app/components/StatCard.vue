<script setup lang="ts">
defineProps<{
  label: string
  value: string
  hint?: string
  tone?: 'default' | 'positive' | 'negative'
}>()
</script>

<template>
  <div class="card stat">
    <span class="label">{{ label }}</span>
    <span class="stat-value numeric" :class="`tone-${tone ?? 'default'}`">{{ value }}</span>
    <span v-if="hint" class="tiny muted">{{ hint }}</span>
  </div>
</template>

<style scoped>
.stat { display: flex; flex-direction: column; gap: 6px; }

.stat-value {
  font-size: 1.42rem;
  font-weight: 680;
  letter-spacing: -0.02em;
  line-height: 1.2;
}

.tone-positive { color: var(--success); }
.tone-negative { color: var(--danger); }
</style>
