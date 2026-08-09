<script setup lang="ts">
useHead({ title: 'Transactions — Admin — NeoBank' })

const { money, dateTime, maskIban } = useFormat()

const search = ref('')
const status = ref('')
const page = ref(1)

const query = computed(() => ({
  page: page.value,
  perPage: 25,
  ...(search.value ? { search: search.value } : {}),
  ...(status.value ? { status: status.value } : {}),
}))

const { data, pending } = await useFetch('/api/admin/transactions', { query, headers: useApiHeaders() })

const transfers = computed(() => data.value?.transfers ?? [])
const pagination = computed(() => data.value?.pagination)

watch([search, status], () => { page.value = 1 })

function partyLabel(
  account: { name: string; user: { firstName: string; lastName: string } } | null,
  fallbackName?: string | null,
  fallbackIban?: string | null,
): string {
  if (account) return `${account.user.firstName} ${account.user.lastName}`
  if (fallbackName) return fallbackName
  if (fallbackIban) return maskIban(fallbackIban)

  return '—'
}
</script>

<template>
  <div class="stack">
    <div class="row-between">
      <div>
        <NuxtLink to="/admin" class="small">← Admin</NuxtLink>
        <h1>All transactions</h1>
        <p class="muted small">Bank-wide transfer ledger.</p>
      </div>
      <div class="row">
        <select v-model="status" class="select status-filter">
          <option value="">All statuses</option>
          <option value="COMPLETED">Completed</option>
          <option value="PENDING">Pending</option>
          <option value="FAILED">Failed</option>
          <option value="REVERSED">Reversed</option>
        </select>
        <input v-model.lazy="search" class="input search" placeholder="Reference, title or IBAN">
      </div>
    </div>

    <section class="card">
      <div v-if="pending" class="empty">Loading transfers…</div>

      <template v-else-if="transfers.length">
        <div class="table-wrap">
          <table class="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Reference</th>
                <th>Description</th>
                <th>From</th>
                <th>To</th>
                <th>Type</th>
                <th>Status</th>
                <th class="align-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="transfer in transfers" :key="transfer.id">
                <td class="tiny muted">{{ dateTime(transfer.createdAt) }}</td>
                <td class="mono tiny">{{ transfer.reference }}</td>
                <td class="truncate cell-title">{{ transfer.title }}</td>
                <td class="tiny">{{ partyLabel(transfer.sourceAccount) }}</td>
                <td class="tiny">
                  {{ partyLabel(transfer.destinationAccount, transfer.externalName, transfer.externalIban) }}
                </td>
                <td><span class="badge">{{ transfer.type }}</span></td>
                <td><StatusBadge :status="transfer.status" /></td>
                <td class="align-right numeric">
                  {{ money(transfer.amountCents, transfer.currency) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div v-if="pagination && pagination.pages > 1" class="pagination">
          <button class="btn btn-secondary btn-sm" type="button" :disabled="page <= 1" @click="page -= 1">
            Previous
          </button>
          <span class="small muted">
            Page {{ pagination.page }} of {{ pagination.pages }} · {{ pagination.total }} transfers
          </span>
          <button
            class="btn btn-secondary btn-sm"
            type="button"
            :disabled="page >= pagination.pages"
            @click="page += 1"
          >
            Next
          </button>
        </div>
      </template>

      <EmptyState v-else icon="🔍" title="No transfers found" />
    </section>
  </div>
</template>

<style scoped>
.search { max-width: 230px; }
.status-filter { max-width: 160px; }
.cell-title { max-width: 200px; }

.pagination {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding-top: 15px;
  border-top: 1px solid var(--border);
  flex-wrap: wrap;
}
</style>
