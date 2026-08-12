<script setup lang="ts">
useHead({ title: 'Send money — NeoBank' })

const route = useRoute()
const { money, iban: formatIban } = useFormat()
const toast = useToast()
const { errors, submitting, submit } = useFormErrors()

const { data: accountData, refresh: refreshAccounts } = await useFetch('/api/accounts', {
  headers: useApiHeaders(),
})
const { data: beneficiaryData } = await useFetch('/api/beneficiaries', {
  headers: useApiHeaders(),
})

const accounts = computed(() => accountData.value?.accounts ?? [])
const beneficiaries = computed(() => beneficiaryData.value?.beneficiaries ?? [])

const form = reactive({
  sourceAccountId: '',
  destinationIban: '',
  amount: '',
  title: '',
  externalName: '',
})

const receipt = ref<{ reference: string; amount: string; title: string } | null>(null)

const openAccounts = computed(() => accounts.value.filter((account) => account.status === 'ACTIVE'))

const selectedAccount = computed(() =>
  accounts.value.find((account) => account.id === form.sourceAccountId),
)

/** Own accounts in the same currency — the only ones a transfer can reach. */
const ownDestinations = computed(() =>
  openAccounts.value.filter(
    (account) =>
      account.id !== form.sourceAccountId && account.currency === selectedAccount.value?.currency,
  ),
)

watchEffect(() => {
  if (form.sourceAccountId || openAccounts.value.length === 0) return

  const preferred = route.query.from
  const match = openAccounts.value.find((account) => account.id === preferred)

  form.sourceAccountId = match?.id ?? openAccounts.value[0]!.id
})

// Recipients link here as /transfer?to=<iban>; prefill so the CTA does something.
onMounted(() => {
  const to = route.query.to

  if (typeof to !== 'string' || !to) return

  form.destinationIban = to

  const saved = beneficiaries.value.find((beneficiary) => beneficiary.iban === to)

  if (saved) form.externalName = saved.name
})

const amountCents = computed(() => {
  const raw = form.amount.trim().replace(/\s/g, '').replace(',', '.')

  if (!/^\d+(\.\d{1,2})?$/.test(raw)) return null

  const [whole = '0', fraction = ''] = raw.split('.')

  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0') || '0')
})

/**
 * Mirrors the server rule so the customer is told before a round trip.
 * The server still re-checks against the locked balance — this is only UX.
 */
const availableCents = computed(() =>
  selectedAccount.value
    ? BigInt(selectedAccount.value.balanceCents) + BigInt(selectedAccount.value.overdraftCents)
    : 0n,
)

const exceedsBalance = computed(
  () => amountCents.value !== null && amountCents.value > availableCents.value,
)

const canSubmit = computed(
  () =>
    Boolean(form.sourceAccountId) &&
    form.destinationIban.replace(/\s/g, '').length > 8 &&
    amountCents.value !== null &&
    amountCents.value > 0n &&
    !exceedsBalance.value &&
    form.title.trim().length >= 3,
)

function useOwnAccount(iban: string) {
  form.destinationIban = iban
  form.externalName = ''
}

function useBeneficiary(beneficiary: { iban: string; name: string }) {
  form.destinationIban = beneficiary.iban
  form.externalName = beneficiary.name
}

async function onSubmit() {
  receipt.value = null

  const response = await submit(
    () =>
      $fetch<{ transfer: { reference: string; amountCents: string; currency: string; title: string } }>(
        '/api/transfers',
        { method: 'POST', body: { ...form, externalName: form.externalName || undefined } },
      ),
    'The transfer could not be completed.',
  )

  if (!response) {
    toast.error('Transfer failed', errors.value.form)
    return
  }

  receipt.value = {
    reference: response.transfer.reference,
    amount: money(response.transfer.amountCents, response.transfer.currency),
    title: response.transfer.title,
  }

  toast.success('Transfer sent', `${receipt.value.amount} · ${receipt.value.reference}`)

  form.destinationIban = ''
  form.amount = ''
  form.title = ''
  form.externalName = ''

  await refreshAccounts()
}
</script>

