<script setup lang="ts">
useSeoMeta({ title: 'Insights — NeoBank', robots: 'noindex' })

const { money } = useFormat()

const days = ref(90)
const currency = ref('')

const query = computed(() => ({
  days: days.value,
  ...(currency.value ? { currency: currency.value } : {}),
}))

const { data, pending } = await useFetch('/api/analytics/spending', {
  query,
  headers: useApiHeaders(),
})
const { data: accountData } = await useFetch('/api/accounts', { headers: useApiHeaders() })

const currencies = computed(() => [
  ...new Set((accountData.value?.accounts ?? []).map((account) => account.currency)),
])

const categories = computed(() => data.value?.categories ?? [])
const months = computed(() => data.value?.months ?? [])
const totalCents = computed(() => data.value?.totalCents ?? '0')
const activeCurrency = computed(() => data.value?.currency ?? 'PLN')

/** Average per 30 days over the selected window, for a like-for-like figure. */
const monthlyAverage = computed(() => {
  const total = BigInt(totalCents.value)
  const windowDays = BigInt(data.value?.days ?? days.value)

  return windowDays > 0n ? (total * 30n) / windowDays : 0n
})

const largestMonth = computed(() =>
  months.value.reduce((max, month) => (BigInt(month.amountCents) > max ? BigInt(month.amountCents) : max), 0n),
)

function monthLabel(month: string): string {
  const [year, index] = month.split('-')

  return new Intl.DateTimeFormat('en-GB', { month: 'short', year: '2-digit' }).format(
    new Date(Number(year), Number(index) - 1, 1),
  )
}
</script>

<template>
  <div class="stack">
    <div class="row-between">
      <div>
        <h1>Insights</h1>
        <p class="muted small">Where your money actually goes.</p>
      </div>

      <div class="row filters">
        <FormField v-slot="field" label="Currency">
          <select :id="field.id" v-model="currency" class="select">
            <option value="">Primary</option>
            <option v-for="code in currencies" :key="code" :value="code">{{ code }}</option>
          </select>
        </FormField>

        <FormField v-slot="field" label="Period">
          <select :id="field.id" v-model.number="days" class="select">
            <option :value="30">Last 30 days</option>
            <option :value="90">Last 90 days</option>
            <option :value="180">Last 6 months</option>
            <option :value="365">Last year</option>
          </select>
        </FormField>
      </div>
    </div>

    <template v-if="pending">
      <div class="card"><SkeletonBlock :rows="6" /></div>
    </template>

    <template v-else-if="categories.length">
      <div class="grid grid-3">
        <StatCard
          label="Total spent"
          :value="money(totalCents, activeCurrency)"
          :hint="`Last ${data?.days ?? days} days`"
          icon="chart-pie"
        />
        <StatCard
          label="Monthly average"
          :value="money(monthlyAverage, activeCurrency)"
          hint="Normalised to 30 days"
          icon="calendar-clock"
        />
        <StatCard
          label="Largest category"
          :value="categories[0]?.label ?? '—'"
          :hint="categories[0] ? `${categories[0].share}% of spending` : undefined"
          icon="chart-bar"
        />
      </div>

      <div class="grid insights-split">
        <section class="card">
          <div class="card-header">
            <h2 class="card-title">By category</h2>
            <span class="tiny muted">{{ activeCurrency }}</span>
          </div>

          <div class="breakdown">
            <DonutChart
              :slices="categories"
              center-label="Total"
              :center-value="money(totalCents, activeCurrency)"
            />

            <ul class="legend">
              <li v-for="row in categories" :key="row.category" class="legend-row">
                <span class="legend-dot" :style="{ background: `hsl(${row.hue})` }" />
                <span class="legend-label truncate">{{ row.label }}</span>
                <span class="tiny muted numeric">{{ row.share }}%</span>
                <span class="numeric legend-amount">
                  {{ money(row.amountCents, activeCurrency) }}
                </span>
              </li>
            </ul>
          </div>
        </section>

        <section class="card">
          <div class="card-header">
            <h2 class="card-title">By month</h2>
          </div>

          <ul v-if="months.length" class="bars">
            <li v-for="row in months" :key="row.month" class="bar-row">
              <span class="tiny muted bar-label">{{ monthLabel(row.month) }}</span>
              <span class="bar-track">
                <span
                  class="bar-fill"
                  :style="{
                    width: `${largestMonth > 0n ? Number((BigInt(row.amountCents) * 100n) / largestMonth) : 0}%`,
                  }"
                />
              </span>
              <span class="tiny numeric bar-value">{{ money(row.amountCents, activeCurrency) }}</span>
            </li>
          </ul>

          <EmptyState v-else icon="chart-bar" title="Not enough history yet" />
        </section>
      </div>
    </template>

    <div v-else class="card">
      <EmptyState
        icon="chart-pie"
        title="No spending in this period"
        description="Once money leaves an account it is categorised and shown here."
      >
        <template #action>
          <NuxtLink to="/transactions" class="btn btn-sm">View transactions</NuxtLink>
        </template>
      </EmptyState>
    </div>
  </div>
</template>

<style scoped>
.filters { align-items: flex-end; gap: var(--space-3); }
.filters :deep(.select) { min-width: 150px; }

.insights-split { grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr); }

.breakdown {
  display: flex;
  align-items: center;
  gap: var(--space-6);
  flex-wrap: wrap;
}

.legend { list-style: none; margin: 0; padding: 0; flex: 1; min-width: 220px; display: flex; flex-direction: column; }

.legend-row {
  display: grid;
  grid-template-columns: 10px minmax(0, 1fr) auto auto;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-2) 0;
  border-bottom: 1px solid var(--border);
}

.legend-row:last-child { border-bottom: none; }
.legend-dot { width: 10px; height: 10px; border-radius: 50%; }
.legend-label { font-size: var(--text-sm); }
.legend-amount { font-size: var(--text-sm); font-weight: var(--weight-semibold); }

.bars { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: var(--space-3); }

.bar-row {
  display: grid;
  grid-template-columns: 52px minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--space-3);
}

.bar-track { height: 8px; border-radius: var(--radius-full); background: var(--surface-muted); overflow: hidden; }

.bar-fill {
  display: block;
  height: 100%;
  border-radius: var(--radius-full);
  background: linear-gradient(90deg, var(--primary) 0%, #6f4bf0 100%);
  transition: width var(--duration-slow) var(--ease-out);
}

@media (max-width: 900px) {
  .insights-split { grid-template-columns: 1fr; }
}
</style>
