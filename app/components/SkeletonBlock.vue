<script setup lang="ts">
withDefaults(defineProps<{ rows?: number; height?: string }>(), {
  rows: 3,
  height: '18px',
})
</script>

<template>
  <div class="skeleton-stack" role="status" aria-busy="true" aria-live="polite">
    <span class="visually-hidden">Loading…</span>
    <span
      v-for="row in rows"
      :key="row"
      class="skeleton"
      :style="{ height, width: row === rows ? '65%' : '100%' }"
      aria-hidden="true"
    />
  </div>
</template>

<style scoped>
.skeleton-stack { display: flex; flex-direction: column; gap: 11px; }

.skeleton {
  display: block;
  border-radius: 6px;
  background: linear-gradient(
    90deg,
    var(--surface-muted) 25%,
    var(--border) 50%,
    var(--surface-muted) 75%
  );
  background-size: 200% 100%;
  animation: shimmer 1.4s ease-in-out infinite;
}

@keyframes shimmer {
  from { background-position: 200% 0; }
  to { background-position: -200% 0; }
}

@media (prefers-reduced-motion: reduce) {
  .skeleton { animation: none; }
}
</style>
