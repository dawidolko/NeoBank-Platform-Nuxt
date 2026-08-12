<script setup lang="ts">
interface NotificationItem {
  id: string
  kind: string
  title: string
  body: string
  link: string | null
  readAt: string | null
  createdAt: string
}

const { relative } = useFormat()

const open = ref(false)
const panel = ref<HTMLElement | null>(null)

const { data, refresh } = await useFetch<{ notifications: NotificationItem[]; unread: number }>(
  '/api/notifications',
  { headers: useApiHeaders() },
)

const notifications = computed(() => data.value?.notifications ?? [])
const unread = computed(() => data.value?.unread ?? 0)

const KIND_ICONS: Record<string, string> = {
  TRANSFER_RECEIVED: 'arrow-down-left',
  TRANSFER_SENT: 'arrow-up-right',
  LOW_BALANCE: 'alert-circle',
  SECURITY: 'shield',
  STANDING_ORDER: 'calendar-clock',
}

async function toggle() {
  open.value = !open.value

  if (!open.value) return

  await refresh()

  // Opening the panel is the read receipt; mark after the list is rendered so
  // the unread highlight is visible for the frame the user actually sees it.
  if (unread.value > 0) {
    await $fetch('/api/notifications/read', { method: 'POST' })
    setTimeout(() => refresh(), 1200)
  }
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') open.value = false
}

function onClickOutside(event: MouseEvent) {
  if (!open.value || !panel.value) return
  if (!panel.value.contains(event.target as Node)) open.value = false
}

onMounted(() => {
  document.addEventListener('keydown', onKeydown)
  document.addEventListener('click', onClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('keydown', onKeydown)
  document.removeEventListener('click', onClickOutside)
})
</script>

<template>
  <div ref="panel" class="bell-wrap">
    <button
      class="btn btn-ghost btn-icon bell"
      type="button"
      :aria-expanded="open"
      :aria-label="unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'"
      @click.stop="toggle"
    >
      <AppIcon name="bell" :size="17" />
      <span v-if="unread > 0" class="badge-count">{{ unread > 9 ? '9+' : unread }}</span>
    </button>

    <Transition name="pop">
      <div v-if="open" class="panel" role="dialog" aria-label="Notifications">
        <div class="panel-head">
          <span class="card-title">Notifications</span>
          <span v-if="unread > 0" class="badge badge-primary">{{ unread }} new</span>
        </div>

        <ul v-if="notifications.length" class="panel-list">
          <li v-for="item in notifications" :key="item.id">
            <component
              :is="item.link ? 'NuxtLink' : 'div'"
              :to="item.link ?? undefined"
              class="item"
              :class="{ unread: !item.readAt }"
              @click="open = false"
            >
              <span class="item-icon">
                <AppIcon :name="(KIND_ICONS[item.kind] ?? 'info') as never" :size="15" />
              </span>
              <span class="item-body">
                <span class="item-title">{{ item.title }}</span>
                <span class="tiny muted">{{ item.body }}</span>
                <span class="tiny subtle">{{ relative(item.createdAt) }}</span>
              </span>
            </component>
          </li>
        </ul>

        <p v-else class="panel-empty small muted">Nothing yet. We will tell you when money moves.</p>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.bell-wrap { position: relative; }
.bell { position: relative; }

.badge-count {
  position: absolute;
  top: 1px;
  right: 1px;
  min-width: 15px;
  height: 15px;
  padding: 0 3px;
  display: grid;
  place-items: center;
  border-radius: var(--radius-full);
  background: var(--danger);
  color: #fff;
  font-size: 9px;
  font-weight: var(--weight-bold);
  line-height: 1;
}

.panel {
  position: absolute;
  top: calc(100% + var(--space-2));
  right: 0;
  z-index: var(--z-sticky);
  width: min(340px, calc(100vw - 32px));
  max-height: 420px;
  overflow-y: auto;
  padding: var(--space-3);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface);
  box-shadow: var(--shadow-lg);
}

.panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  padding-bottom: var(--space-2);
  margin-bottom: var(--space-1);
  border-bottom: 1px solid var(--border);
}

.panel-list { list-style: none; margin: 0; padding: 0; }

.item {
  display: flex;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-2);
  border-radius: var(--radius-sm);
  color: inherit;
  transition: background var(--duration-fast) var(--ease);
}

.item:hover { background: var(--surface-muted); }
.item.unread { background: color-mix(in srgb, var(--primary-soft) 55%, transparent); }

.item-icon {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  flex-shrink: 0;
  border-radius: var(--radius-full);
  background: var(--surface-muted);
  color: var(--text-muted);
}

.item-body { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
.item-title { font-size: var(--text-sm); font-weight: var(--weight-semibold); }
.panel-empty { padding: var(--space-6) var(--space-3); text-align: center; }

.pop-enter-active,
.pop-leave-active { transition: opacity var(--duration-fast) var(--ease), transform var(--duration-fast) var(--ease); }
.pop-enter-from,
.pop-leave-to { opacity: 0; transform: translateY(-6px); }
</style>
