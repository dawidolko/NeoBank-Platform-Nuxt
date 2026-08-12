<script setup lang="ts">
useSeoMeta({
  title: 'Overview — NeoBank',
  description: 'Your balances, recent activity and 30-day money flow.',
  robots: 'noindex',
})

const { user } = useAuth()
const { money, signedMoney } = useFormat()

const { data, pending } = await useFetch('/api/dashboard', { headers: useApiHeaders() })

const summary = computed(() => data.value?.summary)
const accounts = computed(() => data.value?.accounts ?? [])
const openAccounts = computed(() => accounts.value.filter((account) => account.status !== 'CLOSED'))
const recentEntries = computed(() => data.value?.recentEntries ?? [])

const primaryCurrency = computed(() => summary.value?.primaryCurrency ?? 'PLN')
const balances = computed(() => Object.entries(summary.value?.balancesByCurrency ?? {}))

/** Flow figures for the currency the customer holds most of. */
const primaryFlow = computed(() => {
  const flow = summary.value?.flowByCurrency?.[primaryCurrency.value]

  return {
    inflowCents: flow?.inflowCents ?? '0',
    outflowCents: flow?.outflowCents ?? '0',
  }
})

const netFlowCents = computed(
  () => BigInt(primaryFlow.value.inflowCents) - BigInt(primaryFlow.value.outflowCents),
)

const trend = computed(() => summary.value?.balanceTrend ?? [])

/** Change over the charted window, used for the headline delta. */
const trendDelta = computed(() => {
  const points = trend.value

  if (points.length < 2) return 0n

  return BigInt(points[points.length - 1]!.balanceCents) - BigInt(points[0]!.balanceCents)
})

const greeting = computed(() => {
  const hour = new Date().getHours()

  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'

  return 'Good evening'
})

const quickActions = [
  { to: '/transfer', icon: 'send', label: 'Send' },
  { to: '/accounts', icon: 'plus', label: 'Top up' },
  { to: '/transactions', icon: 'receipt', label: 'Statement' },
  { to: '/beneficiaries', icon: 'users', label: 'Recipients' },
] as const

/** Largest outgoing payments in the window, as a simple ranked breakdown. */
const topSpending = computed(() => {
  const byName = new Map<string, bigint>()

  for (const entry of recentEntries.value) {
    if (entry.direction !== 'DEBIT') continue

    const key = entry.transfer.title
    const amount = BigInt(entry.amountCents)

    byName.set(key, (byName.get(key) ?? 0n) + (amount < 0n ? -amount : amount))
  }

  const rows = [...byName.entries()].sort(([, a], [, b]) => (b > a ? 1 : b < a ? -1 : 0)).slice(0, 5)
  const largest = rows[0]?.[1] ?? 1n

  return rows.map(([title, total]) => ({
    title,
    total,
    share: Number((total * 100n) / (largest || 1n)),
  }))
})
</script>

<template>
  <div class="stack">
    <div class="row-between">
      <div>
        <h1>{{ greeting }}, {{ user?.firstName }}</h1>
        <p class="muted small">Here is where your money stands today.</p>
      </div>

      <nav class="quick-actions" aria-label="Quick actions">
        <NuxtLink v-for="action in quickActions" :key="action.to" :to="action.to" class="quick">
          <span class="quick-icon"><AppIcon :name="action.icon" :size="18" /></span>
          <span class="tiny">{{ action.label }}</span>
        </NuxtLink>
      </nav>
    </div>

    <template v-if="pending">
      <div class="card"><SkeletonBlock :rows="3" height="30px" /></div>
      <div class="grid grid-3">
        <div v-for="n in 3" :key="n" class="card"><SkeletonBlock :rows="3" /></div>
      </div>
      <div class="card"><SkeletonBlock :rows="6" /></div>
    </template>

    <template v-else>
      <section class="hero-card card">
        <div class="hero-grid">
          <div class="hero-primary">
            <span class="label">Total balance · {{ primaryCurrency }}</span>
            <p class="hero-balance numeric">
              {{ money(summary?.balancesByCurrency?.[primaryCurrency] ?? '0', primaryCurrency) }}
            </p>
            <p class="hero-delta small" :class="trendDelta >= 0n ? 'up' : 'down'">
              <AppIcon :name="trendDelta >= 0n ? 'trending-up' : 'trending-down'" :size="15" />
              {{ signedMoney(trendDelta, primaryCurrency) }}
              <span class="muted">in the last 30 days</span>
            </p>

            <div class="hero-flows">
              <div class="flow">
                <span class="flow-dot in" aria-hidden="true" />
                <div>
                  <span class="tiny muted">Money in</span>
                  <p class="numeric flow-value">
                    {{ money(primaryFlow.inflowCents, primaryCurrency) }}
                  </p>
                </div>
              </div>
              <div class="flow">
                <span class="flow-dot out" aria-hidden="true" />
                <div>
                  <span class="tiny muted">Money out</span>
                  <p class="numeric flow-value">
                    {{ money(primaryFlow.outflowCents, primaryCurrency) }}
                  </p>
                </div>
              </div>
              <div class="flow">
                <span class="flow-dot net" aria-hidden="true" />
                <div>
                  <span class="tiny muted">Net</span>
                  <p class="numeric flow-value" :class="netFlowCents >= 0n ? 'amount-positive' : ''">
                    {{ signedMoney(netFlowCents, primaryCurrency) }}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div class="hero-chart">
            <SparkLine
              :points="trend"
              :tone="trendDelta >= 0n ? 'success' : 'danger'"
              label="Balance over the last 30 days"
            />
            <div class="chart-axis tiny subtle">
              <span>30 days ago</span>
              <span>Today</span>
            </div>
          </div>
        </div>
      </section>

      <div v-if="balances.length > 1" class="grid grid-4">
        <StatCard
          v-for="[currency, amount] in balances"
          :key="currency"
          :label="`Total ${currency}`"
          :value="money(amount as string, currency)"
          hint="Across open accounts"
          icon="globe"
        />
      </div>

      <section class="stack">
        <div class="row-between">
          <h2>Your accounts</h2>
          <NuxtLink to="/accounts" class="small link-arrow">
            Manage accounts <AppIcon name="arrow-right" :size="14" />
          </NuxtLink>
        </div>

        <div v-if="openAccounts.length" class="grid grid-3">
          <AccountCard
            v-for="(account, index) in openAccounts"
            :key="account.id"
            :account="account"
            class="animate-rise"
            :style="{ animationDelay: `${index * 60}ms` }"
          />
        </div>

        <div v-else class="card">
          <EmptyState icon="landmark" title="No accounts yet" description="Open one to get started.">
            <template #action>
              <NuxtLink to="/accounts" class="btn btn-sm">Open an account</NuxtLink>
            </template>
          </EmptyState>
        </div>
      </section>

      <div class="grid dashboard-split">
        <section class="card">
          <div class="card-header">
            <h2 class="card-title">Recent activity</h2>
            <NuxtLink to="/transactions" class="small link-arrow">
              View all <AppIcon name="arrow-right" :size="14" />
            </NuxtLink>
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
            icon="inbox"
            title="No transactions yet"
            description="Your activity will appear here once money starts moving."
          >
            <template #action>
              <NuxtLink to="/transfer" class="btn btn-sm">Send your first transfer</NuxtLink>
            </template>
          </EmptyState>
        </section>

        <section class="card">
          <div class="card-header">
            <h2 class="card-title">Top payments</h2>
            <span class="tiny muted">Recent</span>
          </div>

          <ul v-if="topSpending.length" class="spend-list">
            <li v-for="row in topSpending" :key="row.title" class="spend">
              <div class="row-between spend-head">
                <span class="truncate spend-title">{{ row.title }}</span>
                <span class="numeric tiny">{{ money(row.total, primaryCurrency) }}</span>
              </div>
              <div class="meter" role="presentation">
                <span class="meter-fill" :style="{ width: `${Math.max(row.share, 6)}%` }" />
              </div>
            </li>
          </ul>

          <EmptyState v-else icon="chart-bar" title="Nothing spent yet" />
        </section>
      </div>
    </template>
  </div>
