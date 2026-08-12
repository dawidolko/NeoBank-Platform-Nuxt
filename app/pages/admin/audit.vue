<script setup lang="ts">
useHead({ title: 'Audit log — Admin — NeoBank' })

const { dateTime } = useFormat()

const page = ref(1)
const action = ref('')
const entityType = ref('')

const query = computed(() => ({
  page: page.value,
  perPage: 30,
  ...(action.value ? { action: action.value } : {}),
  ...(entityType.value ? { entityType: entityType.value } : {}),
}))

const { data, pending } = await useFetch('/api/admin/audit', {
  query,
  headers: useApiHeaders(),
})

const logs = computed(() => data.value?.logs ?? [])
const pagination = computed(() => data.value?.pagination)

watch([action, entityType], () => { page.value = 1 })

const hasFilters = computed(() => Boolean(action.value || entityType.value))

/** Colour-code the action families so scanning the log is quick. */
function toneFor(value: string): string {
  if (value.includes('failed')) return 'badge-danger'
  if (value.startsWith('admin.')) return 'badge-warning'
  if (value.includes('transfer') || value.includes('deposit')) return 'badge-primary'

  return ''
}

function summarize(metadata: unknown): string {
  if (!metadata || typeof metadata !== 'object') return '—'

  return Object.entries(metadata as Record<string, unknown>)
    .map(([key, value]) => `${key}: ${typeof value === 'object' ? JSON.stringify(value) : String(value)}`)
    .join(' · ')
}
</script>

<template>
  <div class="stack">
    <div class="row-between">
      <div>
        <NuxtLink to="/admin" class="small">← Admin</NuxtLink>
        <h1>Audit log</h1>
        <p class="muted small">Append-only record of every security-relevant action.</p>
      </div>
    </div>

    <section class="card">
      <h2 class="visually-hidden">Filters</h2>
      <div class="filters">
        <FormField v-slot="field" label="Action" hint="Partial match, e.g. “login”">
          <input
            :id="field.id"
            v-model.lazy="action"
            class="input"
            type="search"
            :aria-describedby="field.describedBy"
            placeholder="transfer.executed"
          >
        </FormField>

        <FormField v-slot="field" label="Entity">
          <select :id="field.id" v-model="entityType" class="select">
            <option value="">All entities</option>
            <option value="User">User</option>
            <option value="Account">Account</option>
            <option value="Transfer">Transfer</option>
          </select>
        </FormField>

        <div class="field filter-reset">
          <button
            class="btn btn-secondary"
            type="button"
            :disabled="!hasFilters"
            @click="action = ''; entityType = ''"
          >
            Clear
          </button>
        </div>
      </div>
    </section>

    <section class="card">
      <SkeletonBlock v-if="pending" :rows="10" height="30px" />

      <template v-else-if="logs.length">
        <div class="table-wrap" tabindex="0" role="region" aria-label="Audit log table">
          <table class="table">
            <caption class="visually-hidden">Security-relevant events, newest first</caption>
            <thead>
              <tr>
                <th scope="col">When</th>
                <th scope="col">Action</th>
                <th scope="col">Actor</th>
                <th scope="col">Entity</th>
                <th scope="col">Details</th>
                <th scope="col">IP</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="log in logs" :key="log.id">
                <td class="tiny muted">{{ dateTime(log.createdAt) }}</td>
                <td><span class="badge" :class="toneFor(log.action)">{{ log.action }}</span></td>
                <td class="tiny">
                  <template v-if="log.user">{{ log.user.firstName }} {{ log.user.lastName }}</template>
                  <span v-else class="muted">System</span>
                </td>
                <td class="tiny">{{ log.entityType }}</td>
                <td class="tiny muted details truncate">{{ summarize(log.metadata) }}</td>
                <td class="tiny muted mono">{{ log.ipAddress ?? '—' }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <AppPagination
          v-if="pagination"
          :page="pagination.page"
          :pages="pagination.pages"
          :total="pagination.total"
          label="events"
          @update:page="page = $event"
        />
      </template>

      <EmptyState
        v-else
        icon="receipt"
        :title="hasFilters ? 'No matching events' : 'Audit log is empty'"
        :description="hasFilters ? 'Try clearing the filters.' : undefined"
      />
    </section>
  </div>
</template>

<style scoped>
.filters {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 12px;
  align-items: end;
}

.filter-reset { justify-content: flex-end; }
.details { max-width: 320px; }
</style>
