<script setup lang="ts">
useHead({ title: 'Recipients — NeoBank' })

const { iban: formatIban } = useFormat()
const toast = useToast()
const { errors, submitting, submit } = useFormErrors()

const { data, pending, refresh } = await useFetch('/api/beneficiaries', {
  headers: useApiHeaders(),
})

const beneficiaries = computed(() => data.value?.beneficiaries ?? [])

const form = reactive({ name: '', iban: '', bankName: '' })

const pendingRemoval = ref<{ id: string; name: string } | null>(null)
const removing = ref(false)

const canSubmit = computed(
  () => form.name.trim().length >= 2 && form.iban.replace(/\s/g, '').length > 8,
)

async function addBeneficiary() {
  const created = await submit(
    () =>
      $fetch<{ beneficiary: { id: string } }>('/api/beneficiaries', {
        method: 'POST',
        body: { ...form, bankName: form.bankName || undefined },
      }),
    'Could not save the recipient.',
  )

  if (!created) return

  toast.success('Recipient saved', form.name.trim())
  form.name = ''
  form.iban = ''
  form.bankName = ''
  await refresh()
}

async function confirmRemoval() {
  if (!pendingRemoval.value) return

  removing.value = true

  try {
    await $fetch(`/api/beneficiaries/${pendingRemoval.value.id}`, { method: 'DELETE' })
    toast.success('Recipient removed', pendingRemoval.value.name)
    pendingRemoval.value = null
    await refresh()
  } catch (error) {
    toast.error('Could not remove recipient', extractApiError(error).message)
  } finally {
    removing.value = false
  }
}
</script>

<template>
  <div class="stack recipients-page">
    <header>
      <h1>Recipients</h1>
      <p class="muted small">Save the people and businesses you pay regularly.</p>
    </header>

    <div v-if="errors.form" class="alert alert-error" role="alert">{{ errors.form }}</div>

    <div class="recipients-grid">
      <form class="card stack" novalidate @submit.prevent="addBeneficiary">
        <h2 class="card-title">Add a recipient</h2>

        <FormField v-slot="field" label="Name" :error="errors.name">
          <input
            :id="field.id"
            v-model="form.name"
            class="input"
            :class="{ 'has-error': field.invalid }"
            :aria-invalid="field.invalid"
            :aria-describedby="field.describedBy"
            maxlength="120"
            placeholder="Jan Nowak"
          >
        </FormField>

        <FormField v-slot="field" label="IBAN" :error="errors.iban">
          <input
            :id="field.id"
            v-model="form.iban"
            class="input mono"
            :class="{ 'has-error': field.invalid }"
            :aria-invalid="field.invalid"
            :aria-describedby="field.describedBy"
            autocomplete="off"
            placeholder="PL00 0000 0000 0000 0000 0000 0000"
          >
        </FormField>

        <FormField v-slot="field" label="Bank" :error="errors.bankName" optional>
          <input
            :id="field.id"
            v-model="form.bankName"
            class="input"
            :aria-describedby="field.describedBy"
            maxlength="120"
            placeholder="Santander"
          >
        </FormField>

        <button class="btn" type="submit" :disabled="submitting || !canSubmit">
          <span v-if="submitting" class="spinner" aria-hidden="true" />
          {{ submitting ? 'Saving…' : 'Save recipient' }}
        </button>
      </form>

      <section class="card">
        <div class="card-header">
          <h2 class="card-title">Saved recipients</h2>
          <span class="tiny muted">{{ beneficiaries.length }} total</span>
        </div>

        <SkeletonBlock v-if="pending" :rows="4" height="40px" />

        <ul v-else-if="beneficiaries.length" class="list">
          <li v-for="beneficiary in beneficiaries" :key="beneficiary.id" class="recipient-row">
            <div class="recipient-info">
              <p class="recipient-name truncate">{{ beneficiary.name }}</p>
              <p class="tiny muted mono truncate">{{ formatIban(beneficiary.iban) }}</p>
              <p v-if="beneficiary.bankName" class="tiny muted">{{ beneficiary.bankName }}</p>
            </div>

            <div class="row recipient-actions">
              <NuxtLink
                :to="`/transfer?to=${beneficiary.iban}`"
                class="btn btn-secondary btn-sm"
                :aria-label="`Send money to ${beneficiary.name}`"
              >
                Send
              </NuxtLink>
              <button
                class="btn btn-ghost btn-sm"
                type="button"
                :aria-label="`Remove ${beneficiary.name}`"
                @click="pendingRemoval = { id: beneficiary.id, name: beneficiary.name }"
              >
                Remove
              </button>
            </div>
          </li>
        </ul>

        <EmptyState
          v-else
          icon="👤"
          title="No recipients saved"
          description="Add one using the form to speed up future transfers."
        />
      </section>
    </div>

    <ConfirmDialog
      :open="pendingRemoval !== null"
      title="Remove recipient?"
      :description="`${pendingRemoval?.name} will be deleted from your saved recipients. Past transfers are not affected.`"
      confirm-label="Remove"
      tone="danger"
      :pending="removing"
      @confirm="confirmRemoval"
      @cancel="pendingRemoval = null"
    />
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

.list { list-style: none; margin: 0; padding: 0; }

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
