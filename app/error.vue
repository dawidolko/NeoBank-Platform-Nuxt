<script setup lang="ts">
import type { NuxtError } from '#app'

const props = defineProps<{ error: NuxtError }>()

const title = computed(() => {
  if (props.error.statusCode === 404) return 'Page not found'
  if (props.error.statusCode === 403) return 'Access denied'

  return 'Something went wrong'
})

const description = computed(() => {
  if (props.error.statusCode === 404) return 'The page you are looking for does not exist.'
  if (props.error.statusCode === 403) return 'You do not have permission to view this page.'

  return props.error.statusMessage || 'An unexpected error occurred. Please try again.'
})
</script>

<template>
  <div class="error-shell">
    <div class="error-card card">
      <p class="error-code">{{ error.statusCode }}</p>
      <h1>{{ title }}</h1>
      <p class="muted">{{ description }}</p>
      <button class="btn" type="button" @click="clearError({ redirect: '/dashboard' })">
        Back to dashboard
      </button>
    </div>
  </div>
</template>

<style scoped>
.error-shell {
  min-height: 100dvh;
  display: grid;
  place-items: center;
  padding: 20px;
  background: var(--bg);
}

.error-card {
  max-width: 420px;
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: 13px;
  align-items: center;
  padding: 36px 28px;
}

.error-code {
  font-size: 2.6rem;
  font-weight: 700;
  color: var(--primary);
  line-height: 1;
}
</style>
