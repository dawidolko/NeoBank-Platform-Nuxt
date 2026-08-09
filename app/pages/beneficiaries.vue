<script setup lang="ts">
useHead({ title: 'Recipients — NeoBank' })

const { iban: formatIban } = useFormat()

const { data, pending, refresh } = await useFetch('/api/beneficiaries', { headers: useApiHeaders() })

const beneficiaries = computed(() => data.value?.beneficiaries ?? [])

const form = reactive({ name: '', iban: '', bankName: '' })
const errors = ref<Record<string, string>>({})
const submitting = ref(false)
const removingId = ref<string | null>(null)

async function addBeneficiary() {
  submitting.value = true
  errors.value = {}

  try {
    await $fetch('/api/beneficiaries', {
      method: 'POST',
      body: { ...form, bankName: form.bankName || undefined },
    })
    form.name = ''
    form.iban = ''
    form.bankName = ''
    await refresh()
  } catch (error) {
    const payload = (error as { data?: { data?: { errors?: Record<string, string> } } }).data?.data
    errors.value = payload?.errors ?? { form: 'Could not save the recipient.' }
  } finally {
    submitting.value = false
  }
}

async function removeBeneficiary(id: string) {
  removingId.value = id

  try {
    await $fetch(`/api/beneficiaries/${id}`, { method: 'DELETE' })
    await refresh()
  } catch {
    errors.value = { form: 'Could not remove the recipient.' }
  } finally {
    removingId.value = null
  }
}
</script>

<template>
  <div class="stack recipients-page">
    <div>
      <h1>Recipients</h1>
      <p class="muted small">Save the people and businesses you pay regularly.</p>
    </div>

    <div v-if="errors.form" class="alert alert-error">{{ errors.form }}</div>

    <div class="recipients-grid">
      <form class="card stack" novalidate @submit.prevent="addBeneficiary">
        <h2 class="card-title">Add a recipient</h2>

        <div class="field">
          <label class="field-label" for="name">Name</label>
          <input
            id="name"
            v-model="form.name"
            class="input"
            :class="{ 'has-error': errors.name }"
            placeholder="Jan Nowak"
            required
          >
          <span v-if="errors.name" class="field-error">{{ errors.name }}</span>
        </div>

        <div class="field">
          <label class="field-label" for="iban">IBAN</label>
          <input
            id="iban"
            v-model="form.iban"
            class="input mono"
            :class="{ 'has-error': errors.iban }"
            placeholder="PL00 0000 0000 0000 0000 0000 0000"
            required
          >
          <span v-if="errors.iban" class="field-error">{{ errors.iban }}</span>
        </div>

        <div class="field">
          <label class="field-label" for="bankName">Bank <span class="muted">(optional)</span></label>
          <input id="bankName" v-model="form.bankName" class="input" placeholder="Santander">
        </div>

        <button class="btn" type="submit" :disabled="submitting">
          {{ submitting ? 'Saving…' : 'Save recipient' }}
        </button>
      </form>

      <section class="card">
        <div class="card-header">
          <h2 class="card-title">Saved recipients</h2>
          <span class="tiny muted">{{ beneficiaries.length }} total</span>
        </div>

        <div v-if="pending" class="empty">Loading…</div>

        <div v-else-if="beneficiaries.length" class="stack list">
          <div v-for="beneficiary in beneficiaries" :key="beneficiary.id" class="recipient-row">
            <div class="recipient-info">
              <p class="recipient-name truncate">{{ beneficiary.name }}</p>
              <p class="tiny muted mono truncate">{{ formatIban(beneficiary.iban) }}</p>
              <p v-if="beneficiary.bankName" class="tiny muted">{{ beneficiary.bankName }}</p>
            </div>
            <div class="row recipient-actions">
              <NuxtLink :to="`/transfer?to=${beneficiary.iban}`" class="btn btn-secondary btn-sm">
                Send
              </NuxtLink>
              <button
                class="btn btn-ghost btn-sm"
                type="button"
                :disabled="removingId === beneficiary.id"
                @click="removeBeneficiary(beneficiary.id)"
              >
                {{ removingId === beneficiary.id ? '…' : 'Remove' }}
              </button>
            </div>
          </div>
        </div>

        <EmptyState
          v-else
          icon="👤"
          title="No recipients saved"
          description="Add one using the form to speed up future transfers."
        />
      </section>
    </div>
  </div>
</template>

<style scoped>
.recipients-page { max-width: 940px; }

.recipients-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.3fr);
  gap: 18px;
  align-items: start;
}

.list { gap: 0; }

.recipient-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 0;
  border-bottom: 1px solid var(--border);
}

.recipient-row:last-child { border-bottom: none; }
.recipient-info { min-width: 0; }
.recipient-name { font-weight: 600; font-size: 0.9rem; }
.recipient-actions { flex-shrink: 0; }

@media (max-width: 820px) {
  .recipients-grid { grid-template-columns: 1fr; }
}
</style>
