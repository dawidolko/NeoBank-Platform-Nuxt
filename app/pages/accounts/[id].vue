<script setup lang="ts">
const route = useRoute()
const { money, iban, date } = useFormat()

const { data, pending, refresh } = await useFetch(`/api/accounts/${route.params.id}`, { headers: useApiHeaders() })

const account = computed(() => data.value?.account)

useHead({ title: () => `${account.value?.name ?? 'Account'} — NeoBank` })

const copied = ref(false)
const depositing = ref(false)
const depositAmount = ref('')
const depositError = ref('')

async function copyIban() {
  if (!account.value) return

  try {
    await navigator.clipboard.writeText(account.value.iban)
    copied.value = true
    setTimeout(() => { copied.value = false }, 2000)
  } catch {
    // Clipboard access can be denied; the IBAN stays visible either way.
  }
}

async function addFunds() {
  if (!account.value) return

  depositing.value = true
  depositError.value = ''

  try {
    await $fetch('/api/transfers/deposit', {
      method: 'POST',
      body: { accountId: account.value.id, amount: depositAmount.value, title: 'Top-up' },
    })
    depositAmount.value = ''
    await refresh()
  } catch (error) {
    const payload = (error as { data?: { data?: { errors?: Record<string, string> } } }).data?.data
    depositError.value = payload?.errors?.form ?? payload?.errors?.amount ?? 'Could not add funds.'
  } finally {
    depositing.value = false
  }
}
</script>

<template>
  <div v-if="pending" class="card empty">Loading account…</div>

  <div v-else-if="account" class="stack">
    <div class="row-between">
      <div>
        <NuxtLink to="/accounts" class="small">← All accounts</NuxtLink>
        <h1>{{ account.name }}</h1>
        <p class="muted small">
          <span class="mono">{{ iban(account.iban) }}</span>
        </p>
      </div>
      <div class="row">
        <button class="btn btn-secondary btn-sm" type="button" @click="copyIban">
          {{ copied ? 'Copied ✓' : 'Copy IBAN' }}
        </button>
        <NuxtLink :to="`/transfer?from=${account.id}`" class="btn btn-sm">Send money</NuxtLink>
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
            :entry="{ ...entry, account: { name: account.name, currency: account.currency } } as never"
          />
        </div>

        <EmptyState v-else icon="📭" title="No activity yet" />
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

          <EmptyState v-else icon="💳" title="No cards issued" />
        </section>

        <section class="card stack">
          <h2 class="card-title">Add funds</h2>
          <p class="tiny muted">Simulates an incoming payment into this account.</p>

          <div v-if="depositError" class="alert alert-error">{{ depositError }}</div>

          <form class="row deposit-form" @submit.prevent="addFunds">
            <input
              v-model="depositAmount"
              class="input"
              inputmode="decimal"
              placeholder="250.00"
              required
            >
            <button class="btn" type="submit" :disabled="depositing || !depositAmount">
              {{ depositing ? 'Adding…' : 'Add' }}
            </button>
          </form>
        </section>
      </div>
    </div>
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
.deposit-form { gap: 9px; }
.deposit-form .input { flex: 1; }
</style>
