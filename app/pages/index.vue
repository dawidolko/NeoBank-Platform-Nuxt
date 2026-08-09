<script setup lang="ts">
definePageMeta({ layout: false })

useHead({ title: 'NeoBank — Digital Banking Platform' })

const { isAuthenticated } = useAuth()

const features = [
  {
    icon: '⚡',
    title: 'Instant transfers',
    text: 'Money moves between NeoBank accounts the moment you confirm — no batch windows.',
  },
  {
    icon: '🌍',
    title: 'Multi-currency',
    text: 'Hold PLN, EUR, USD and GBP side by side, each with its own IBAN.',
  },
  {
    icon: '📊',
    title: 'Complete history',
    text: 'Filter and search every transaction by date, account, type or reference.',
  },
  {
    icon: '🔐',
    title: 'Built to be audited',
    text: 'Argon2id credentials, hashed sessions and an append-only audit log.',
  },
]
</script>

<template>
  <div class="landing">
    <header class="landing-header">
      <div class="container row-between">
        <span class="brand">
          <span class="brand-mark">N</span>
          <span>NeoBank</span>
        </span>
        <nav class="row">
          <NuxtLink v-if="isAuthenticated" to="/dashboard" class="btn btn-sm">Open banking</NuxtLink>
          <template v-else>
            <NuxtLink to="/login" class="btn btn-ghost btn-sm">Sign in</NuxtLink>
            <NuxtLink to="/register" class="btn btn-sm">Open an account</NuxtLink>
          </template>
        </nav>
      </div>
    </header>

    <section class="hero">
      <div class="container hero-inner">
        <span class="badge badge-primary">Demo platform</span>
        <h1 class="hero-title">Banking infrastructure,<br >built from scratch.</h1>
        <p class="hero-text">
          A fullstack digital bank: multi-currency accounts, a double-entry ledger,
          instant transfers, searchable statements and an administration panel.
        </p>
        <div class="row hero-actions">
          <NuxtLink to="/register" class="btn">Open an account</NuxtLink>
          <NuxtLink to="/login" class="btn btn-secondary">Sign in to demo</NuxtLink>
        </div>
        <p class="tiny muted">
          Demo credentials — customer: <code class="mono">anna.kowalska@example.com</code> /
          <code class="mono">Customer12345!</code>
        </p>
      </div>
    </section>

    <section class="container features">
      <div class="grid grid-4">
        <article v-for="feature in features" :key="feature.title" class="card feature">
          <span class="feature-icon">{{ feature.icon }}</span>
          <h3>{{ feature.title }}</h3>
          <p class="small muted">{{ feature.text }}</p>
        </article>
      </div>
    </section>

    <section class="container stack-section">
      <div class="card tech">
        <div>
          <h2>Under the hood</h2>
          <p class="small muted">
            Every balance is derived from immutable ledger entries, written inside a
            serializable transaction with row-level locking — the same discipline real
            core banking systems use.
          </p>
        </div>
        <ul class="tech-list">
          <li><strong>Nuxt 4</strong> — SSR, file-based routing, Nitro server</li>
          <li><strong>TypeScript</strong> — strict mode across app and server</li>
          <li><strong>Prisma + PostgreSQL</strong> — typed access, versioned migrations</li>
          <li><strong>Docker</strong> — one command from clone to running bank</li>
        </ul>
      </div>
    </section>

    <footer class="landing-footer">
      <div class="container row-between">
        <span class="tiny muted">NeoBank — demo project. No real funds are involved.</span>
        <span class="tiny muted">© 2026 Dawid Olko</span>
      </div>
    </footer>
  </div>
</template>

<style scoped>
.landing { min-height: 100vh; display: flex; flex-direction: column; background: var(--bg); }

.landing-header {
  padding: 15px 0;
  background: var(--surface);
  border-bottom: 1px solid var(--border);
}

.brand { display: flex; align-items: center; gap: 9px; font-weight: 700; }

.brand-mark {
  width: 30px;
  height: 30px;
  display: grid;
  place-items: center;
  border-radius: 9px;
  background: var(--primary);
  color: #fff;
  font-weight: 700;
}

.hero { padding: clamp(48px, 9vw, 92px) 0 clamp(36px, 6vw, 60px); }

.hero-inner {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 17px;
  max-width: 660px;
}

.hero-title {
  font-size: clamp(2rem, 5.4vw, 3.15rem);
  line-height: 1.1;
  letter-spacing: -0.035em;
}

.hero-text { font-size: 1.03rem; color: var(--text-muted); max-width: 540px; }
.hero-actions { margin-top: 6px; flex-wrap: wrap; }

.features { padding-bottom: 30px; }

.feature { display: flex; flex-direction: column; gap: 8px; }
.feature-icon { font-size: 1.5rem; }

.stack-section { padding-bottom: 46px; }

.tech {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 26px;
  align-items: center;
  padding: 28px;
}

.tech-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 9px;
  font-size: 0.88rem;
  color: var(--text-muted);
}

.tech-list li { padding-left: 18px; position: relative; }
.tech-list li::before { content: '▸'; position: absolute; left: 0; color: var(--primary); }
.tech-list strong { color: var(--text); }

.landing-footer {
  margin-top: auto;
  padding: 18px 0;
  border-top: 1px solid var(--border);
  background: var(--surface);
}

@media (max-width: 760px) {
  .tech { grid-template-columns: 1fr; }
}
</style>
