<script setup lang="ts">
useHead({ title: 'Transactions — Admin — NeoBank' })

const { money, dateTime } = useFormat()
const { forSide } = useCounterparty()

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
      <SkeletonBlock v-if="pending" :rows="8" height="34px" />

      <template v-else-if="transfers.length">
        <div class="table-wrap" tabindex="0" role="region" aria-label="All transfers table">
          <table class="table">
            <caption class="visually-hidden">Bank-wide transfer ledger</caption>
            <thead>
              <tr>
                <th scope="col">Date</th>
                <th scope="col">Reference</th>
                <th scope="col">Description</th>
                <th scope="col">From</th>
                <th scope="col">To</th>
                <th scope="col">Type</th>
                <th scope="col">Status</th>
                <th scope="col" class="align-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="transfer in transfers" :key="transfer.id">
                <td class="tiny muted">{{ dateTime(transfer.createdAt) }}</td>
                <td class="mono tiny">{{ transfer.reference }}</td>
                <td class="truncate cell-title">{{ transfer.title }}</td>
                <td class="tiny">{{ forSide(transfer.sourceAccount) }}</td>
                <td class="tiny">
                  {{ forSide(transfer.destinationAccount, transfer.externalName, transfer.externalIban) }}
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

        <AppPagination
          v-if="pagination"
          :page="pagination.page"
          :pages="pagination.pages"
          :total="pagination.total"
          label="transfers"
          @update:page="page = $event"
        />
      </template>

      <EmptyState v-else icon="search" title="No transfers found" />
    </section>
  </div>
</template>

<style scoped>
.search { max-width: 230px; }
.status-filter { max-width: 160px; }
.cell-title { max-width: 200px; }

</style>
