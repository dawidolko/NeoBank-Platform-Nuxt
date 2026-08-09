<script setup lang="ts">
useHead({ title: 'Transactions — NeoBank' })

const route = useRoute()
const router = useRouter()
const { signedMoney, dateTime, maskIban } = useFormat()

const { data: accountData } = await useFetch('/api/accounts', { headers: useApiHeaders() })
const accounts = computed(() => accountData.value?.accounts ?? [])

const filters = reactive({
  accountId: (route.query.accountId as string) ?? '',
  type: '',
  search: '',
  from: '',
  to: '',
  page: 1,
})

// Only send filters that are actually set — empty strings would fail validation.
const query = computed(() => {
  const params: Record<string, string | number> = { page: filters.page, perPage: 20 }

  if (filters.accountId) params.accountId = filters.accountId
  if (filters.type) params.type = filters.type
  if (filters.search) params.search = filters.search
  if (filters.from) params.from = filters.from
  if (filters.to) params.to = filters.to

  return params
})

const { data, pending } = await useFetch('/api/transactions', { query, headers: useApiHeaders() })

const transactions = computed(() => data.value?.transactions ?? [])
const pagination = computed(() => data.value?.pagination)

// Any filter change resets to the first page, otherwise page 3 of a new filter 404s visually.
watch(
  () => [filters.accountId, filters.type, filters.search, filters.from, filters.to],
  () => { filters.page = 1 },
)

// Keep the account filter shareable in the URL.
watch(
  () => filters.accountId,
  (accountId) => {
    router.replace({ query: accountId ? { accountId } : {} })
  },
)

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

function counterpartyOf(entry: (typeof transactions.value)[number]): string {
  const transfer = entry.transfer

  if (transfer.externalName) return transfer.externalName

  const isCredit = entry.direction === 'CREDIT'
  const other = isCredit ? transfer.sourceAccount : transfer.destinationAccount

  if (other?.user) return `${other.user.firstName} ${other.user.lastName}`
  if (transfer.type === 'DEPOSIT') return 'Incoming payment'

  return '—'
}
</script>

<template>
  <div class="stack">
    <div class="row-between">
      <div>
        <h1>Transactions</h1>
        <p class="muted small">Every entry across your accounts.</p>
      </div>
      <NuxtLink to="/transfer" class="btn btn-sm">Send money</NuxtLink>
    </div>

    <section class="card">
      <div class="filters">
        <div class="field">
          <label class="field-label" for="filter-account">Account</label>
          <select id="filter-account" v-model="filters.accountId" class="select">
            <option value="">All accounts</option>
            <option v-for="account in accounts" :key="account.id" :value="account.id">
              {{ account.name }}
            </option>
          </select>
        </div>

        <div class="field">
          <label class="field-label" for="filter-type">Type</label>
          <select id="filter-type" v-model="filters.type" class="select">
            <option value="">All types</option>
            <option value="INTERNAL">Internal</option>
            <option value="EXTERNAL">External</option>
            <option value="DEPOSIT">Deposit</option>
            <option value="WITHDRAWAL">Withdrawal</option>
          </select>
        </div>

        <div class="field">
          <label class="field-label" for="filter-from">From</label>
          <input id="filter-from" v-model="filters.from" class="input" type="date">
        </div>

        <div class="field">
          <label class="field-label" for="filter-to">To</label>
          <input id="filter-to" v-model="filters.to" class="input" type="date">
        </div>

        <div class="field filter-search">
          <label class="field-label" for="filter-search">Search</label>
          <input
            id="filter-search"
            v-model.lazy="filters.search"
            class="input"
            placeholder="Title, reference or recipient"
          >
        </div>

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
      <div v-if="pending" class="empty">Loading transactions…</div>

      <template v-else-if="transactions.length">
        <div class="table-wrap">
          <table class="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Description</th>
                <th>Counterparty</th>
                <th>Account</th>
                <th>Type</th>
                <th>Status</th>
                <th class="align-right">Amount</th>
                <th class="align-right">Balance</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="entry in transactions" :key="entry.id">
                <td class="tiny muted">{{ dateTime(entry.bookedAt) }}</td>
                <td>
                  <div class="cell-title truncate">{{ entry.transfer.title }}</div>
                  <div class="tiny muted mono">{{ entry.transfer.reference }}</div>
                </td>
                <td>
                  <div class="truncate">{{ counterpartyOf(entry) }}</div>
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

        <div v-if="pagination && pagination.pages > 1" class="pagination">
          <button
            class="btn btn-secondary btn-sm"
            type="button"
            :disabled="filters.page <= 1"
            @click="filters.page -= 1"
          >
            Previous
          </button>
          <span class="small muted">
            Page {{ pagination.page }} of {{ pagination.pages }} · {{ pagination.total }} entries
          </span>
          <button
            class="btn btn-secondary btn-sm"
            type="button"
            :disabled="filters.page >= pagination.pages"
            @click="filters.page += 1"
          >
            Next
          </button>
        </div>
      </template>

      <EmptyState
        v-else
        icon="🔍"
        title="No transactions found"
        :description="hasFilters ? 'Try widening your filters.' : 'Activity will appear here once money moves.'"
      />
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
.cell-title { font-weight: 570; max-width: 220px; }

.pagination {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding-top: 15px;
  margin-top: 6px;
  border-top: 1px solid var(--border);
  flex-wrap: wrap;
}

@media (max-width: 700px) {
  .filter-search { grid-column: span 1; }
}
</style>