</template>

<style scoped>
.quick-actions { display: flex; gap: var(--space-2); flex-wrap: wrap; }

.quick {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-2) var(--space-3);
  min-width: 72px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface);
  color: var(--text-muted);
  transition:
    border-color var(--duration-fast) var(--ease),
    color var(--duration-fast) var(--ease),
    transform var(--duration-fast) var(--ease);
}

.quick:hover {
  border-color: var(--primary);
  color: var(--primary);
  transform: translateY(-2px);
}

.quick-icon {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  border-radius: var(--radius-full);
  background: var(--primary-soft);
  color: var(--primary);
}

/* --- Hero ---------------------------------------------------------------- */

.hero-card {
  padding: var(--space-6);
  background:
    radial-gradient(120% 140% at 100% 0%, var(--primary-soft) 0%, transparent 60%),
    var(--surface);
  overflow: hidden;
}

.hero-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.05fr);
  gap: var(--space-6);
  align-items: center;
}

.hero-balance {
  font-size: clamp(1.9rem, 4vw, 2.6rem);
  font-weight: var(--weight-bold);
  letter-spacing: -0.03em;
  line-height: 1.1;
  margin-top: var(--space-1);
}

.hero-delta {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  margin-top: var(--space-2);
  font-weight: var(--weight-medium);
}

.hero-delta.up { color: var(--success); }
.hero-delta.down { color: var(--danger); }

.hero-flows {
  display: flex;
  gap: var(--space-6);
  margin-top: var(--space-6);
  padding-top: var(--space-5);
  border-top: 1px solid var(--border);
  flex-wrap: wrap;
}

.flow { display: flex; align-items: flex-start; gap: var(--space-2); }
.flow-value { font-weight: var(--weight-semibold); font-size: var(--text-md); }

.flow-dot {
  width: 8px;
  height: 8px;
  margin-top: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}

.flow-dot.in { background: var(--success); }
.flow-dot.out { background: var(--text-subtle); }
.flow-dot.net { background: var(--primary); }

.hero-chart { height: 190px; display: flex; flex-direction: column; }
.hero-chart > :first-child { flex: 1; min-height: 0; }

.chart-axis {
  display: flex;
  justify-content: space-between;
  margin-top: var(--space-2);
}

/* --- Split ---------------------------------------------------------------- */

.dashboard-split { grid-template-columns: minmax(0, 1.7fr) minmax(0, 1fr); }

.link-arrow { display: inline-flex; align-items: center; gap: var(--space-1); }

.spend-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: var(--space-4); }
.spend-head { gap: var(--space-3); margin-bottom: var(--space-2); }
.spend-title { font-size: var(--text-sm); font-weight: var(--weight-medium); }

.meter {
  height: 6px;
  border-radius: var(--radius-full);
  background: var(--surface-muted);
  overflow: hidden;
}

.meter-fill {
  display: block;
  height: 100%;
  border-radius: var(--radius-full);
  background: linear-gradient(90deg, var(--primary) 0%, #6f4bf0 100%);
}

@media (max-width: 900px) {
  .hero-grid { grid-template-columns: 1fr; }
  .dashboard-split { grid-template-columns: 1fr; }
  .hero-chart { height: 150px; }
}

@media (max-width: 560px) {
  .quick-actions { width: 100%; }
  .quick { flex: 1; min-width: 0; }
}
</style>
