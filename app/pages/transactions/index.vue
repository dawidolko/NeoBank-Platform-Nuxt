<script setup lang="ts">
useHead({ title: 'Transactions — NeoBank' })

const route = useRoute()
const router = useRouter()
const { signedMoney, dateTime, maskIban } = useFormat()
const { forEntry } = useCounterparty()

const { data: accountData } = await useFetch('/api/accounts', { headers: useApiHeaders() })
const accounts = computed(() => accountData.value?.accounts ?? [])

const filters = reactive({
  accountId: (route.query.accountId as string) ?? '',
  type: (route.query.type as string) ?? '',
  search: (route.query.search as string) ?? '',
  from: (route.query.from as string) ?? '',
  to: (route.query.to as string) ?? '',
  page: Number(route.query.page) || 1,
})

const query = computed(() => {
  const params: Record<string, string | number> = { page: filters.page, perPage: 20 }

  if (filters.accountId) params.accountId = filters.accountId
  if (filters.type) params.type = filters.type
  if (filters.search) params.search = filters.search
  if (filters.from) params.from = filters.from
  if (filters.to) params.to = filters.to

  return params
})

const { data, pending } = await useFetch('/api/transactions', {
  query,
  headers: useApiHeaders(),
})

const transactions = computed(() => data.value?.transactions ?? [])
const pagination = computed(() => data.value?.pagination)

watch(
  () => [filters.accountId, filters.type, filters.search, filters.from, filters.to],
  () => { filters.page = 1 },
)

// Mirror the full filter set into the URL so a filtered statement is shareable.
watch(query, (params) => {
  const clean: Record<string, string> = {}

  for (const [key, value] of Object.entries(params)) {
    if (key === 'perPage' || (key === 'page' && value === 1)) continue
    clean[key] = String(value)
  }

  router.replace({ query: clean })
})

function resetFilters() {
  filters.accountId = ''
  filters.type = ''
  filters.search = ''
  filters.from = ''
  filters.to = ''
  filters.page = 1
}

const hasFilters = computed(
  () => Boolean(filters.accountId || filters.type || filters.search || filters.from || filters.to),
)

const exportUrl = computed(() => {
  const params = new URLSearchParams()

  if (filters.accountId) params.set('accountId', filters.accountId)
  if (filters.from) params.set('from', filters.from)
  if (filters.to) params.set('to', filters.to)

  const qs = params.toString()

  return `/api/transactions/export${qs ? `?${qs}` : ''}`
})
</script>

<template>
  <div class="stack">
    <div class="row-between">
      <div>
        <h1>Transactions</h1>
        <p class="muted small">Every entry across your accounts.</p>
      </div>
      <div class="row">
        <a class="btn btn-secondary btn-sm" :href="exportUrl" download>Export CSV</a>
        <NuxtLink to="/transfer" class="btn btn-sm">Send money</NuxtLink>
      </div>
    </div>

    <section class="card">
      <h2 class="visually-hidden">Filters</h2>
      <div class="filters">
        <FormField v-slot="field" label="Account">
          <select :id="field.id" v-model="filters.accountId" class="select">
            <option value="">All accounts</option>
            <option v-for="account in accounts" :key="account.id" :value="account.id">
              {{ account.name }}
            </option>
          </select>
        </FormField>

        <FormField v-slot="field" label="Type">
          <select :id="field.id" v-model="filters.type" class="select">
            <option value="">All types</option>
            <option value="INTERNAL">Internal</option>
            <option value="EXTERNAL">External</option>
            <option value="DEPOSIT">Deposit</option>
            <option value="WITHDRAWAL">Withdrawal</option>
          </select>
        </FormField>

        <FormField v-slot="field" label="From">
          <input :id="field.id" v-model="filters.from" class="input" type="date">
        </FormField>

        <FormField v-slot="field" label="To">
          <input :id="field.id" v-model="filters.to" class="input" type="date">
        </FormField>

        <FormField v-slot="field" label="Search" class="filter-search">
          <input
            :id="field.id"
            v-model.lazy="filters.search"
            class="input"
            type="search"
            placeholder="Title, reference or recipient"
          >
        </FormField>

        <div class="field filter-reset">
          <button
            class="btn btn-secondary"
            type="button"
            :disabled="!hasFilters"
            @click="resetFilters"
          >
            Clear
          </button>
        </div>
      </div>
    </section>

    <section class="card">
      <SkeletonBlock v-if="pending" :rows="8" height="34px" />

      <template v-else-if="transactions.length">
        <div class="table-wrap" tabindex="0" role="region" aria-label="Transactions table">
          <table class="table">
            <caption class="visually-hidden">
              Your transactions, newest first
            </caption>
            <thead>
              <tr>
                <th scope="col">Date</th>
                <th scope="col">Description</th>
                <th scope="col">Counterparty</th>
                <th scope="col">Account</th>
                <th scope="col">Type</th>
                <th scope="col">Status</th>
                <th scope="col" class="align-right">Amount</th>
                <th scope="col" class="align-right">Balance</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="entry in transactions" :key="entry.id">
                <td class="tiny muted">{{ dateTime(entry.bookedAt) }}</td>
                <td>
                  <NuxtLink :to="`/transactions/${entry.id}`" class="cell-title truncate">
                    {{ entry.transfer.title }}
                  </NuxtLink>
                  <div class="tiny muted mono">{{ entry.transfer.reference }}</div>
                </td>
                <td>
                  <div class="truncate">{{ forEntry(entry.transfer, entry.direction) }}</div>
                  <div v-if="entry.transfer.externalIban" class="tiny muted mono">
                    {{ maskIban(entry.transfer.externalIban) }}
                  </div>
                </td>
                <td class="tiny">{{ entry.account.name }}</td>
                <td><span class="badge">{{ entry.transfer.type }}</span></td>
                <td><StatusBadge :status="entry.transfer.status" /></td>
                <td class="align-right numeric">
                  <span :class="entry.direction === 'CREDIT' ? 'amount-positive' : 'amount-negative'">
                    {{ signedMoney(entry.amountCents, entry.account.currency) }}
                  </span>
                </td>
                <td class="align-right numeric tiny muted">
                  {{ signedMoney(entry.balanceAfterCents, entry.account.currency).replace('+', '') }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <AppPagination
          v-if="pagination"
          :page="pagination.page"
          :pages="pagination.pages"
          :total="pagination.total"
          label="transactions"
          @update:page="filters.page = $event"
        />
      </template>

      <EmptyState
        v-else
        icon="🔍"
        title="No transactions found"
        :description="
          hasFilters
            ? 'Try widening your filters or clearing them.'
            : 'Activity will appear here once money moves.'
        "
      >
        <template v-if="hasFilters" #action>
          <button class="btn btn-secondary btn-sm" type="button" @click="resetFilters">
            Clear filters
          </button>
        </template>
      </EmptyState>
    </section>
  </div>
</template>

<style scoped>
.filters {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 12px;
  align-items: end;
}

.filter-search { grid-column: span 2; }
.filter-reset { justify-content: flex-end; }
.cell-title { font-weight: 570; max-width: 220px; display: block; color: inherit; }
.cell-title:hover { color: var(--primary); }

@media (max-width: 700px) {
  .filter-search { grid-column: span 1; }
}
</style>
