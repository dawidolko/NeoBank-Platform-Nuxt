<script setup lang="ts">
withDefaults(
  defineProps<{
    label: string
    value: string
    hint?: string
    tone?: 'default' | 'positive' | 'negative'
    icon?: string
    trend?: Array<{ date: string; balanceCents: string | number | bigint }>
  }>(),
  { hint: undefined, tone: 'default', icon: undefined, trend: undefined },
)
</script>

<template>
  <div class="card stat">
    <div class="stat-head">
      <span class="label">{{ label }}</span>
      <span v-if="icon" class="stat-icon"><AppIcon :name="icon as never" :size="15" /></span>
    </div>

    <span class="stat-value numeric" :class="`tone-${tone}`">{{ value }}</span>
    <span v-if="hint" class="tiny subtle">{{ hint }}</span>

    <div v-if="trend?.length" class="stat-spark">
      <SparkLine :points="trend" :tone="tone === 'negative' ? 'danger' : 'success'" :height="40" />
    </div>
  </div>
</template>

<style scoped>
.stat { display: flex; flex-direction: column; gap: var(--space-1); }

.stat-head { display: flex; align-items: center; justify-content: space-between; gap: var(--space-2); }

.stat-icon {
  display: grid;
  place-items: center;
  width: 26px;
  height: 26px;
  border-radius: var(--radius-xs);
  background: var(--surface-muted);
  color: var(--text-muted);
}

.stat-value {
  font-size: var(--text-xl);
  font-weight: var(--weight-bold);
  letter-spacing: -0.02em;
  line-height: 1.2;
  margin-top: var(--space-1);
}

.tone-positive { color: var(--success); }
.tone-negative { color: var(--danger); }

.stat-spark { height: 40px; margin-top: var(--space-2); }
</style>
