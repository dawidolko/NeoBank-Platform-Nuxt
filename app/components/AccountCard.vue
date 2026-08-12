<script setup lang="ts">
interface AccountLike {
  id: string
  name: string
  iban: string
  type: string
  status: string
  currency: string
  balanceCents: string
  cards?: Array<{ last4: string; brand: string }>
}

const props = defineProps<{ account: AccountLike }>()

const { money, iban } = useFormat()

const TYPE_META = {
  CHECKING: { icon: 'credit-card', surface: 'var(--card-checking)', label: 'Everyday' },
  SAVINGS: { icon: 'piggy-bank', surface: 'var(--card-savings)', label: 'Savings' },
  CREDIT: { icon: 'landmark', surface: 'var(--card-credit)', label: 'Credit' },
} as const

const meta = computed(
  () => TYPE_META[props.account.type as keyof typeof TYPE_META] ?? TYPE_META.CHECKING,
)

const isNegative = computed(() => BigInt(props.account.balanceCents) < 0n)
const isClosed = computed(() => props.account.status === 'CLOSED')
/** Last four IBAN digits stand in for a card number on the face of the card. */
const last4 = computed(() => props.account.iban.slice(-4))
</script>

<template>
  <NuxtLink
    :to="`/accounts/${account.id}`"
    class="account"
    :class="{ 'is-closed': isClosed }"
    :aria-label="`${account.name}, balance ${money(account.balanceCents, account.currency)}`"
  >
    <div class="face" :style="{ background: meta.surface }">
      <div class="face-top">
        <span class="chip" aria-hidden="true" />
        <span class="brand-type">{{ meta.label }}</span>
      </div>

      <p class="face-number mono">•••• •••• •••• {{ last4 }}</p>

      <div class="face-bottom">
        <span class="face-name truncate">{{ account.name }}</span>
        <AppIcon :name="meta.icon" :size="20" class="face-icon" />
      </div>

      <span class="shine" aria-hidden="true" />
    </div>

    <div class="body">
      <div class="row-between">
        <span class="label">Available balance</span>
        <StatusBadge :status="account.status" />
      </div>

      <p class="balance numeric" :class="{ negative: isNegative }">
        {{ money(account.balanceCents, account.currency) }}
      </p>

      <p class="tiny subtle mono truncate">{{ iban(account.iban) }}</p>
    </div>
  </NuxtLink>
</template>

<style scoped>
.account {
  display: flex;
  flex-direction: column;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  overflow: hidden;
  color: inherit;
  box-shadow: var(--shadow-sm);
  transition:
    transform var(--duration) var(--ease-out),
    box-shadow var(--duration) var(--ease-out),
    border-color var(--duration) var(--ease);
}

.account:hover {
  transform: translateY(-4px);
  box-shadow: var(--shadow-lg);
  border-color: var(--border-strong);
}

.is-closed { opacity: 0.62; }
.is-closed .face { filter: grayscale(0.85); }

/* --- Card face ------------------------------------------------------------ */

.face {
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: var(--space-5);
  padding: var(--space-4);
  min-height: 148px;
  color: #fff;
  isolation: isolate;
}

.face-top { display: flex; align-items: center; justify-content: space-between; }

.chip {
  width: 32px;
  height: 24px;
  border-radius: 5px;
  background: linear-gradient(135deg, #f5d283 0%, #cfa54e 55%, #f0cd7e 100%);
  box-shadow: inset 0 0 0 1px rgb(255 255 255 / 28%);
}

.brand-type {
  font-size: var(--text-xs);
  font-weight: var(--weight-semibold);
  text-transform: uppercase;
  letter-spacing: 0.09em;
  opacity: 0.82;
}

.face-number {
  font-size: var(--text-md);
  letter-spacing: 0.09em;
  opacity: 0.95;
}

.face-bottom { display: flex; align-items: center; justify-content: space-between; gap: var(--space-3); }
.face-name { font-size: var(--text-sm); font-weight: var(--weight-semibold); }
.face-icon { opacity: 0.9; }

/* Diagonal gloss, kept subtle so text stays legible. */
.shine {
  position: absolute;
  inset: 0;
  z-index: -1;
  background: linear-gradient(115deg, rgb(255 255 255 / 18%) 0%, transparent 42%);
  pointer-events: none;
}

/* --- Body ----------------------------------------------------------------- */

.body {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  padding: var(--space-4);
}

.balance {
  font-size: var(--text-xl);
  font-weight: var(--weight-bold);
  letter-spacing: -0.02em;
}

.negative { color: var(--danger); }
</style>
