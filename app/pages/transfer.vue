<script setup lang="ts">
useHead({ title: 'Send money — NeoBank' })

const route = useRoute()
const { money, iban: formatIban } = useFormat()

const { data: accountData } = await useFetch('/api/accounts', { headers: useApiHeaders() })
const { data: beneficiaryData } = await useFetch('/api/beneficiaries', { headers: useApiHeaders() })

const accounts = computed(() => accountData.value?.accounts ?? [])
const beneficiaries = computed(() => beneficiaryData.value?.beneficiaries ?? [])

const form = reactive({
  sourceAccountId: '',
  destinationIban: '',
  amount: '',
  title: '',
  externalName: '',
})
const errors = ref<Record<string, string>>({})
const submitting = ref(false)
const success = ref<{ reference: string; amount: string } | null>(null)

// Preselect from ?from=<accountId>, else the first account.
watchEffect(() => {
  if (form.sourceAccountId || accounts.value.length === 0) return

  const preferred = route.query.from
  const match = accounts.value.find((account) => account.id === preferred)

  form.sourceAccountId = match?.id ?? accounts.value[0]!.id
})

const selectedAccount = computed(() =>
  accounts.value.find((account) => account.id === form.sourceAccountId),
)

async function onSubmit() {
  submitting.value = true
  errors.value = {}
  success.value = null

  try {
    const response = await $fetch<{ transfer: { reference: string; amountCents: string; currency: string } }>(
      '/api/transfers',
      { method: 'POST', body: { ...form, externalName: form.externalName || undefined } },
    )

    success.value = {
      reference: response.transfer.reference,
      amount: money(response.transfer.amountCents, response.transfer.currency),
    }

    form.destinationIban = ''
    form.amount = ''
    form.title = ''
    form.externalName = ''

    await refreshNuxtData()
  } catch (error) {
    const payload = (error as { data?: { data?: { errors?: Record<string, string> } } }).data?.data
    errors.value = payload?.errors ?? { form: 'The transfer could not be completed.' }
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="stack transfer-page">
    <div>
      <h1>Send money</h1>
      <p class="muted small">Instant to NeoBank accounts, next business day to other banks.</p>
    </div>

    <div v-if="success" class="alert alert-success">
      Sent {{ success.amount }} · reference <strong class="mono">{{ success.reference }}</strong>
    </div>

    <div v-if="errors.form" class="alert alert-error">{{ errors.form }}</div>

    <div class="transfer-grid">
      <form class="card stack" novalidate @submit.prevent="onSubmit">
        <div class="field">
          <label class="field-label" for="source">From account</label>
          <select
            id="source"
            v-model="form.sourceAccountId"
            class="select"
            :class="{ 'has-error': errors.sourceAccountId }"
            required
          >
            <option v-for="account in accounts" :key="account.id" :value="account.id">
              {{ account.name }} — {{ money(account.balanceCents, account.currency) }}
            </option>
          </select>
          <span v-if="selectedAccount" class="field-hint mono">
            {{ formatIban(selectedAccount.iban) }}
          </span>
          <span v-if="errors.sourceAccountId" class="field-error">{{ errors.sourceAccountId }}</span>
        </div>

        <div class="field">
          <label class="field-label" for="destination">Recipient IBAN</label>
          <input
            id="destination"
            v-model="form.destinationIban"
            class="input mono"
            :class="{ 'has-error': errors.destinationIban }"
            placeholder="PL00 0000 0000 0000 0000 0000 0000"
            required
          >
          <span v-if="errors.destinationIban" class="field-error">{{ errors.destinationIban }}</span>
        </div>

        <div class="field">
          <label class="field-label" for="externalName">
            Recipient name <span class="muted">(external transfers)</span>
          </label>
          <input
            id="externalName"
            v-model="form.externalName"
            class="input"
            placeholder="Jan Nowak"
          >
        </div>

        <div class="grid grid-2 amount-grid">
          <div class="field">
            <label class="field-label" for="amount">Amount</label>
            <input
              id="amount"
              v-model="form.amount"
              class="input numeric"
              :class="{ 'has-error': errors.amount }"
              inputmode="decimal"
              placeholder="120.50"
              required
            >
            <span v-if="errors.amount" class="field-error">{{ errors.amount }}</span>
            <span v-else-if="selectedAccount" class="field-hint">
              Currency: {{ selectedAccount.currency }}
            </span>
          </div>

          <div class="field">
            <label class="field-label" for="title">Reference / title</label>
            <input
              id="title"
              v-model="form.title"
              class="input"
              :class="{ 'has-error': errors.title }"
              placeholder="Invoice 04/2026"
              required
            >
            <span v-if="errors.title" class="field-error">{{ errors.title }}</span>
          </div>
        </div>

        <button class="btn btn-block" type="submit" :disabled="submitting">
          <span v-if="submitting" class="spinner" />
          {{ submitting ? 'Sending…' : 'Send transfer' }}
        </button>
      </form>

      <aside class="card stack">
        <h2 class="card-title">Saved recipients</h2>

        <div v-if="beneficiaries.length" class="stack recipients">
          <button
            v-for="beneficiary in beneficiaries"
            :key="beneficiary.id"
            class="recipient"
            type="button"
            @click="form.destinationIban = beneficiary.iban; form.externalName = beneficiary.name"
          >
            <span class="recipient-name truncate">{{ beneficiary.name }}</span>
            <span class="tiny muted mono truncate">{{ formatIban(beneficiary.iban) }}</span>
            <span v-if="beneficiary.bankName" class="tiny muted">{{ beneficiary.bankName }}</span>
          </button>
        </div>

        <EmptyState
          v-else
          icon="👤"
          title="No saved recipients"
          description="Save the people you pay often."
        />

        <NuxtLink to="/beneficiaries" class="btn btn-secondary btn-sm btn-block">
          Manage recipients
        </NuxtLink>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.transfer-page { max-width: 960px; }

.transfer-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.6fr) minmax(0, 1fr);
  gap: 18px;
  align-items: start;
}

.amount-grid { gap: 12px; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); }
.recipients { gap: 8px; }

.recipient {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface);
  text-align: left;
  cursor: pointer;
  font: inherit;
  color: inherit;
  transition: border-color 0.15s ease, background 0.15s ease;
}

.recipient:hover { border-color: var(--primary); background: var(--primary-soft); }
.recipient-name { font-size: 0.87rem; font-weight: 600; }

@media (max-width: 820px) {
  .transfer-grid { grid-template-columns: 1fr; }
}
</style>
