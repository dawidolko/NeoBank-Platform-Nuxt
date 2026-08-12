<script setup lang="ts">
useHead({ title: 'Accounts — NeoBank' })

const { money } = useFormat()
const toast = useToast()
const { errors, submitting, submit } = useFormErrors()

const { data, pending, refresh } = await useFetch('/api/accounts', { headers: useApiHeaders() })

const showForm = ref(false)
const form = reactive({ name: '', type: 'CHECKING', currency: 'PLN' })

const accounts = computed(() => data.value?.accounts ?? [])
const openAccounts = computed(() => accounts.value.filter((a) => a.status !== 'CLOSED'))
const closedAccounts = computed(() => accounts.value.filter((a) => a.status === 'CLOSED'))

const totalsByCurrency = computed(() => {
  const totals = new Map<string, bigint>()

  for (const account of openAccounts.value) {
    totals.set(
      account.currency,
      (totals.get(account.currency) ?? 0n) + BigInt(account.balanceCents),
    )
  }

  return [...totals.entries()]
})

async function createAccount() {
  const created = await submit(
    () =>
      $fetch<{ account: { name: string } }>('/api/accounts', {
        method: 'POST',
        body: { ...form },
      }),
    'Could not open the account.',
  )

  if (!created) return

  toast.success('Account opened', created.account.name)
  showForm.value = false
  form.name = ''
  form.type = 'CHECKING'
  form.currency = 'PLN'
  await refresh()
}
</script>

<template>
  <div class="stack">
    <div class="row-between">
      <div>
        <h1>Accounts</h1>
        <p class="muted small">Open and manage your NeoBank accounts.</p>
      </div>
      <button class="btn" type="button" :aria-expanded="showForm" @click="showForm = !showForm">
        {{ showForm ? 'Cancel' : 'Open new account' }}
      </button>
    </div>

    <div v-if="totalsByCurrency.length" class="grid grid-4">
      <StatCard
        v-for="[currency, total] in totalsByCurrency"
        :key="currency"
        :label="`Total ${currency}`"
        :value="money(total, currency)"
        hint="Across open accounts"
      />
    </div>

    <form v-if="showForm" class="card stack" novalidate @submit.prevent="createAccount">
      <h2 class="card-title">New account</h2>

      <div v-if="errors.form" class="alert alert-error" role="alert">{{ errors.form }}</div>

      <div class="grid grid-3">
        <FormField v-slot="field" label="Account name" :error="errors.name">
          <input
            :id="field.id"
            v-model="form.name"
            class="input"
            :class="{ 'has-error': field.invalid }"
            :aria-invalid="field.invalid"
            :aria-describedby="field.describedBy"
            maxlength="60"
            placeholder="Holiday fund"
          >
        </FormField>

        <FormField
          v-slot="field"
          label="Type"
          :error="errors.type"
          hint="Credit accounts include a 5 000 overdraft."
        >
          <select :id="field.id" v-model="form.type" class="select" :aria-describedby="field.describedBy">
            <option value="CHECKING">Checking</option>
            <option value="SAVINGS">Savings</option>
            <option value="CREDIT">Credit</option>
          </select>
        </FormField>

        <FormField v-slot="field" label="Currency" :error="errors.currency">
          <select :id="field.id" v-model="form.currency" class="select">
            <option value="PLN">PLN — Polish złoty</option>
            <option value="EUR">EUR — Euro</option>
            <option value="USD">USD — US dollar</option>
            <option value="GBP">GBP — Pound sterling</option>
          </select>
        </FormField>
      </div>

      <div>
        <button class="btn" type="submit" :disabled="submitting || form.name.trim().length < 2">
          <span v-if="submitting" class="spinner" aria-hidden="true" />
          {{ submitting ? 'Opening…' : 'Open account' }}
        </button>
      </div>
    </form>

    <div v-if="pending" class="grid grid-3">
      <div v-for="n in 3" :key="n" class="card"><SkeletonBlock :rows="3" /></div>
    </div>

    <template v-else-if="openAccounts.length">
      <div class="grid grid-3">
        <AccountCard v-for="account in openAccounts" :key="account.id" :account="account" />
      </div>

      <section v-if="closedAccounts.length" class="stack">
        <h2>Closed accounts</h2>
        <div class="grid grid-3">
          <AccountCard v-for="account in closedAccounts" :key="account.id" :account="account" />
        </div>
      </section>
    </template>

    <div v-else class="card">
      <EmptyState
        icon="landmark"
        title="No accounts yet"
        description="Open your first account to start moving money."
      >
        <template #action>
          <button class="btn btn-sm" type="button" @click="showForm = true">Open an account</button>
        </template>
      </EmptyState>
    </div>
  </div>
</template>
