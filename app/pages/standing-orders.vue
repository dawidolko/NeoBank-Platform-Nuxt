<script setup lang="ts">
useSeoMeta({ title: 'Standing orders — NeoBank', robots: 'noindex' })

const { money, date, iban: formatIban } = useFormat()
const toast = useToast()
const { errors, submitting, submit } = useFormErrors()

const { data, pending, refresh } = await useFetch('/api/standing-orders', {
  headers: useApiHeaders(),
})
const { data: accountData } = await useFetch('/api/accounts', { headers: useApiHeaders() })

const orders = computed(() => data.value?.orders ?? [])
const accounts = computed(() =>
  (accountData.value?.accounts ?? []).filter((account) => account.status === 'ACTIVE'),
)

const active = computed(() => orders.value.filter((order) => order.status === 'ACTIVE'))
const paused = computed(() => orders.value.filter((order) => order.status === 'PAUSED'))

/** Total committed per month, per currency — weekly orders count 4x. */
const monthlyCommitment = computed(() => {
  const totals = new Map<string, bigint>()

  for (const order of active.value) {
    const multiplier = order.interval === 'WEEKLY' ? 4n : 1n
    const currency = order.sourceAccount.currency

    totals.set(currency, (totals.get(currency) ?? 0n) + BigInt(order.amountCents) * multiplier)
  }

  return [...totals.entries()]
})

const showForm = ref(false)
const today = new Date().toISOString().slice(0, 10)

const form = reactive({
  sourceAccountId: '',
  destinationIban: '',
  recipientName: '',
  title: '',
  amount: '',
  interval: 'MONTHLY',
  startsOn: today,
})

watchEffect(() => {
  if (!form.sourceAccountId && accounts.value.length) {
    form.sourceAccountId = accounts.value[0]!.id
  }
})

const canSubmit = computed(
  () =>
    Boolean(form.sourceAccountId) &&
    form.destinationIban.replace(/\s/g, '').length > 8 &&
    form.recipientName.trim().length >= 2 &&
    form.title.trim().length >= 3 &&
    /^\d+([.,]\d{1,2})?$/.test(form.amount.trim()),
)

const updating = ref<string | null>(null)
const pendingCancel = ref<{ id: string; title: string } | null>(null)

async function createOrder() {
  const created = await submit(
    () => $fetch<{ order: { id: string } }>('/api/standing-orders', { method: 'POST', body: { ...form } }),
    'Could not create the standing order.',
  )

  if (!created) return

  toast.success('Standing order created', `${form.title} — ${form.recipientName}`)
  showForm.value = false
  form.destinationIban = ''
  form.recipientName = ''
  form.title = ''
  form.amount = ''
  await refresh()
}

async function setStatus(id: string, status: 'ACTIVE' | 'PAUSED' | 'CANCELLED', label: string) {
  updating.value = id

  try {
    await $fetch(`/api/standing-orders/${id}`, { method: 'PATCH', body: { status } })
    toast.success(label)
    pendingCancel.value = null
    await refresh()
  } catch (error) {
    toast.error('Could not update the standing order', extractApiError(error).message)
  } finally {
    updating.value = null
  }
}
</script>

<template>
  <div class="stack">
    <div class="row-between">
      <div>
        <h1>Standing orders</h1>
        <p class="muted small">Payments that repeat on their own.</p>
      </div>
      <button
        class="btn"
        type="button"
        :aria-expanded="showForm"
        :disabled="accounts.length === 0"
        @click="showForm = !showForm"
      >
        <AppIcon :name="showForm ? 'x' : 'plus'" :size="15" />
        {{ showForm ? 'Cancel' : 'New standing order' }}
      </button>
    </div>

    <div v-if="monthlyCommitment.length" class="grid grid-4">
      <StatCard
        v-for="[currency, total] in monthlyCommitment"
        :key="currency"
        :label="`Committed monthly · ${currency}`"
        :value="money(total, currency)"
        :hint="`${active.length} active order${active.length === 1 ? '' : 's'}`"
        icon="calendar-clock"
      />
    </div>

    <form v-if="showForm" class="card stack" novalidate @submit.prevent="createOrder">
      <h2 class="card-title">New standing order</h2>

      <div v-if="errors.form" class="alert alert-error" role="alert">{{ errors.form }}</div>

      <div class="grid form-grid">
        <FormField v-slot="field" label="From account" :error="errors.sourceAccountId">
          <select :id="field.id" v-model="form.sourceAccountId" class="select">
            <option v-for="account in accounts" :key="account.id" :value="account.id">
              {{ account.name }} — {{ money(account.balanceCents, account.currency) }}
            </option>
          </select>
        </FormField>

        <FormField v-slot="field" label="Amount" :error="errors.amount">
          <input
            :id="field.id"
            v-model="form.amount"
            class="input numeric"
            :class="{ 'has-error': field.invalid }"
            :aria-invalid="field.invalid"
            :aria-describedby="field.describedBy"
            inputmode="decimal"
            placeholder="280.00"
          >
        </FormField>

        <FormField v-slot="field" label="Recipient IBAN" :error="errors.destinationIban">
          <input
            :id="field.id"
            v-model="form.destinationIban"
            class="input mono"
            :class="{ 'has-error': field.invalid }"
            :aria-invalid="field.invalid"
            :aria-describedby="field.describedBy"
            autocomplete="off"
            placeholder="PL00 0000 0000 0000 0000 0000 0000"
          >
        </FormField>

        <FormField v-slot="field" label="Recipient name" :error="errors.recipientName">
          <input
            :id="field.id"
            v-model="form.recipientName"
            class="input"
            :class="{ 'has-error': field.invalid }"
            :aria-invalid="field.invalid"
            :aria-describedby="field.describedBy"
            maxlength="120"
            placeholder="Property Management Ltd"
          >
        </FormField>

        <FormField v-slot="field" label="Reference" :error="errors.title">
          <input
            :id="field.id"
            v-model="form.title"
            class="input"
            :class="{ 'has-error': field.invalid }"
            :aria-invalid="field.invalid"
            :aria-describedby="field.describedBy"
            maxlength="140"
            placeholder="Monthly rent"
          >
        </FormField>

        <FormField v-slot="field" label="Repeats" :error="errors.interval">
          <select :id="field.id" v-model="form.interval" class="select">
            <option value="MONTHLY">Every month</option>
            <option value="WEEKLY">Every week</option>
          </select>
        </FormField>

        <FormField v-slot="field" label="First payment" :error="errors.startsOn">
          <input :id="field.id" v-model="form.startsOn" class="input" type="date" :min="today">
        </FormField>
      </div>

      <div>
        <button class="btn" type="submit" :disabled="submitting || !canSubmit">
          <span v-if="submitting" class="spinner" aria-hidden="true" />
          {{ submitting ? 'Creating…' : 'Create standing order' }}
        </button>
      </div>
    </form>

    <SkeletonBlock v-if="pending" :rows="4" height="60px" />

    <template v-else-if="orders.length">
      <section
