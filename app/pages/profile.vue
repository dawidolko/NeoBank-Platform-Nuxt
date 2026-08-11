<script setup lang="ts">
useHead({ title: 'Profile — NeoBank' })

const { refresh: refreshAuth } = useAuth()
const { date, dateTime } = useFormat()
const toast = useToast()

const { data, refresh } = await useFetch('/api/profile', { headers: useApiHeaders() })
const { data: sessionData, refresh: refreshSessions } = await useFetch('/api/profile/sessions', {
  headers: useApiHeaders(),
})

const profile = computed(() => data.value?.user)
const sessions = computed(() => sessionData.value?.sessions ?? [])
const otherSessions = computed(() => sessions.value.filter((session) => !session.current))

const details = reactive({ firstName: '', lastName: '', phone: '' })
const detailErrors = useFormErrors()

const password = reactive({ currentPassword: '', newPassword: '', confirmPassword: '' })
const passwordErrors = useFormErrors()

const revoking = ref(false)
const confirmRevoke = ref(false)

watchEffect(() => {
  if (!profile.value) return

  details.firstName = profile.value.firstName
  details.lastName = profile.value.lastName
  details.phone = profile.value.phone ?? ''
})

const passwordChecks = computed(() => [
  { label: 'At least 10 characters', met: password.newPassword.length >= 10 },
  { label: 'One lowercase letter', met: /[a-z]/.test(password.newPassword) },
  { label: 'One uppercase letter', met: /[A-Z]/.test(password.newPassword) },
  { label: 'One digit', met: /\d/.test(password.newPassword) },
])

const passwordReady = computed(
  () =>
    password.currentPassword.length > 0 &&
    passwordChecks.value.every((check) => check.met) &&
    password.newPassword === password.confirmPassword,
)

/** Best-effort device label; the UA string itself is too noisy to show raw. */
function deviceLabel(userAgent: string | null): string {
  if (!userAgent) return 'Unknown device'

  const browser = /Firefox/.test(userAgent)
    ? 'Firefox'
    : /Edg/.test(userAgent)
      ? 'Edge'
      : /Chrome/.test(userAgent)
        ? 'Chrome'
        : /Safari/.test(userAgent)
          ? 'Safari'
          : 'Browser'

  const platform = /iPhone|iPad/.test(userAgent)
    ? 'iOS'
    : /Android/.test(userAgent)
      ? 'Android'
      : /Mac OS/.test(userAgent)
        ? 'macOS'
        : /Windows/.test(userAgent)
          ? 'Windows'
          : /Linux/.test(userAgent)
            ? 'Linux'
            : 'Unknown OS'

  return `${browser} on ${platform}`
}

async function saveDetails() {
  const result = await detailErrors.submit(
    () =>
      $fetch<{ user: { firstName: string } }>('/api/profile', {
        method: 'PATCH',
        body: { ...details, phone: details.phone || undefined },
      }),
    'Could not save your details.',
  )

  if (!result) return

  toast.success('Profile updated')
  await Promise.all([refresh(), refreshAuth()])
}

async function changePassword() {
  const result = await passwordErrors.submit(
    () => $fetch<{ success: boolean }>('/api/profile/password', { method: 'PATCH', body: { ...password } }),
    'Could not change your password.',
  )

  if (!result) return

  toast.success('Password changed', 'Other devices have been signed out.')
  password.currentPassword = ''
  password.newPassword = ''
  password.confirmPassword = ''
  await refreshSessions()
}

async function revokeSessions() {
  revoking.value = true

  try {
    const { revoked } = await $fetch<{ revoked: number }>('/api/profile/sessions', {
      method: 'DELETE',
    })

    toast.success(
      'Devices signed out',
      `${revoked} other session${revoked === 1 ? '' : 's'} ended.`,
    )
    confirmRevoke.value = false
    await refreshSessions()
  } catch (error) {
    toast.error('Could not sign out devices', extractApiError(error).message)
  } finally {
    revoking.value = false
  }
}
</script>

