<script setup lang="ts">
const route = useRoute()
const { money, signedMoney, dateTime, iban: formatIban } = useFormat()
const { forEntry } = useCounterparty()
const toast = useToast()

interface TransactionDetail {
  entry: {
    id: string
    direction: 'DEBIT' | 'CREDIT'
    amountCents: string
    balanceAfterCents: string
    bookedAt: string
    account: { id: string; name: string; iban: string; currency: string }
    transfer: {
      reference: string
      title: string
      type: string
      status: string
      failureReason?: string | null
      externalName?: string | null
      externalIban?: string | null
      sourceAccount?: { iban: string; name: string; user?: { firstName: string; lastName: string } | null } | null
      destinationAccount?: { iban: string; name: string; user?: { firstName: string; lastName: string } | null } | null
    }
  }
}

// Typed explicitly: inferring this path would union it with the sibling CSV
// export route, whose handler resolves to `string`.
const { data, pending, error } = await useFetch<TransactionDetail>(
  `/api/transactions/${route.params.id}`,
  { headers: useApiHeaders() },
)

const entry = computed(() => data.value?.entry)
const transfer = computed(() => entry.value?.transfer)

useHead({ title: () => `${transfer.value?.title ?? 'Transaction'} — NeoBank` })

const isCredit = computed(() => entry.value?.direction === 'CREDIT')
const counterparty = computed(() =>
  entry.value ? forEntry(entry.value.transfer, entry.value.direction) : '',
)

/** The other side's IBAN, from whichever leg is not the caller's account. */
const counterpartyIban = computed(() => {
  if (!transfer.value || !entry.value) return null

  if (transfer.value.externalIban) return transfer.value.externalIban

  const other = isCredit.value ? transfer.value.sourceAccount : transfer.value.destinationAccount

  return other?.iban ?? null
})

async function copyReference() {
  if (!transfer.value) return

  try {
    await navigator.clipboard.writeText(transfer.value.reference)
    toast.success('Reference copied', transfer.value.reference)
  } catch {
    toast.error('Could not copy', 'Your browser blocked clipboard access.')
  }
}
</script>

<template>
  <div v-if="pending" class="detail-page">
    <div class="card"><SkeletonBlock :rows="6" /></div>
  </div>

  <div v-else-if="!entry || !transfer" class="detail-page">
    <div class="card">
      <EmptyState
        icon="🔍"
        title="Transaction not found"
        :description="
          error?.statusCode === 404
            ? 'This transaction does not exist, or it is not yours.'
            : 'We could not load this transaction.'
        "
      >
        <template #action>
          <NuxtLink to="/transactions" class="btn btn-sm">Back to transactions</NuxtLink>
        </template>
      </EmptyState>
    </div>
  </div>

  <div v-else class="stack detail-page">
    <div>
      <NuxtLink to="/transactions" class="small">← All transactions</NuxtLink>
      <h1>{{ transfer.title }}</h1>
      <p class="muted small">{{ dateTime(entry.bookedAt) }}</p>
    </div>

    <section class="card receipt">
      <div class="receipt-head">
        <span class="tx-icon" :class="isCredit ? 'tx-in' : 'tx-out'" aria-hidden="true">
          {{ isCredit ? '↓' : '↑' }}
        </span>
        <div>
          <p class="receipt-amount numeric" :class="isCredit ? 'amount-positive' : ''">
            {{ signedMoney(entry.amountCents, entry.account.currency) }}
          </p>
          <p class="small muted">{{ isCredit ? 'Money in' : 'Money out' }}</p>
        </div>
        <StatusBadge :status="transfer.status" />
      </div>

      <dl class="details">
        <div class="detail">
          <dt>Counterparty</dt>
          <dd>{{ counterparty }}</dd>
        </div>
        <div v-if="counterpartyIban" class="detail">
          <dt>Counterparty IBAN</dt>
          <dd class="mono">{{ formatIban(counterpartyIban) }}</dd>
        </div>
        <div class="detail">
          <dt>Your account</dt>
          <dd>
            <NuxtLink :to="`/accounts/${entry.account.id}`">{{ entry.account.name }}</NuxtLink>
            <span class="tiny muted mono block">{{ formatIban(entry.account.iban) }}</span>
          </dd>
        </div>
        <div class="detail">
          <dt>Reference</dt>
          <dd>
            <span class="mono">{{ transfer.reference }}</span>
            <button class="btn btn-ghost btn-sm copy" type="button" @click="copyReference">
              Copy
            </button>
          </dd>
        </div>
        <div class="detail">
          <dt>Type</dt>
          <dd><span class="badge">{{ transfer.type }}</span></dd>
        </div>
        <div class="detail">
          <dt>Booked</dt>
          <dd>{{ dateTime(entry.bookedAt) }}</dd>
        </div>
        <div class="detail">
          <dt>Balance after</dt>
          <dd class="numeric">{{ money(entry.balanceAfterCents, entry.account.currency) }}</dd>
        </div>
        <div v-if="transfer.failureReason" class="detail">
          <dt>Failure reason</dt>
          <dd>{{ transfer.failureReason }}</dd>
        </div>
      </dl>
    </section>

    <p class="tiny muted">
      This entry is one leg of a double-entry record. The matching leg is held against the
      counterparty account.
    </p>
  </div>
</template>

<style scoped>
.detail-page { max-width: 680px; }

.receipt-head {
  display: flex;
  align-items: center;
  gap: 14px;
  padding-bottom: 18px;
  border-bottom: 1px solid var(--border);
}

.tx-icon {
  width: 42px;
  height: 42px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  font-size: 1.1rem;
  font-weight: 700;
  flex-shrink: 0;
}

.tx-in { background: var(--success-soft); color: var(--success); }
.tx-out { background: var(--surface-muted); color: var(--text-muted); }

.receipt-amount { font-size: 1.5rem; font-weight: 680; letter-spacing: -0.02em; }
.receipt-head > :last-child { margin-left: auto; }

.details { margin: 0; padding-top: 4px; }

.detail {
  display: grid;
  grid-template-columns: minmax(0, 160px) minmax(0, 1fr);
  gap: 12px;
  padding: 11px 0;
  border-bottom: 1px solid var(--border);
}

.detail:last-child { border-bottom: none; }

.detail dt {
  font-size: 0.78rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-muted);
}

.detail dd { margin: 0; font-size: 0.9rem; }
.block { display: block; }
.copy { margin-left: 8px; }

@media (max-width: 560px) {
  .detail { grid-template-columns: 1fr; gap: 3px; }
}
</style>