v-for="group in [
        { title: 'Active', items: active },
        { title: 'Paused', items: paused },
      ].filter((g) => g.items.length)" :key="group.title" class="stack">
        <h2>{{ group.title }}</h2>

        <ul class="order-list">
          <li v-for="order in group.items" :key="order.id" class="card order">
            <div class="order-main">
              <span class="order-icon" :class="order.status === 'PAUSED' ? 'is-paused' : ''">
                <AppIcon :name="order.status === 'PAUSED' ? 'pause' : 'calendar-clock'" :size="17" />
              </span>

              <div class="order-info">
                <p class="order-title">{{ order.title }}</p>
                <p class="tiny muted">
                  {{ order.recipientName }} ·
                  <span class="mono">{{ formatIban(order.destinationIban) }}</span>
                </p>
                <p class="tiny subtle">
                  From {{ order.sourceAccount.name }} ·
                  {{ order.interval === 'WEEKLY' ? 'Weekly' : 'Monthly' }} ·
                  Next {{ date(order.nextRunAt) }}
                </p>
                <p v-if="order.lastError" class="tiny error-note">
                  <AppIcon name="alert-circle" :size="12" /> {{ order.lastError }}
                </p>
              </div>
            </div>

            <div class="order-side">
              <p class="order-amount numeric">
                {{ money(order.amountCents, order.sourceAccount.currency) }}
              </p>

              <div class="row order-actions">
                <button
                  class="btn btn-secondary btn-sm"
                  type="button"
                  :disabled="updating === order.id"
                  @click="
                    order.status === 'ACTIVE'
                      ? setStatus(order.id, 'PAUSED', 'Standing order paused')
                      : setStatus(order.id, 'ACTIVE', 'Standing order resumed')
                  "
                >
                  <AppIcon :name="order.status === 'ACTIVE' ? 'pause' : 'refresh-cw'" :size="13" />
                  {{ order.status === 'ACTIVE' ? 'Pause' : 'Resume' }}
                </button>
                <button
                  class="btn btn-ghost btn-sm"
                  type="button"
                  :disabled="updating === order.id"
                  @click="pendingCancel = { id: order.id, title: order.title }"
                >
                  Cancel
                </button>
              </div>
            </div>
          </li>
        </ul>
      </section>
    </template>

    <div v-else class="card">
      <EmptyState
        icon="calendar-clock"
        title="No standing orders"
        description="Schedule a payment once and NeoBank repeats it for you."
      >
        <template #action>
          <button class="btn btn-sm" type="button" @click="showForm = true">
            Create your first one
          </button>
        </template>
      </EmptyState>
    </div>

    <ConfirmDialog
      :open="pendingCancel !== null"
      title="Cancel this standing order?"
      :description="`${pendingCancel?.title} will stop permanently. Payments already made are not affected.`"
      confirm-label="Cancel order"
      cancel-label="Keep it"
      tone="danger"
      :pending="updating !== null"
      @confirm="pendingCancel && setStatus(pendingCancel.id, 'CANCELLED', 'Standing order cancelled')"
      @cancel="pendingCancel = null"
    />
  </div>
</template>

<style scoped>
.form-grid { grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: var(--space-4); }

.order-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: var(--space-3); }

.order {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  flex-wrap: wrap;
}

.order-main { display: flex; align-items: flex-start; gap: var(--space-3); min-width: 0; flex: 1; }

.order-icon {
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  flex-shrink: 0;
  border-radius: var(--radius-sm);
  background: var(--primary-soft);
  color: var(--primary);
}

.order-icon.is-paused { background: var(--warning-soft); color: var(--warning); }

.order-info { min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.order-title { font-weight: var(--weight-semibold); font-size: var(--text-base); }
.error-note { color: var(--danger); display: inline-flex; align-items: center; gap: var(--space-1); }

.order-side { display: flex; flex-direction: column; align-items: flex-end; gap: var(--space-2); }
.order-amount { font-size: var(--text-lg); font-weight: var(--weight-bold); }
.order-actions { flex-wrap: wrap; justify-content: flex-end; }

@media (max-width: 560px) {
  .order-side { align-items: stretch; width: 100%; }
  .order-actions { justify-content: flex-start; }
}
</style>
