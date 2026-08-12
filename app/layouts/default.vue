<script setup lang="ts">
const { user, isAdmin, fullName, initials, logout } = useAuth()
const route = useRoute()
const menuOpen = ref(false)

const navigation = computed(() => {
  const links = [
    { to: '/dashboard', label: 'Overview', icon: 'home' },
    { to: '/accounts', label: 'Accounts', icon: 'wallet' },
    { to: '/transfer', label: 'Send money', icon: 'send' },
    { to: '/transactions', label: 'Transactions', icon: 'receipt' },
    { to: '/insights', label: 'Insights', icon: 'chart-pie' },
    { to: '/standing-orders', label: 'Scheduled', icon: 'calendar-clock' },
    { to: '/beneficiaries', label: 'Recipients', icon: 'users' },
  ]

  if (isAdmin.value) links.push({ to: '/admin', label: 'Admin', icon: 'shield' })

  return links
})

function isActive(path: string) {
  return path === '/admin'
    ? route.path.startsWith('/admin')
    : route.path === path || route.path.startsWith(`${path}/`)
}

// Close the mobile menu whenever the route changes.
watch(() => route.fullPath, () => { menuOpen.value = false })
</script>

<template>
  <div class="shell">
    <a href="#main" class="skip-link">Skip to content</a>

    <header class="topbar">
      <div class="container topbar-inner">
        <NuxtLink to="/dashboard" class="brand">
          <span class="brand-mark">N</span>
          <span class="brand-name">NeoBank</span>
        </NuxtLink>

        <nav id="primary-nav" class="nav" :class="{ 'nav-open': menuOpen }" aria-label="Primary">
          <NuxtLink
            v-for="link in navigation"
            :key="link.to"
            :to="link.to"
            class="nav-link"
            :class="{ 'nav-link-active': isActive(link.to) }"
          >
            <AppIcon :name="link.icon as never" :size="16" />
            {{ link.label }}
          </NuxtLink>
        </nav>

        <div class="topbar-actions">
          <NuxtLink v-if="user" to="/profile" class="user-chip" :aria-label="`Profile and security for ${fullName}`">
            <span class="avatar" aria-hidden="true">{{ initials }}</span>
            <span class="user-meta">
              <span class="user-name truncate">{{ fullName }}</span>
              <span class="tiny muted">{{ isAdmin ? 'Administrator' : 'Customer' }}</span>
            </span>
          </NuxtLink>
          <NotificationBell />
          <ThemeToggle />
          <button
            class="btn btn-ghost btn-icon"
            type="button"
            aria-label="Sign out"
            title="Sign out"
            @click="logout()"
          >
            <AppIcon name="log-out" :size="17" />
          </button>
          <button
            class="menu-toggle btn btn-ghost btn-sm"
            type="button"
            :aria-expanded="menuOpen"
            aria-controls="primary-nav"
            aria-label="Toggle navigation"
            @click="menuOpen = !menuOpen"
          >
            <AppIcon name="menu" :size="18" />
          </button>
        </div>
      </div>
    </header>

    <main id="main" class="main" tabindex="-1">
      <div class="container">
        <slot />
      </div>
    </main>

    <footer class="footer">
      <div class="container row-between">
        <span class="tiny muted">NeoBank — demo banking platform. No real funds are involved.</span>
        <span class="tiny muted">Built with Nuxt 4 · Prisma · PostgreSQL</span>
      </div>
    </footer>
  </div>
</template>

<style scoped>
.shell {
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
}

.topbar {
  position: sticky;
  top: 0;
  z-index: var(--z-sticky);
  background: color-mix(in srgb, var(--surface) 84%, transparent);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--border);
}

.topbar-inner {
  display: flex;
  align-items: center;
  gap: 22px;
  height: 62px;
}

.brand {
  display: flex;
  align-items: center;
  gap: 9px;
  font-weight: 700;
  color: var(--text);
  text-decoration: none;
  flex-shrink: 0;
}

.brand:hover { text-decoration: none; }

.brand-mark {
  width: 30px;
  height: 30px;
  display: grid;
  place-items: center;
  border-radius: 9px;
  background: var(--primary);
  color: #fff;
  font-size: 0.95rem;
  font-weight: 700;
}

.brand-name { letter-spacing: -0.02em; }

.nav {
  display: flex;
  align-items: center;
  gap: 3px;
  flex: 1;
}

.nav-link {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: 7px var(--space-3);
  border-radius: var(--radius-sm);
  color: var(--text-muted);
  font-size: 0.87rem;
  font-weight: 550;
  text-decoration: none;
  white-space: nowrap;
}

.nav-link:hover {
  background: var(--surface-muted);
  color: var(--text);
  text-decoration: none;
}

.nav-link-active {
  background: var(--primary-soft);
  color: var(--primary);
}

.topbar-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-left: auto;
}

.user-chip {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 4px 7px;
  border-radius: var(--radius-sm);
  color: inherit;
  text-decoration: none;
}

.user-chip:hover { background: var(--surface-muted); text-decoration: none; }

.avatar {
  width: 32px;
  height: 32px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  background: var(--primary-soft);
  color: var(--primary);
  font-size: 0.76rem;
  font-weight: 700;
  flex-shrink: 0;
}

.user-meta { display: flex; flex-direction: column; line-height: 1.2; max-width: 150px; }
.user-name { font-size: 0.83rem; font-weight: 600; }

.menu-toggle { display: none; font-size: 1.05rem; }

.main { flex: 1; padding: 26px 0 44px; }

.footer {
  border-top: 1px solid var(--border);
  background: var(--surface);
  padding: 16px 0;
}

@media (max-width: 900px) {
  .user-meta { display: none; }
}

@media (max-width: 820px) {
  .menu-toggle { display: inline-flex; }

  .nav {
    display: none;
    position: absolute;
    top: 62px;
    left: 0;
    right: 0;
    flex-direction: column;
    align-items: stretch;
    gap: 2px;
    padding: 10px 14px 14px;
    background: var(--surface);
    border-bottom: 1px solid var(--border);
    box-shadow: var(--shadow);
  }

  .nav-open { display: flex; }
}
</style>
