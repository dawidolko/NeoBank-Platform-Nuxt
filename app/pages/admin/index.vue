<script setup lang="ts">
useHead({ title: 'Admin — NeoBank' })

const { money, dateTime } = useFormat()

const { data, pending } = await useFetch('/api/admin/stats', { headers: useApiHeaders() })

const totals = computed(() => data.value?.totals)
const byStatus = computed(() => data.value?.transfersByStatus ?? [])
const recent = computed(() => data.value?.recentTransfers ?? [])
</script>

<template>
  <div class="stack">
    <div class="row-between">
      <div>
        <h1>Administration</h1>
        <p class="muted small">Bank-wide overview and controls.</p>
      </div>
      <nav class="row">
        <NuxtLink to="/admin/users" class="btn btn-secondary btn-sm">Users</NuxtLink>
        <NuxtLink to="/admin/transactions" class="btn btn-secondary btn-sm">Transactions</NuxtLink>
        <NuxtLink to="/admin/audit" class="btn btn-secondary btn-sm">Audit log</NuxtLink>
      </nav>
    </div>

    <div v-if="pending" class="card empty">Loading statistics…</div>

    <template v-else>
      <div class="grid grid-4">
        <StatCard label="Customers" :value="String(totals?.users ?? 0)" hint="Registered users" />
        <StatCard label="Accounts" :value="String(totals?.accounts ?? 0)" hint="Open accounts" />
        <StatCard label="Transfers" :value="String(totals?.transfers ?? 0)" hint="All time" />
        <StatCard
          label="Deposits held"
          :value="money(totals?.depositsCents ?? '0')"
          hint="Sum of balances"
        />
      </div>

      <div class="grid grid-2">
        <section class="card">
          <div class="card-header">
            <h2 class="card-title">Transfers by status</h2>
          </div>

          <div class="stack status-list">
            <div v-for="row in byStatus" :key="row.status" class="row-between status-row">
              <StatusBadge :status="row.status" />
              <span class="numeric">{{ row.count }}</span>
            </div>
          </div>

          <div class="volume">
            <span class="label">Total completed volume</span>
            <span class="volume-value numeric">
              {{ money(totals?.transferVolumeCents ?? '0') }}
            </span>
          </div>
        </section>

        <section class="card">
          <div class="card-header">
            <h2 class="card-title">Latest transfers</h2>
            <NuxtLink to="/admin/transactions" class="small">View all →</NuxtLink>
          </div>

          <div v-if="recent.length" class="stack recent">
            <div v-for="transfer in recent" :key="transfer.id" class="recent-row">
              <div class="recent-info">
                <p class="recent-title truncate">{{ transfer.title }}</p>
                <p class="tiny muted">
                  <span class="mono">{{ transfer.reference }}</span>
                  · {{ dateTime(transfer.createdAt) }}
                </p>
              </div>
              <div class="recent-amount">
                <p class="numeric">{{ money(transfer.amountCents, transfer.currency) }}</p>
                <StatusBadge :status="transfer.status" />
              </div>
            </div>
          </div>

          <EmptyState v-else icon="inbox" title="No transfers yet" />
        </section>
      </div>
    </template>
  </div>
</template>

<style scoped>
.status-list { gap: 0; }

.status-row {
  padding: 9px 0;
  border-bottom: 1px solid var(--border);
}

.status-row:last-child { border-bottom: none; }

.volume {
  margin-top: 15px;
  padding-top: 15px;
  border-top: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.volume-value { font-size: 1.2rem; font-weight: 680; }

.recent { gap: 0; }

.recent-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 0;
  border-bottom: 1px solid var(--border);
}

.recent-row:last-child { border-bottom: none; }
.recent-info { min-width: 0; }
.recent-title { font-size: 0.88rem; font-weight: 570; }
.recent-amount { text-align: right; flex-shrink: 0; display: flex; flex-direction: column; gap: 3px; align-items: flex-end; }
</style>
