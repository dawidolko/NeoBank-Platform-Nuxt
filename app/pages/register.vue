<script setup lang="ts">
definePageMeta({ layout: 'auth' })

useHead({ title: 'Open an account — NeoBank' })

const { register } = useAuth()

const form = reactive({
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  password: '',
})
const errors = ref<Record<string, string>>({})
const submitting = ref(false)

/** Mirrors the server rules in server/utils/validation.ts. */
const passwordChecks = computed(() => [
  { label: 'At least 10 characters', met: form.password.length >= 10 },
  { label: 'One lowercase letter', met: /[a-z]/.test(form.password) },
  { label: 'One uppercase letter', met: /[A-Z]/.test(form.password) },
  { label: 'One digit', met: /\d/.test(form.password) },
])

async function onSubmit() {
  submitting.value = true
  errors.value = {}

  try {
    await register({
      firstName: form.firstName,
      lastName: form.lastName,
      email: form.email,
      password: form.password,
      phone: form.phone || undefined,
    })
    await navigateTo('/dashboard')
  } catch (error) {
    const data = (error as { data?: { data?: { errors?: Record<string, string> } } }).data?.data
    errors.value = data?.errors ?? { form: 'Unable to create the account. Please try again.' }
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="stack form-wrap">
    <div>
      <h1>Open your account</h1>
      <p class="muted small">A personal PLN account is created for you straight away.</p>
    </div>

    <div v-if="errors.form" class="alert alert-error">{{ errors.form }}</div>

    <form class="stack" novalidate @submit.prevent="onSubmit">
      <div class="grid grid-2 name-grid">
        <div class="field">
          <label class="field-label" for="firstName">First name</label>
          <input
            id="firstName"
            v-model="form.firstName"
            class="input"
            :class="{ 'has-error': errors.firstName }"
            autocomplete="given-name"
            required
          >
          <span v-if="errors.firstName" class="field-error">{{ errors.firstName }}</span>
        </div>

        <div class="field">
          <label class="field-label" for="lastName">Last name</label>
          <input
            id="lastName"
            v-model="form.lastName"
            class="input"
            :class="{ 'has-error': errors.lastName }"
            autocomplete="family-name"
            required
          >
          <span v-if="errors.lastName" class="field-error">{{ errors.lastName }}</span>
        </div>
      </div>

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
        <label class="field-label" for="phone">Phone number <span class="muted">(optional)</span></label>
        <input
          id="phone"
          v-model="form.phone"
          class="input"
          :class="{ 'has-error': errors.phone }"
          type="tel"
          autocomplete="tel"
          placeholder="+48 600 100 200"
        >
        <span v-if="errors.phone" class="field-error">{{ errors.phone }}</span>
      </div>

      <div class="field">
        <label class="field-label" for="password">Password</label>
        <input
          id="password"
          v-model="form.password"
          class="input"
          :class="{ 'has-error': errors.password }"
          type="password"
          autocomplete="new-password"
          required
        >
        <ul v-if="form.password" class="checks">
          <li v-for="check in passwordChecks" :key="check.label" :class="{ met: check.met }">
            {{ check.met ? '✓' : '○' }} {{ check.label }}
          </li>
        </ul>
        <span v-if="errors.password" class="field-error">{{ errors.password }}</span>
      </div>

      <button class="btn btn-block" type="submit" :disabled="submitting">
        <span v-if="submitting" class="spinner" />
        {{ submitting ? 'Creating account…' : 'Open account' }}
      </button>
    </form>

    <p class="small muted">
      Already have an account? <NuxtLink to="/login">Sign in</NuxtLink>
    </p>
  </div>
</template>

<style scoped>
.form-wrap { max-width: 430px; width: 100%; }
.name-grid { gap: 12px; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); }

.checks {
  list-style: none;
  margin: 4px 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
  font-size: 0.76rem;
  color: var(--text-muted);
}

.checks .met { color: var(--success); }
</style>
