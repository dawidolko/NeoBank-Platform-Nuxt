<script setup lang="ts">
interface EntryLike {
  id: string
  direction: 'DEBIT' | 'CREDIT'
  amountCents: string
  bookedAt: string
  account?: { name?: string; currency?: string } | null
  transfer: {
    reference: string
    title: string
    type: string
    status: string
    externalName?: string | null
    externalIban?: string | null
    sourceAccount?: { name?: string; user?: { firstName: string; lastName: string } | null } | null
    destinationAccount?: { name?: string; user?: { firstName: string; lastName: string } | null } | null
  }
}

const props = withDefaults(
  defineProps<{
    entry: EntryLike
    showAccount?: boolean
    /** Fallback when the entry was fetched without its account relation. */
    currency?: string
    to?: string
  }>(),
  { showAccount: false, currency: undefined, to: undefined },
)

const { signedMoney, relative } = useFormat()
const { forEntry } = useCounterparty()

const isCredit = computed(() => props.entry.direction === 'CREDIT')
const currency = computed(() => props.entry.account?.currency ?? props.currency ?? 'PLN')
const counterparty = computed(() => forEntry(props.entry.transfer, props.entry.direction))
</script>

<template>
  <component
    :is="to ? 'NuxtLink' : 'div'"
    :to="to"
    class="tx-row"
    :class="{ 'tx-link': to }"
  >
    <span class="tx-icon" :class="isCredit ? 'tx-in' : 'tx-out'">
      <AppIcon :name="isCredit ? 'arrow-down-left' : 'arrow-up-right'" :size="16" />
    </span>
    <span class="visually-hidden">{{ isCredit ? 'Money in' : 'Money out' }}</span>

    <div class="tx-body">
      <p class="tx-title truncate">{{ entry.transfer.title }}</p>
      <p class="tiny muted truncate">
        {{ counterparty }}
        <template v-if="showAccount && entry.account?.name"> · {{ entry.account.name }}</template>
        · {{ relative(entry.bookedAt) }}
      </p>
    </div>

    <div class="tx-amount">
      <p class="numeric" :class="isCredit ? 'amount-positive' : 'amount-negative'">
        {{ signedMoney(entry.amountCents, currency) }}
      </p>
      <p class="tiny muted mono">{{ entry.transfer.reference }}</p>
    </div>
  </component>
</template>

<style scoped>
.tx-row {
  display: flex;
  align-items: center;
  gap: 13px;
  padding: 12px 0;
  border-bottom: 1px solid var(--border);
  color: inherit;
  text-decoration: none;
}

.tx-row:last-child { border-bottom: none; }

.tx-link { cursor: pointer; }

.tx-link:hover {
  text-decoration: none;
  background: var(--surface-muted);
  margin: 0 -10px;
  padding-inline: 10px;
  border-radius: var(--radius-sm);
}

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
