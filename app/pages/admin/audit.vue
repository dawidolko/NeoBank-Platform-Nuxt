<script setup lang="ts">
useHead({ title: 'Audit log — Admin — NeoBank' })

const { dateTime } = useFormat()

const page = ref(1)
const query = computed(() => ({ page: page.value, perPage: 30 }))

const { data, pending } = await useFetch('/api/admin/audit', { query, headers: useApiHeaders() })

const logs = computed(() => data.value?.logs ?? [])
const pagination = computed(() => data.value?.pagination)

/** Colour-code the action families so scanning the log is quick. */
function toneFor(action: string): string {
  if (action.includes('failed')) return 'badge-danger'
  if (action.startsWith('admin.')) return 'badge-warning'
  if (action.includes('transfer') || action.includes('deposit')) return 'badge-primary'

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
    <div>
      <NuxtLink to="/admin" class="small">← Admin</NuxtLink>
      <h1>Audit log</h1>
      <p class="muted small">Append-only record of every security-relevant action.</p>
    </div>

    <section class="card">
      <div v-if="pending" class="empty">Loading audit trail…</div>

      <template v-else-if="logs.length">
        <div class="table-wrap">
          <table class="table">
            <thead>
              <tr>
                <th>When</th>
                <th>Action</th>
                <th>Actor</th>
                <th>Entity</th>
                <th>Details</th>
                <th>IP</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="log in logs" :key="log.id">
                <td class="tiny muted">{{ dateTime(log.createdAt) }}</td>
                <td><span class="badge" :class="toneFor(log.action)">{{ log.action }}</span></td>
                <td class="tiny">
                  <template v-if="log.user">
                    {{ log.user.firstName }} {{ log.user.lastName }}
                  </template>
                  <span v-else class="muted">System</span>
                </td>
                <td class="tiny">{{ log.entityType }}</td>
                <td class="tiny muted details truncate">{{ summarize(log.metadata) }}</td>
                <td class="tiny muted mono">{{ log.ipAddress ?? '—' }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div v-if="pagination && pagination.pages > 1" class="pagination">
          <button class="btn btn-secondary btn-sm" type="button" :disabled="page <= 1" @click="page -= 1">
            Previous
          </button>
          <span class="small muted">
            Page {{ pagination.page }} of {{ pagination.pages }} · {{ pagination.total }} events
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

      <EmptyState v-else icon="📋" title="Audit log is empty" />
    </section>
  </div>
</template>

<style scoped>
.details { max-width: 320px; }

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
