<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    open: boolean
    title: string
    description?: string
    size?: 'sm' | 'md'
  }>(),
  { size: 'sm', description: undefined },
)

const emit = defineEmits<{ close: [] }>()

const dialog = ref<HTMLElement | null>(null)
const titleId = useId()

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    emit('close')
    return
  }

  if (event.key !== 'Tab' || !dialog.value) return

  const focusable = dialog.value.querySelectorAll<HTMLElement>(
    'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])',
  )
  const first = focusable[0]
  const last = focusable[focusable.length - 1]

  if (!first || !last) return

  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first.focus()
  }
}

watch(
  () => props.open,
  async (open) => {
    if (!import.meta.client) return

    document.body.style.overflow = open ? 'hidden' : ''

    if (open) {
      await nextTick()
      dialog.value?.querySelector<HTMLElement>('button, input, select')?.focus()
    }
  },
)

onUnmounted(() => {
  if (import.meta.client) document.body.style.overflow = ''
})
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="open" class="modal-backdrop" @click.self="emit('close')">
        <div
          ref="dialog"
          class="modal"
          :class="`modal-${size}`"
          role="dialog"
          aria-modal="true"
          :aria-labelledby="titleId"
          @keydown="onKeydown"
        >
          <div class="modal-header">
            <h2 :id="titleId" class="modal-title">{{ title }}</h2>
            <button class="modal-close" type="button" aria-label="Close dialog" @click="emit('close')">
              <AppIcon name="x" :size="18" />
            </button>
          </div>

          <p v-if="description" class="modal-description">{{ description }}</p>

          <div class="modal-body">
            <slot />
          </div>

          <div v-if="$slots.footer" class="modal-footer">
            <slot name="footer" />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: var(--z-modal);
  display: grid;
  place-items: center;
  padding: 20px;
  background: rgb(6 9 16 / 62%);
  backdrop-filter: blur(2px);
}

.modal {
  width: 100%;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow-xl);
  padding: var(--space-6);
  max-height: calc(100vh - 40px);
  overflow-y: auto;
}

.modal-sm { max-width: 420px; }
.modal-md { max-width: 620px; }

.modal-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.modal-title { font-size: 1.05rem; }

.modal-close {
  border: 0;
  background: transparent;
  color: var(--text-muted);
  line-height: 1;
  cursor: pointer;
  display: grid;
  place-items: center;
  padding: var(--space-1);
  border-radius: var(--radius-xs);
}

.modal-close:hover { color: var(--text); }
.modal-close:focus-visible { outline: 2px solid var(--primary); outline-offset: 2px; }

.modal-description { margin-top: 7px; font-size: 0.88rem; color: var(--text-muted); }
.modal-body:not(:empty) { margin-top: 16px; }

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 9px;
  margin-top: 20px;
  flex-wrap: wrap;
}

.modal-enter-active,
.modal-leave-active { transition: opacity 0.18s ease; }

.modal-enter-active .modal,
.modal-leave-active .modal { transition: transform 0.18s ease; }

.modal-enter-from,
.modal-leave-to { opacity: 0; }

.modal-enter-from .modal,
.modal-leave-to .modal { transform: scale(0.97); }

@media (prefers-reduced-motion: reduce) {
  .modal-enter-active,
  .modal-leave-active,
  .modal-enter-active .modal,
  .modal-leave-active .modal { transition: none; }
}
</style>
