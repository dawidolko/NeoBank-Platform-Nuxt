<script setup lang="ts">
useHead({ title: 'Overview — NeoBank' })

const { user } = useAuth()
const { money } = useFormat()

const { data, pending } = await useFetch('/api/dashboard', { headers: useApiHeaders() })

const balances = computed(() => Object.entries(data.value?.summary.balancesByCurrency ?? {}))
const accounts = computed(() => data.value?.accounts ?? [])
const openAccounts = computed(() => accounts.value.filter((account) => account.status !== 'CLOSED'))
const recentEntries = computed(() => data.value?.recentEntries ?? [])

const greeting = computed(() => {
  const hour = new Date().getHours()

  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'

  return 'Good evening'
})

const netFlow = computed(() => {
  const summary = data.value?.summary

  if (!summary) return 0n

  return BigInt(summary.inflowCents) - BigInt(summary.outflowCents)
})
</script>

<template>
  <div class="stack">
    <div class="row-between">
      <div>
        <h1>{{ greeting }}, {{ user?.firstName }}</h1>
        <p class="muted small">Here is where your money stands today.</p>
      </div>
      <div class="row">
        <NuxtLink to="/transactions" class="btn btn-secondary">Statement</NuxtLink>
        <NuxtLink to="/transfer" class="btn">Send money</NuxtLink>
      </div>
    </div>

    <template v-if="pending">
      <div class="grid grid-4">
        <div v-for="n in 4" :key="n" class="card"><SkeletonBlock :rows="2" /></div>
      </div>
      <div class="card"><SkeletonBlock :rows="5" /></div>
    </template>

    <template v-else>
      <div class="grid grid-4">
        <StatCard
          v-for="[currency, amount] in balances"
          :key="currency"
          :label="`Total ${currency}`"
          :value="money(amount as string, currency)"
          hint="Across all accounts"
        />
        <StatCard
          label="Money in"
          :value="money(data?.summary.inflowCents ?? '0')"
          hint="Last 30 days"
          tone="positive"
        />
        <StatCard
          label="Money out"
          :value="money(data?.summary.outflowCents ?? '0')"
          hint="Last 30 days"
        />
        <StatCard
          label="Net change"
          :value="money(netFlow)"
          hint="Last 30 days"
          :tone="netFlow >= 0n ? 'positive' : 'negative'"
        />
      </div>

      <section class="stack">
        <div class="row-between">
          <h2>Your accounts</h2>
          <NuxtLink to="/accounts" class="small">Manage accounts →</NuxtLink>
        </div>

        <div v-if="openAccounts.length" class="grid grid-3">
          <AccountCard v-for="account in openAccounts" :key="account.id" :account="account" />
        </div>

        <div v-else class="card">
          <EmptyState icon="🏦" title="No accounts yet" description="Open one to get started.">
            <template #action>
              <NuxtLink to="/accounts" class="btn btn-sm">Open an account</NuxtLink>
            </template>
          </EmptyState>
        </div>
      </section>

      <section class="card">
        <div class="card-header">
          <h2 class="card-title">Recent activity</h2>
          <NuxtLink to="/transactions" class="small">View all →</NuxtLink>
        </div>

        <div v-if="recentEntries.length">
          <TransactionRow
            v-for="entry in recentEntries"
            :key="entry.id"
            :entry="entry"
            :to="`/transactions/${entry.id}`"
            show-account
          />
        </div>

        <EmptyState
          v-else
          icon="📭"
          title="No transactions yet"
          description="Your activity will appear here once money starts moving."
        >
          <template #action>
            <NuxtLink to="/transfer" class="btn btn-sm">Send your first transfer</NuxtLink>
          </template>
        </EmptyState>
      </section>
    </template>
  </div>
</template>