<template>
  <div class="stack transfer-page">
    <header>
      <h1>Send money</h1>
      <p class="muted small">Instant to NeoBank accounts, next business day to other banks.</p>
    </header>

    <div v-if="receipt" class="alert alert-success" role="status">
      Sent <strong>{{ receipt.amount }}</strong> — “{{ receipt.title }}”, reference
      <strong class="mono">{{ receipt.reference }}</strong>
    </div>

    <div v-if="errors.form" class="alert alert-error" role="alert">{{ errors.form }}</div>

    <div v-if="openAccounts.length === 0" class="card">
      <EmptyState
        icon="landmark"
        title="No open accounts"
        description="Open an account before sending money."
      >
        <template #action>
          <NuxtLink to="/accounts" class="btn btn-sm">Open an account</NuxtLink>
        </template>
      </EmptyState>
    </div>

    <div v-else class="transfer-grid">
      <form class="card stack" novalidate @submit.prevent="onSubmit">
        <FormField v-slot="field" label="From account" :error="errors.sourceAccountId">
          <select
            :id="field.id"
            v-model="form.sourceAccountId"
            class="select"
            :class="{ 'has-error': field.invalid }"
            :aria-describedby="field.describedBy"
          >
            <option v-for="account in openAccounts" :key="account.id" :value="account.id">
              {{ account.name }} — {{ money(account.balanceCents, account.currency) }}
            </option>
          </select>
        </FormField>

        <p v-if="selectedAccount" class="field-hint mono account-iban">
          {{ formatIban(selectedAccount.iban) }}
        </p>

        <FormField
          v-slot="field"
          label="Recipient IBAN"
          :error="errors.destinationIban"
          hint="Any valid IBAN. NeoBank accounts arrive instantly."
        >
          <input
            :id="field.id"
            v-model="form.destinationIban"
            class="input mono"
            :class="{ 'has-error': field.invalid }"
            :aria-invalid="field.invalid"
            :aria-describedby="field.describedBy"
            autocomplete="off"
            placeholder="PL00 0000 0000 0000 0000 0000 0000"
          >
        </FormField>

        <FormField v-slot="field" label="Recipient name" :error="errors.externalName" optional>
          <input
            :id="field.id"
            v-model="form.externalName"
            class="input"
            :aria-describedby="field.describedBy"
            placeholder="Jan Nowak"
          >
        </FormField>

        <div class="grid amount-grid">
          <FormField
            v-slot="field"
            label="Amount"
            :error="errors.amount || (exceedsBalance ? 'More than the available balance' : undefined)"
            :hint="selectedAccount ? `Available: ${money(availableCents, selectedAccount.currency)}` : undefined"
          >
            <input
              :id="field.id"
              v-model="form.amount"
              class="input numeric"
              :class="{ 'has-error': field.invalid }"
              :aria-invalid="field.invalid"
              :aria-describedby="field.describedBy"
              inputmode="decimal"
              placeholder="120.50"
            >
          </FormField>

          <FormField v-slot="field" label="Reference" :error="errors.title">
            <input
              :id="field.id"
              v-model="form.title"
              class="input"
              :class="{ 'has-error': field.invalid }"
              :aria-invalid="field.invalid"
              :aria-describedby="field.describedBy"
              maxlength="140"
              placeholder="Invoice 04/2026"
            >
          </FormField>
        </div>

        <button class="btn btn-block" type="submit" :disabled="submitting || !canSubmit">
          <span v-if="submitting" class="spinner" aria-hidden="true" />
          {{ submitting ? 'Sending…' : 'Send transfer' }}
        </button>
      </form>

      <aside class="stack">
        <section v-if="ownDestinations.length" class="card stack">
          <h2 class="card-title">Your accounts</h2>
          <p class="tiny muted">Move money between your own {{ selectedAccount?.currency }} accounts.</p>

          <ul class="picker-list">
            <li v-for="account in ownDestinations" :key="account.id">
              <button class="picker" type="button" @click="useOwnAccount(account.iban)">
                <span class="picker-name truncate">{{ account.name }}</span>
                <span class="tiny muted numeric">
                  {{ money(account.balanceCents, account.currency) }}
                </span>
              </button>
            </li>
          </ul>
        </section>

        <section class="card stack">
          <h2 class="card-title">Saved recipients</h2>

          <ul v-if="beneficiaries.length" class="picker-list">
            <li v-for="beneficiary in beneficiaries" :key="beneficiary.id">
              <button
                class="picker"
                type="button"
                :aria-label="`Use ${beneficiary.name} as the recipient`"
                @click="useBeneficiary(beneficiary)"
              >
                <span class="picker-name truncate">{{ beneficiary.name }}</span>
                <span class="tiny muted mono truncate">{{ formatIban(beneficiary.iban) }}</span>
                <span v-if="beneficiary.bankName" class="tiny muted">{{ beneficiary.bankName }}</span>
              </button>
            </li>
          </ul>

          <EmptyState
            v-else
            icon="users"
            title="No saved recipients"
            description="Save the people you pay often."
          />

          <NuxtLink to="/beneficiaries" class="btn btn-secondary btn-sm btn-block">
            Manage recipients
          </NuxtLink>
        </section>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.transfer-page { max-width: 980px; }

.transfer-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.6fr) minmax(0, 1fr);
  gap: 18px;
  align-items: start;
}

.account-iban { margin-top: -10px; }
.amount-grid { gap: 12px; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); }

.picker-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.picker {
  width: 100%;
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

.picker:hover { border-color: var(--primary); background: var(--primary-soft); }
.picker-name { font-size: 0.87rem; font-weight: 600; }

@media (max-width: 820px) {
  .transfer-grid { grid-template-columns: 1fr; }
}
</style>
