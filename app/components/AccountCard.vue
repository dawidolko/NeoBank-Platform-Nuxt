<script setup lang="ts">
interface AccountLike {
  id: string
  name: string
  iban: string
  type: string
  status: string
  currency: string
  balanceCents: string
}

const props = defineProps<{ account: AccountLike }>()

const { money, iban } = useFormat()

const TYPE_ICONS: Record<string, string> = {
  CHECKING: '💳',
  SAVINGS: '🏦',
  CREDIT: '💠',
}

const icon = computed(() => TYPE_ICONS[props.account.type] ?? '💳')
const isNegative = computed(() => BigInt(props.account.balanceCents) < 0n)
</script>

<template>
  <NuxtLink :to="`/accounts/${account.id}`" class="account-card card">
    <div class="row-between">
      <span class="account-icon">{{ icon }}</span>
      <StatusBadge :status="account.status" />
    </div>

    <div>
      <p class="account-name truncate">{{ account.name }}</p>
      <p class="tiny muted mono">{{ iban(account.iban) }}</p>
    </div>

    <div>
      <p class="label">Available balance</p>
      <p class="account-balance numeric" :class="{ negative: isNegative }">
        {{ money(account.balanceCents, account.currency) }}
      </p>
    </div>
  </NuxtLink>
</template>

<style scoped>
.account-card {
  display: flex;
  flex-direction: column;
  gap: 15px;
  text-decoration: none;
  color: inherit;
  transition: border-color 0.15s ease, transform 0.15s ease, box-shadow 0.15s ease;
}

.account-card:hover {
  text-decoration: none;
  border-color: var(--primary);
  transform: translateY(-1px);
  box-shadow: var(--shadow);
}

.account-icon { font-size: 1.35rem; }
.account-name { font-weight: 620; font-size: 0.95rem; }

.account-balance {
  font-size: 1.35rem;
  font-weight: 680;
  letter-spacing: -0.02em;
}

.negative { color: var(--danger); }
</style>