<template>
  <div class="stack profile-page">
    <header>
      <h1>Profile &amp; security</h1>
      <p class="muted small">Manage your details, password and signed-in devices.</p>
    </header>

    <div class="grid grid-2">
      <section class="card stack">
        <h2 class="card-title">Personal details</h2>

        <div v-if="detailErrors.errors.value.form" class="alert alert-error" role="alert">
          {{ detailErrors.errors.value.form }}
        </div>

        <form class="stack" novalidate @submit.prevent="saveDetails">
          <div class="grid name-grid">
            <FormField v-slot="field" label="First name" :error="detailErrors.errors.value.firstName">
              <input
                :id="field.id"
                v-model="details.firstName"
                class="input"
                :class="{ 'has-error': field.invalid }"
                :aria-invalid="field.invalid"
                :aria-describedby="field.describedBy"
                autocomplete="given-name"
                maxlength="60"
              >
            </FormField>

            <FormField v-slot="field" label="Last name" :error="detailErrors.errors.value.lastName">
              <input
                :id="field.id"
                v-model="details.lastName"
                class="input"
                :class="{ 'has-error': field.invalid }"
                :aria-invalid="field.invalid"
                :aria-describedby="field.describedBy"
                autocomplete="family-name"
                maxlength="60"
              >
            </FormField>
          </div>

          <FormField v-slot="field" label="Phone number" :error="detailErrors.errors.value.phone" optional>
            <input
              :id="field.id"
              v-model="details.phone"
              class="input"
              :class="{ 'has-error': field.invalid }"
              :aria-invalid="field.invalid"
              :aria-describedby="field.describedBy"
              type="tel"
              autocomplete="tel"
              placeholder="+48 600 100 200"
            >
          </FormField>

          <FormField v-slot="field" label="Email address" hint="Contact support to change your email.">
            <input :id="field.id" class="input" :value="profile?.email" disabled>
          </FormField>

          <div>
            <button class="btn" type="submit" :disabled="detailErrors.submitting.value">
              <span v-if="detailErrors.submitting.value" class="spinner" aria-hidden="true" />
              {{ detailErrors.submitting.value ? 'Saving…' : 'Save details' }}
            </button>
          </div>
        </form>
      </section>

      <div class="stack">
        <section class="card stack">
          <h2 class="card-title">Account</h2>
          <dl class="summary">
            <div><dt>Role</dt><dd><StatusBadge :status="profile?.role ?? 'CUSTOMER'" /></dd></div>
            <div><dt>Status</dt><dd><StatusBadge :status="profile?.status ?? 'ACTIVE'" /></dd></div>
            <div><dt>Customer since</dt><dd>{{ profile ? date(profile.createdAt) : '—' }}</dd></div>
            <div><dt>Open accounts</dt><dd class="numeric">{{ profile?._count.accounts ?? 0 }}</dd></div>
            <div>
              <dt>Saved recipients</dt>
              <dd class="numeric">{{ profile?._count.beneficiaries ?? 0 }}</dd>
            </div>
          </dl>
        </section>

        <section class="card stack">
          <div class="card-header">
            <h2 class="card-title">Signed-in devices</h2>
            <button
              class="btn btn-secondary btn-sm"
              type="button"
              :disabled="otherSessions.length === 0"
              @click="confirmRevoke = true"
            >
              Sign out others
            </button>
          </div>

          <ul class="session-list">
            <li v-for="session in sessions" :key="session.id" class="session">
              <div class="session-info">
                <p class="session-device">
                  {{ deviceLabel(session.userAgent) }}
                  <span v-if="session.current" class="badge badge-success">This device</span>
                </p>
                <p class="tiny muted">
                  <span class="mono">{{ session.ipAddress ?? 'unknown IP' }}</span>
                  · signed in {{ dateTime(session.createdAt) }}
                </p>
              </div>
            </li>
          </ul>
        </section>
      </div>
    </div>

    <section class="card stack password-card">
      <h2 class="card-title">Change password</h2>

      <div v-if="passwordErrors.errors.value.form" class="alert alert-error" role="alert">
        {{ passwordErrors.errors.value.form }}
      </div>

      <form class="stack" novalidate @submit.prevent="changePassword">
        <FormField
          v-slot="field"
          label="Current password"
          :error="passwordErrors.errors.value.currentPassword"
        >
          <input
            :id="field.id"
            v-model="password.currentPassword"
            class="input"
            :class="{ 'has-error': field.invalid }"
            :aria-invalid="field.invalid"
            :aria-describedby="field.describedBy"
            type="password"
            autocomplete="current-password"
          >
        </FormField>

        <div class="grid name-grid">
          <FormField v-slot="field" label="New password" :error="passwordErrors.errors.value.newPassword">
            <input
              :id="field.id"
              v-model="password.newPassword"
              class="input"
              :class="{ 'has-error': field.invalid }"
              :aria-invalid="field.invalid"
              :aria-describedby="field.describedBy"
              type="password"
              autocomplete="new-password"
            >
          </FormField>

          <FormField
            v-slot="field"
            label="Repeat new password"
            :error="
              passwordErrors.errors.value.confirmPassword ||
              (password.confirmPassword && password.newPassword !== password.confirmPassword
                ? 'Passwords do not match'
                : undefined)
            "
          >
            <input
              :id="field.id"
              v-model="password.confirmPassword"
              class="input"
              :class="{ 'has-error': field.invalid }"
              :aria-invalid="field.invalid"
              :aria-describedby="field.describedBy"
              type="password"
              autocomplete="new-password"
            >
          </FormField>
        </div>

        <ul v-if="password.newPassword" class="checks">
          <li v-for="check in passwordChecks" :key="check.label" :class="{ met: check.met }">
            {{ check.met ? '✓' : '○' }} {{ check.label }}
          </li>
        </ul>

        <p class="tiny muted">Changing your password signs you out everywhere else.</p>

        <div>
          <button
            class="btn"
            type="submit"
            :disabled="passwordErrors.submitting.value || !passwordReady"
          >
            <span v-if="passwordErrors.submitting.value" class="spinner" aria-hidden="true" />
            {{ passwordErrors.submitting.value ? 'Updating…' : 'Change password' }}
          </button>
        </div>
      </form>
    </section>

    <ConfirmDialog
      :open="confirmRevoke"
      title="Sign out other devices?"
      :description="`${otherSessions.length} other session${otherSessions.length === 1 ? '' : 's'} will end immediately. This device stays signed in.`"
      confirm-label="Sign out others"
      tone="danger"
      :pending="revoking"
      @confirm="revokeSessions"
      @cancel="confirmRevoke = false"
    />
  </div>
</template>

<style scoped>
.profile-page { max-width: 1000px; }
.password-card { max-width: 620px; }
.name-grid { gap: 12px; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); }

.summary { margin: 0; display: flex; flex-direction: column; gap: 0; }

.summary > div {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 9px 0;
  border-bottom: 1px solid var(--border);
}

.summary > div:last-child { border-bottom: none; }
.summary dt { font-size: 0.82rem; color: var(--text-muted); }
.summary dd { margin: 0; font-size: 0.88rem; font-weight: 570; }

.session-list { list-style: none; margin: 0; padding: 0; }

.session {
  padding: 10px 0;
  border-bottom: 1px solid var(--border);
}

.session:last-child { border-bottom: none; }

.session-device {
  font-size: 0.87rem;
  font-weight: 570;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.checks {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
  font-size: 0.76rem;
  color: var(--text-muted);
}

.checks .met { color: var(--success); }
</style>
