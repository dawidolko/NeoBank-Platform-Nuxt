<script setup lang="ts">
useHead({ title: 'Users — Admin — NeoBank' })

const { user: currentUser } = useAuth()
const { money, date } = useFormat()

const search = ref('')
const page = ref(1)

const query = computed(() => ({
  page: page.value,
  perPage: 20,
  ...(search.value ? { search: search.value } : {}),
}))

const { data, pending, refresh } = await useFetch('/api/admin/users', { query, headers: useApiHeaders() })

const users = computed(() => data.value?.users ?? [])
const pagination = computed(() => data.value?.pagination)

watch(search, () => { page.value = 1 })

const updatingId = ref<string | null>(null)
const errorMessage = ref('')

/** Total balance across a user's accounts, grouped by currency. */
function balanceSummary(accounts: Array<{ balanceCents: string; currency: string }>): string {
  if (accounts.length === 0) return '—'

  const byCurrency = new Map<string, bigint>()

  for (const account of accounts) {
    byCurrency.set(account.currency, (byCurrency.get(account.currency) ?? 0n) + BigInt(account.balanceCents))
  }

  return [...byCurrency.entries()]
    .map(([currency, total]) => money(total, currency))
    .join(' · ')
}

async function updateUser(id: string, payload: { status?: string; role?: string }) {
  updatingId.value = id
  errorMessage.value = ''

  try {
    await $fetch(`/api/admin/users/${id}`, { method: 'PATCH', body: payload })
    await refresh()
  } catch (error) {
    const data = (error as { data?: { data?: { errors?: Record<string, string> } } }).data?.data
    errorMessage.value = data?.errors?.form ?? 'Could not update the user.'
  } finally {
    updatingId.value = null
  }
}
</script>

<template>
  <div class="stack">
    <div class="row-between">
      <div>
        <NuxtLink to="/admin" class="small">← Admin</NuxtLink>
        <h1>Users</h1>
        <p class="muted small">Suspend access or grant administrator rights.</p>
      </div>
      <input v-model.lazy="search" class="input search" placeholder="Search name or email">
    </div>

    <div v-if="errorMessage" class="alert alert-error">{{ errorMessage }}</div>

    <section class="card">
      <div v-if="pending" class="empty">Loading users…</div>

      <template v-else-if="users.length">
        <div class="table-wrap">
          <table class="table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Role</th>
                <th>Status</th>
                <th>Accounts</th>
                <th>Balances</th>
                <th>Joined</th>
                <th class="align-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in users" :key="row.id">
                <td>
                  <div class="cell-name">{{ row.firstName }} {{ row.lastName }}</div>
                  <div class="tiny muted truncate">{{ row.email }}</div>
                </td>
                <td><StatusBadge :status="row.role" /></td>
                <td><StatusBadge :status="row.status" /></td>
                <td class="numeric">{{ row.accounts.length }}</td>
                <td class="tiny numeric">{{ balanceSummary(row.accounts) }}</td>
                <td class="tiny muted">{{ date(row.createdAt) }}</td>
                <td class="align-right">
                  <div v-if="row.id === currentUser?.id" class="tiny muted">You</div>
                  <div v-else class="row actions">
                    <button
                      class="btn btn-secondary btn-sm"
                      type="button"
                      :disabled="updatingId === row.id"
                      @click="updateUser(row.id, { status: row.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE' })"
                    >
                      {{ row.status === 'ACTIVE' ? 'Suspend' : 'Reactivate' }}
                    </button>
                    <button
                      class="btn btn-ghost btn-sm"
                      type="button"
                      :disabled="updatingId === row.id"
                      @click="updateUser(row.id, { role: row.role === 'ADMIN' ? 'CUSTOMER' : 'ADMIN' })"
                    >
                      {{ row.role === 'ADMIN' ? 'Revoke admin' : 'Make admin' }}
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div v-if="pagination && pagination.pages > 1" class="pagination">
          <button class="btn btn-secondary btn-sm" type="button" :disabled="page <= 1" @click="page -= 1">
            Previous
          </button>
          <span class="small muted">Page {{ pagination.page }} of {{ pagination.pages }}</span>
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

      <EmptyState v-else icon="🔍" title="No users found" />
    </section>
  </div>
</template>

<style scoped>
.search { max-width: 260px; }
.cell-name { font-weight: 600; }
.actions { justify-content: flex-end; flex-wrap: wrap; gap: 6px; }

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
