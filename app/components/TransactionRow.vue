<script setup lang="ts">
interface TransferLike {
  reference: string
  title: string
  type: string
  status: string
  externalName?: string | null
  externalIban?: string | null
}

interface EntryLike {
  id: string
  direction: 'DEBIT' | 'CREDIT'
  amountCents: string
  bookedAt: string
  account?: { name: string; currency: string }
  transfer: TransferLike
}

const props = defineProps<{ entry: EntryLike; showAccount?: boolean }>()

const { signedMoney, relative } = useFormat()

const isCredit = computed(() => props.entry.direction === 'CREDIT')
const currency = computed(() => props.entry.account?.currency ?? 'PLN')

/** Who the money moved to/from, in the customer's terms. */
const counterparty = computed(() => {
  const { transfer } = props.entry

  if (transfer.externalName) return transfer.externalName
  if (transfer.type === 'DEPOSIT') return 'Incoming payment'
  if (transfer.type === 'INTERNAL') return isCredit.value ? 'From your account' : 'To your account'

  return 'NeoBank'
})
</script>

<template>
  <div class="tx-row">
    <span class="tx-icon" :class="isCredit ? 'tx-in' : 'tx-out'">
      {{ isCredit ? '↓' : '↑' }}
    </span>

    <div class="tx-body">
      <p class="tx-title truncate">{{ entry.transfer.title }}</p>
      <p class="tiny muted truncate">
        {{ counterparty }}
        <template v-if="showAccount && entry.account"> · {{ entry.account.name }}</template>
        · {{ relative(entry.bookedAt) }}
      </p>
    </div>

    <div class="tx-amount">
      <p class="numeric" :class="isCredit ? 'amount-positive' : 'amount-negative'">
        {{ signedMoney(entry.amountCents, currency) }}
      </p>
      <p class="tiny muted mono">{{ entry.transfer.reference }}</p>
    </div>
  </div>
</template>

<style scoped>
.tx-row {
  display: flex;
  align-items: center;
  gap: 13px;
  padding: 12px 0;
  border-bottom: 1px solid var(--border);
}

.tx-row:last-child { border-bottom: none; }

.tx-icon {
  width: 34px;
  height: 34px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  font-size: 0.95rem;
  font-weight: 700;
  flex-shrink: 0;
}

.tx-in { background: var(--success-soft); color: var(--success); }
.tx-out { background: var(--surface-muted); color: var(--text-muted); }

.tx-body { flex: 1; min-width: 0; }
.tx-title { font-weight: 570; font-size: 0.9rem; }

.tx-amount { text-align: right; flex-shrink: 0; }
</style>
