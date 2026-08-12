<script setup lang="ts">
const route = useRoute()
const router = useRouter()
const { money, iban, date } = useFormat()
const toast = useToast()

const { data, pending, error, refresh } = await useFetch(`/api/accounts/${route.params.id}`, {
  headers: useApiHeaders(),
})

const account = computed(() => data.value?.account)

useHead({ title: () => `${account.value?.name ?? 'Account'} — NeoBank` })

const copied = ref(false)
const depositAmount = ref('')
const depositErrors = useFormErrors()

const renaming = ref(false)
const renameValue = ref('')
const renameErrors = useFormErrors()

const closing = ref(false)
const closePending = ref(false)

const canClose = computed(
  () => account.value?.status === 'ACTIVE' && BigInt(account.value.balanceCents) === 0n,
)

async function copyIban() {
  if (!account.value) return

  try {
    await navigator.clipboard.writeText(account.value.iban)
    copied.value = true
    setTimeout(() => { copied.value = false }, 2000)
  } catch {
    toast.error('Could not copy', 'Your browser blocked clipboard access.')
  }
}

async function addFunds() {
  if (!account.value) return

  const result = await depositErrors.submit(
    () =>
      $fetch<{ transfer: { amountCents: string; currency: string } }>('/api/transfers/deposit', {
        method: 'POST',
        body: { accountId: account.value!.id, amount: depositAmount.value, title: 'Top-up' },
      }),
    'Could not add funds.',
  )

  if (!result) return

  toast.success('Funds added', money(result.transfer.amountCents, result.transfer.currency))
  depositAmount.value = ''
  await refresh()
}

function startRename() {
  renameValue.value = account.value?.name ?? ''
  renaming.value = true
}

async function saveRename() {
  if (!account.value) return

  const result = await renameErrors.submit(
    () =>
      $fetch<{ account: { name: string } }>(`/api/accounts/${account.value!.id}`, {
        method: 'PATCH',
        body: { name: renameValue.value },
      }),
    'Could not rename the account.',
  )

  if (!result) return

  toast.success('Account renamed', result.account.name)
  renaming.value = false
  await refresh()
}

async function confirmClose() {
  if (!account.value) return

  closePending.value = true

  try {
    await $fetch(`/api/accounts/${account.value.id}`, { method: 'DELETE' })
    toast.success('Account closed', account.value.name)
    closing.value = false
    await router.push('/accounts')
  } catch (requestError) {
    toast.error('Could not close account', extractApiError(requestError).message)
  } finally {
    closePending.value = false
  }
}
</script>

