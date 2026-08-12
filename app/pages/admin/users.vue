<script setup lang="ts">
useHead({ title: 'Users — Admin — NeoBank' })

const { user: currentUser } = useAuth()
const { money, date } = useFormat()
const toast = useToast()

const search = ref('')
const page = ref(1)

const query = computed(() => ({
  page: page.value,
  perPage: 20,
  ...(search.value ? { search: search.value } : {}),
}))

const { data, pending, refresh } = await useFetch('/api/admin/users', {
  query,
  headers: useApiHeaders(),
})

const users = computed(() => data.value?.users ?? [])
const pagination = computed(() => data.value?.pagination)

watch(search, () => { page.value = 1 })

interface PendingAction {
  id: string
  name: string
  payload: { status?: string; role?: string }
  title: string
  description: string
  confirmLabel: string
  tone: 'primary' | 'danger'
}

const pendingAction = ref<PendingAction | null>(null)
const applying = ref(false)

function balanceSummary(accounts: Array<{ balanceCents: string; currency: string }>): string {
  if (accounts.length === 0) return '—'

  const byCurrency = new Map<string, bigint>()

  for (const account of accounts) {
    byCurrency.set(
      account.currency,
      (byCurrency.get(account.currency) ?? 0n) + BigInt(account.balanceCents),
    )
  }

  return [...byCurrency.entries()].map(([currency, total]) => money(total, currency)).join(' · ')
}

function askStatusChange(row: { id: string; firstName: string; lastName: string; status: string }) {
  const name = `${row.firstName} ${row.lastName}`
  const suspending = row.status === 'ACTIVE'

  pendingAction.value = {
    id: row.id,
    name,
    payload: { status: suspending ? 'SUSPENDED' : 'ACTIVE' },
    title: suspending ? 'Suspend this customer?' : 'Reactivate this customer?',
    description: suspending
      ? `${name} will be signed out of every device immediately and blocked from signing in until reactivated.`
      : `${name} will be able to sign in and use their accounts again.`,
    confirmLabel: suspending ? 'Suspend' : 'Reactivate',
    tone: suspending ? 'danger' : 'primary',
  }
}

function askRoleChange(row: { id: string; firstName: string; lastName: string; role: string }) {
  const name = `${row.firstName} ${row.lastName}`
  const promoting = row.role !== 'ADMIN'

  pendingAction.value = {
    id: row.id,
    name,
    payload: { role: promoting ? 'ADMIN' : 'CUSTOMER' },
    title: promoting ? 'Grant administrator access?' : 'Revoke administrator access?',
    description: promoting
      ? `${name} will be able to see every customer's balances, the full ledger and the audit log, and to suspend other users.`
      : `${name} will lose access to the admin panel and keep only their customer account.`,
    confirmLabel: promoting ? 'Grant admin' : 'Revoke admin',
    tone: 'danger',
  }
}

async function applyAction() {
  if (!pendingAction.value) return

  applying.value = true

  const { id, name, payload, confirmLabel } = pendingAction.value

  try {
    await $fetch(`/api/admin/users/${id}`, { method: 'PATCH', body: payload })
    toast.success(`${confirmLabel} applied`, name)
    pendingAction.value = null
    await refresh()
  } catch (error) {
    toast.error('Could not update the user', extractApiError(error).message)
  } finally {
    applying.value = false
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
      <FormField v-slot="field" label="Search" class="search-field">
        <input
          :id="field.id"
          v-model.lazy="search"
          class="input search"
          type="search"
          placeholder="Name or email"
        >
      </FormField>
    </div>

    <section class="card">
      <SkeletonBlock v-if="pending" :rows="6" height="34px" />

      <template v-else-if="users.length">
        <div class="table-wrap" tabindex="0" role="region" aria-label="Users table">
          <table class="table">
            <caption class="visually-hidden">Registered customers</caption>
            <thead>
              <tr>
                <th scope="col">Customer</th>
                <th scope="col">Role</th>
                <th scope="col">Status</th>
                <th scope="col">Accounts</th>
                <th scope="col">Balances</th>
                <th scope="col">Joined</th>
                <th scope="col" class="align-right">Actions</th>
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
                  <span v-if="row.id === currentUser?.id" class="tiny muted">You</span>
                  <div v-else class="row actions">
                    <button
                      class="btn btn-secondary btn-sm"
                      type="button"
                      :aria-label="`${row.status === 'ACTIVE' ? 'Suspend' : 'Reactivate'} ${row.firstName} ${row.lastName}`"
                      @click="askStatusChange(row)"
                    >
                      {{ row.status === 'ACTIVE' ? 'Suspend' : 'Reactivate' }}
                    </button>
                    <button
                      class="btn btn-ghost btn-sm"
                      type="button"
                      :aria-label="`${row.role === 'ADMIN' ? 'Revoke admin from' : 'Make admin'} ${row.firstName} ${row.lastName}`"
                      @click="askRoleChange(row)"
                    >
                      {{ row.role === 'ADMIN' ? 'Revoke admin' : 'Make admin' }}
                    </button>
                  </div>
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
          label="users"
          @update:page="page = $event"
        />
      </template>

      <EmptyState v-else icon="search" title="No users found" description="Try a different search." />
    </section>

    <ConfirmDialog
      :open="pendingAction !== null"
      :title="pendingAction?.title ?? ''"
      :description="pendingAction?.description"
      :confirm-label="pendingAction?.confirmLabel"
      :tone="pendingAction?.tone"
      :pending="applying"
      @confirm="applyAction"
      @cancel="pendingAction = null"
    />
  </div>
</template>

<style scoped>
.search-field { max-width: 260px; }
.cell-name { font-weight: 600; }
.actions { justify-content: flex-end; flex-wrap: wrap; gap: 6px; }
</style>
