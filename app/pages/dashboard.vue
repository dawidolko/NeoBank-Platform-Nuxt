<script setup lang="ts">
useHead({ title: 'Overview — NeoBank' })

const { user } = useAuth()
const { money } = useFormat()

const { data, pending, refresh } = await useFetch('/api/dashboard', { headers: useApiHeaders() })

const balances = computed(() => Object.entries(data.value?.summary.balancesByCurrency ?? {}))
const accounts = computed(() => data.value?.accounts ?? [])
const recentEntries = computed(() => data.value?.recentEntries ?? [])

const greeting = computed(() => {
  const hour = new Date().getHours()

  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'

  return 'Good evening'
})
</script>

<template>
  <div class="stack">
    <div class="row-between">
      <div>
        <h1>{{ greeting }}, {{ user?.firstName }}</h1>
        <p class="muted small">Here is where your money stands today.</p>
      </div>
      <NuxtLink to="/transfer" class="btn">Send money</NuxtLink>
    </div>

    <div v-if="pending" class="card empty">Loading your accounts…</div>

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
      </div>

      <section class="stack">
        <div class="row-between">
          <h2>Your accounts</h2>
          <NuxtLink to="/accounts" class="small">Manage accounts →</NuxtLink>
        </div>

        <div v-if="accounts.length" class="grid grid-3">
          <AccountCard v-for="account in accounts" :key="account.id" :account="account" />
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
            :entry="entry as never"
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
            <button class="btn btn-secondary btn-sm" type="button" @click="refresh()">Refresh</button>
          </template>
        </EmptyState>
      </section>
    </template>
  </div>
</template>