<template>
  <div v-if="pending" class="stack">
    <div class="card"><SkeletonBlock :rows="2" height="26px" /></div>
    <div class="card"><SkeletonBlock :rows="5" /></div>
  </div>

  <div v-else-if="!account" class="card">
    <EmptyState
      icon="search"
      title="Account not found"
      :description="
        error?.statusCode === 404
          ? 'This account does not exist, or it is not yours.'
          : 'We could not load this account. Please try again.'
      "
    >
      <template #action>
        <NuxtLink to="/accounts" class="btn btn-sm">Back to accounts</NuxtLink>
      </template>
    </EmptyState>
  </div>

  <div v-else class="stack">
    <div class="row-between">
      <div>
        <NuxtLink to="/accounts" class="small link-back">
          <AppIcon name="arrow-left" :size="14" /> All accounts
        </NuxtLink>
        <h1>{{ account.name }}</h1>
        <p class="muted small mono">{{ iban(account.iban) }}</p>
      </div>

      <div class="row">
        <button class="btn btn-secondary btn-sm" type="button" @click="copyIban">
          <AppIcon :name="copied ? 'check' : 'copy'" :size="14" />
          {{ copied ? 'Copied' : 'Copy IBAN' }}
        </button>
        <button class="btn btn-secondary btn-sm" type="button" @click="startRename">Rename</button>
        <NuxtLink
          v-if="account.status === 'ACTIVE'"
          :to="`/transfer?from=${account.id}`"
          class="btn btn-sm"
        >
          Send money
        </NuxtLink>
      </div>
    </div>

    <div class="grid grid-4">
      <StatCard
        label="Balance"
        :value="money(account.balanceCents, account.currency)"
        :hint="`${account.currency} account`"
      />
      <StatCard label="Account type" :value="account.type" hint="Product" />
      <StatCard
        label="Overdraft"
        :value="money(account.overdraftCents, account.currency)"
        hint="Available credit"
      />
      <div class="card stat-status">
        <span class="label">Status</span>
        <StatusBadge :status="account.status" />
        <span class="tiny muted">Opened {{ date(account.createdAt) }}</span>
      </div>
    </div>

    <div class="grid grid-2">
      <section class="card">
        <div class="card-header">
          <h2 class="card-title">Recent activity</h2>
          <NuxtLink :to="`/transactions?accountId=${account.id}`" class="small">View all →</NuxtLink>
        </div>

        <div v-if="account.entries?.length">
          <TransactionRow
            v-for="entry in account.entries"
            :key="entry.id"
            :entry="entry"
            :currency="account.currency"
          />
        </div>

        <EmptyState v-else icon="inbox" title="No activity yet" />
      </section>

      <div class="stack">
        <section class="card">
          <div class="card-header">
            <h2 class="card-title">Cards</h2>
          </div>

          <div v-if="account.cards?.length" class="stack card-list">
            <div v-for="card in account.cards" :key="card.id" class="bank-card">
              <div class="row-between">
                <span class="card-brand">{{ card.brand }}</span>
                <StatusBadge :status="card.status" />
              </div>
              <p class="card-number mono">•••• •••• •••• {{ card.last4 }}</p>
              <div class="row-between">
                <span class="tiny">{{ card.type }}</span>
                <span class="tiny numeric">
                  {{ String(card.expiryMonth).padStart(2, '0') }}/{{ String(card.expiryYear).slice(-2) }}
                </span>
              </div>
            </div>
          </div>

          <EmptyState v-else icon="credit-card" title="No cards issued" />
        </section>

        <section v-if="account.status === 'ACTIVE'" class="card stack">
          <h2 class="card-title">Add funds</h2>
          <p class="tiny muted">Simulates an incoming payment into this account.</p>

          <form class="deposit-form" @submit.prevent="addFunds">
            <FormField v-slot="field" label="Amount" :error="depositErrors.errors.value.amount || depositErrors.errors.value.form">
              <div class="row deposit-row">
                <input
                  :id="field.id"
                  v-model="depositAmount"
                  class="input numeric"
                  :class="{ 'has-error': field.invalid }"
                  :aria-invalid="field.invalid"
                  :aria-describedby="field.describedBy"
                  inputmode="decimal"
                  placeholder="250.00"
                >
                <button
                  class="btn"
                  type="submit"
                  :disabled="depositErrors.submitting.value || !depositAmount"
                >
                  {{ depositErrors.submitting.value ? 'Adding…' : 'Add' }}
                </button>
              </div>
            </FormField>
          </form>
        </section>

        <section class="card stack">
          <h2 class="card-title">Close account</h2>
          <p class="tiny muted">
            {{
              account.status === 'CLOSED'
                ? 'This account is already closed.'
                : canClose
                  ? 'Closing keeps your statement history but stops all new activity.'
                  : 'Move the remaining balance out before this account can be closed.'
            }}
          </p>
          <div>
            <button
              class="btn btn-danger btn-sm"
              type="button"
              :disabled="!canClose"
              @click="closing = true"
            >
              Close account
            </button>
          </div>
        </section>
      </div>
    </div>

    <AppModal :open="renaming" title="Rename account" @close="renaming = false">
      <form id="rename-form" @submit.prevent="saveRename">
        <FormField v-slot="field" label="Account name" :error="renameErrors.errors.value.name || renameErrors.errors.value.form">
          <input
            :id="field.id"
            v-model="renameValue"
            class="input"
            :class="{ 'has-error': field.invalid }"
            :aria-invalid="field.invalid"
            :aria-describedby="field.describedBy"
            maxlength="60"
          >
        </FormField>
      </form>

      <template #footer>
        <button class="btn btn-secondary" type="button" @click="renaming = false">Cancel</button>
        <button
          class="btn"
          type="submit"
          form="rename-form"
          :disabled="renameErrors.submitting.value || renameValue.trim().length < 2"
        >
          {{ renameErrors.submitting.value ? 'Saving…' : 'Save name' }}
        </button>
      </template>
    </AppModal>

    <ConfirmDialog
      :open="closing"
      title="Close this account?"
      :description="`${account.name} will stop accepting transfers and its cards will be blocked. Your transaction history stays available.`"
      confirm-label="Close account"
      tone="danger"
      :pending="closePending"
      @confirm="confirmClose"
      @cancel="closing = false"
    />
  </div>
</template>

<style scoped>
.stat-status { display: flex; flex-direction: column; gap: 8px; align-items: flex-start; }
.card-list { gap: 11px; }

.bank-card {
  padding: 15px;
  border-radius: var(--radius-sm);
  background: linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%);
  color: #fff;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.card-brand { font-weight: 650; font-size: 0.88rem; }
.card-number { font-size: 0.95rem; letter-spacing: 0.06em; }
.deposit-row { gap: 9px; align-items: stretch; }
.deposit-row .input { flex: 1; }
</style>
