<script setup lang="ts">
const { toasts, dismiss } = useToast()

const ICONS = {
  success: '✓',
  error: '!',
  info: 'i',
} as const
</script>

<template>
  <Teleport to="body">
    <div class="toast-host" role="status" aria-live="polite">
      <TransitionGroup name="toast">
        <div v-for="toast in toasts" :key="toast.id" class="toast" :class="`toast-${toast.tone}`">
          <span class="toast-icon" aria-hidden="true">{{ ICONS[toast.tone] }}</span>
          <div class="toast-body">
            <p class="toast-title">{{ toast.title }}</p>
            <p v-if="toast.description" class="toast-description">{{ toast.description }}</p>
          </div>
          <button
            class="toast-close"
            type="button"
            aria-label="Dismiss notification"
            @click="dismiss(toast.id)"
          >
            ×
          </button>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<style scoped>
.toast-host {
  position: fixed;
  top: 16px;
  right: 16px;
  z-index: 100;
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: min(360px, calc(100vw - 32px));
  pointer-events: none;
}

.toast {
  display: flex;
  align-items: flex-start;
  gap: 11px;
  padding: 13px 14px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--surface);
  box-shadow: var(--shadow);
  pointer-events: auto;
}

.toast-icon {
  width: 21px;
  height: 21px;
  flex-shrink: 0;
  display: grid;
  place-items: center;
  border-radius: 50%;
  font-size: 0.74rem;
  font-weight: 700;
}

.toast-success { border-left: 3px solid var(--success); }
.toast-success .toast-icon { background: var(--success-soft); color: var(--success); }

.toast-error { border-left: 3px solid var(--danger); }
.toast-error .toast-icon { background: var(--danger-soft); color: var(--danger); }

.toast-info { border-left: 3px solid var(--primary); }
.toast-info .toast-icon { background: var(--primary-soft); color: var(--primary); }

.toast-body { flex: 1; min-width: 0; }
.toast-title { font-size: 0.87rem; font-weight: 600; }
.toast-description { font-size: 0.8rem; color: var(--text-muted); margin-top: 2px; }

.toast-close {
  flex-shrink: 0;
  border: 0;
  background: transparent;
  color: var(--text-muted);
  font-size: 1.2rem;
  line-height: 1;
  cursor: pointer;
  padding: 0 2px;
  border-radius: 4px;
}

.toast-close:hover { color: var(--text); }
.toast-close:focus-visible { outline: 2px solid var(--primary); outline-offset: 2px; }

.toast-enter-active,
.toast-leave-active { transition: opacity 0.2s ease, transform 0.2s ease; }

.toast-enter-from { opacity: 0; transform: translateX(16px); }
.toast-leave-to { opacity: 0; transform: translateX(16px); }

@media (prefers-reduced-motion: reduce) {
  .toast-enter-active,
  .toast-leave-active { transition: none; }
}
</style>
