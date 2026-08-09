<script setup lang="ts">
useHead({ title: 'Accounts — NeoBank' })

const { data, pending, refresh } = await useFetch('/api/accounts', { headers: useApiHeaders() })

const showForm = ref(false)
const submitting = ref(false)
const errors = ref<Record<string, string>>({})
const form = reactive({ name: '', type: 'CHECKING', currency: 'PLN' })

const accounts = computed(() => data.value?.accounts ?? [])

async function createAccount() {
  submitting.value = true
  errors.value = {}

  try {
    await $fetch('/api/accounts', { method: 'POST', body: { ...form } })
    showForm.value = false
    form.name = ''
    form.type = 'CHECKING'
    form.currency = 'PLN'
    await refresh()
  } catch (error) {
    const data = (error as { data?: { data?: { errors?: Record<string, string> } } }).data?.data
    errors.value = data?.errors ?? { form: 'Could not open the account. Please try again.' }
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="stack">
    <div class="row-between">
      <div>
        <h1>Accounts</h1>
        <p class="muted small">Open and manage your NeoBank accounts.</p>
      </div>
      <button class="btn" type="button" @click="showForm = !showForm">
        {{ showForm ? 'Cancel' : 'Open new account' }}
      </button>
    </div>

    <form v-if="showForm" class="card stack" novalidate @submit.prevent="createAccount">
      <h2 class="card-title">New account</h2>

      <div v-if="errors.form" class="alert alert-error">{{ errors.form }}</div>

      <div class="grid grid-3">
        <div class="field">
          <label class="field-label" for="name">Account name</label>
          <input
            id="name"
            v-model="form.name"
            class="input"
            :class="{ 'has-error': errors.name }"
            placeholder="Holiday fund"
            required
          >
          <span v-if="errors.name" class="field-error">{{ errors.name }}</span>
        </div>

        <div class="field">
          <label class="field-label" for="type">Type</label>
          <select id="type" v-model="form.type" class="select">
            <option value="CHECKING">Checking</option>
            <option value="SAVINGS">Savings</option>
            <option value="CREDIT">Credit</option>
          </select>
          <span class="field-hint">Credit accounts include a 5 000 overdraft.</span>
        </div>

        <div class="field">
          <label class="field-label" for="currency">Currency</label>
          <select id="currency" v-model="form.currency" class="select">
            <option value="PLN">PLN — Polish złoty</option>
            <option value="EUR">EUR — Euro</option>
            <option value="USD">USD — US dollar</option>
            <option value="GBP">GBP — Pound sterling</option>
          </select>
        </div>
      </div>

      <div>
        <button class="btn" type="submit" :disabled="submitting">
          {{ submitting ? 'Opening…' : 'Open account' }}
        </button>
      </div>
    </form>

    <div v-if="pending" class="card empty">Loading accounts…</div>

    <div v-else-if="accounts.length" class="grid grid-3">
      <AccountCard v-for="account in accounts" :key="account.id" :account="account" />
    </div>

    <div v-else class="card">
      <EmptyState
        icon="🏦"
        title="No accounts yet"
        description="Open your first account to start moving money."
      />
    </div>
  </div>
</template>
