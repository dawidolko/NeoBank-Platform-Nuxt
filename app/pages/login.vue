<script setup lang="ts">
definePageMeta({ layout: 'auth' })

useHead({ title: 'Sign in — NeoBank' })

const { login } = useAuth()
const route = useRoute()
const { errors, submitting, submit } = useFormErrors()

const form = reactive({ email: '', password: '' })

const canSubmit = computed(() => form.email.includes('@') && form.password.length > 0)

async function onSubmit() {
  const user = await submit(
    () => login(form.email, form.password),
    'Unable to sign in. Please try again.',
  )

  if (!user) return

  // Only follow a same-origin path — never an absolute URL from the query.
  const redirect = route.query.redirect
  const target =
    typeof redirect === 'string' && redirect.startsWith('/') && !redirect.startsWith('//')
      ? redirect
      : '/dashboard'

  await navigateTo(target)
}

/** One click to fill the seeded demo accounts. */
function useDemo(role: 'customer' | 'admin') {
  form.email = role === 'admin' ? 'admin@neobank.dev' : 'anna.kowalska@example.com'
  form.password = role === 'admin' ? 'Admin12345!' : 'Customer12345!'
}
</script>

<template>
  <div class="stack form-wrap">
    <div>
      <h1>Welcome back</h1>
      <p class="muted small">Sign in to your NeoBank account.</p>
    </div>

    <div v-if="errors.form" class="alert alert-error" role="alert">{{ errors.form }}</div>

    <form class="stack" novalidate @submit.prevent="onSubmit">
      <div class="field">
        <label class="field-label" for="email">Email address</label>
        <input
          id="email"
          v-model="form.email"
          class="input"
          :class="{ 'has-error': errors.email }"
          type="email"
          autocomplete="email"
          required
        >
        <span v-if="errors.email" class="field-error">{{ errors.email }}</span>
      </div>

      <div class="field">
        <label class="field-label" for="password">Password</label>
        <input
          id="password"
          v-model="form.password"
          class="input"
          :class="{ 'has-error': errors.password }"
          type="password"
          autocomplete="current-password"
          required
        >
        <span v-if="errors.password" class="field-error">{{ errors.password }}</span>
      </div>

      <button class="btn btn-block" type="submit" :disabled="submitting || !canSubmit">
        <span v-if="submitting" class="spinner" aria-hidden="true" />
        {{ submitting ? 'Signing in…' : 'Sign in' }}
      </button>
    </form>

    <div class="demo card">
      <p class="label">Demo accounts</p>
      <div class="row demo-actions">
        <button class="btn btn-secondary btn-sm" type="button" @click="useDemo('customer')">
          Customer
        </button>
        <button class="btn btn-secondary btn-sm" type="button" @click="useDemo('admin')">
          Administrator
        </button>
      </div>
    </div>

    <p class="small muted">
      No account yet? <NuxtLink to="/register">Open one in a minute</NuxtLink>
    </p>
  </div>
</template>

<style scoped>
.form-wrap { max-width: 380px; width: 100%; }
.demo { padding: 14px; display: flex; flex-direction: column; gap: 9px; }
.demo-actions { flex-wrap: wrap; }
</style>
