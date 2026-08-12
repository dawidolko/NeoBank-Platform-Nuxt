<script setup lang="ts">
definePageMeta({ layout: false })

useSeoMeta({
  title: 'NeoBank — Digital Banking Platform',
  description:
    'A fullstack digital bank: multi-currency accounts, a double-entry ledger, instant transfers, searchable statements and an administration panel.',
  ogTitle: 'NeoBank — Digital Banking Platform',
  ogDescription:
    'Multi-currency accounts, a double-entry ledger and instant transfers. Built with Nuxt 4, TypeScript, Prisma and PostgreSQL.',
  ogType: 'website',
  twitterCard: 'summary_large_image',
})

const { isAuthenticated } = useAuth()
const { money } = useFormat()

const features = [
  {
    icon: 'bolt',
    title: 'Instant transfers',
    text: 'Money moves between NeoBank accounts the moment you confirm — no batch windows, no overnight settlement.',
  },
  {
    icon: 'globe',
    title: 'Multi-currency',
    text: 'Hold PLN, EUR, USD and GBP side by side, each with its own checksum-valid IBAN.',
  },
  {
    icon: 'receipt',
    title: 'Complete history',
    text: 'Filter every transaction by date, account, type or reference, then export the statement as CSV.',
  },
  {
    icon: 'shield',
    title: 'Built to be audited',
    text: 'Argon2id credentials, hashed sessions, rate limiting and an append-only audit log.',
  },
] as const

const metrics = [
  { value: '8', label: 'Ledger invariants verified from SQL' },
  { value: '102', label: 'Automated tests' },
  { value: '0', label: 'Floating-point amounts' },
] as const

// Illustrative figures for the mock dashboard in the hero.
const preview = {
  balanceCents: '4281372',
  accounts: [
    { name: 'Everyday Account', balanceCents: '4281372', currency: 'PLN', type: 'CHECKING' },
    { name: 'Savings Goal', balanceCents: '900000', currency: 'PLN', type: 'SAVINGS' },
  ],
  rows: [
    { title: 'Salary — Softmind', amount: '+PLN 9,954.89', credit: true },
    { title: 'Monthly rent', amount: '−PLN 2,800.00', credit: false },
    { title: 'Biedronka', amount: '−PLN 138.20', credit: false },
  ],
}
</script>

<template>
  <div class="landing">
    <header class="landing-header">
      <div class="container row-between">
        <span class="brand">
          <span class="brand-mark" aria-hidden="true">N</span>
          <span>NeoBank</span>
        </span>

        <nav class="row" aria-label="Account">
          <ThemeToggle />
          <NuxtLink v-if="isAuthenticated" to="/dashboard" class="btn btn-sm">
            Go to dashboard
          </NuxtLink>
          <template v-else>
            <NuxtLink to="/login" class="btn btn-ghost btn-sm">Sign in</NuxtLink>
            <NuxtLink to="/register" class="btn btn-sm">Open an account</NuxtLink>
          </template>
        </nav>
      </div>
    </header>

    <section class="hero">
      <div class="container hero-grid">
        <div class="hero-copy">
          <span class="badge badge-primary badge-dot">Demo platform</span>
          <h1 class="hero-title">Banking infrastructure, built from scratch.</h1>
          <p class="hero-text">
            A fullstack digital bank: multi-currency accounts, a double-entry ledger,
            instant transfers, searchable statements and an administration panel.
          </p>

          <div class="row hero-actions">
            <NuxtLink to="/register" class="btn btn-lg">
              Open an account <AppIcon name="arrow-right" :size="16" />
            </NuxtLink>
            <NuxtLink to="/login" class="btn btn-secondary btn-lg">Sign in to demo</NuxtLink>
          </div>

          <div class="credentials">
            <p class="tiny label">Demo credentials</p>
            <p class="tiny">
              <span class="mono">anna.kowalska@example.com</span>
              <span class="subtle"> / </span>
              <span class="mono">Customer12345!</span>
            </p>
          </div>
        </div>

        <!-- Static product preview: the same components the real app renders. -->
        <div class="hero-visual" aria-hidden="true">
          <div class="preview">
            <div class="preview-bar">
              <span class="dot" /><span class="dot" /><span class="dot" />
            </div>

            <div class="preview-body">
              <div class="preview-hero">
                <span class="label">Total balance · PLN</span>
                <p class="preview-balance numeric">{{ money(preview.balanceCents) }}</p>
                <span class="preview-delta">
                  <AppIcon name="trending-up" :size="13" /> +8.4% this month
                </span>
              </div>

              <div class="preview-cards">
                <div
                  v-for="account in preview.accounts"
                  :key="account.name"
                  class="preview-card"
                  :class="account.type === 'SAVINGS' ? 'is-savings' : ''"
                >
                  <span class="tiny preview-card-name">{{ account.name }}</span>
                  <span class="numeric preview-card-balance">
                    {{ money(account.balanceCents, account.currency) }}
                  </span>
                </div>
              </div>

              <ul class="preview-rows">
                <li v-for="row in preview.rows" :key="row.title" class="preview-row">
                  <span class="preview-dot" :class="row.credit ? 'in' : 'out'">
                    <AppIcon
                      :name="row.credit ? 'arrow-down-left' : 'arrow-up-right'"
                      :size="12"
                    />
                  </span>
                  <span class="tiny truncate">{{ row.title }}</span>
                  <span class="tiny numeric" :class="row.credit ? 'amount-positive' : ''">
                    {{ row.amount }}
                  </span>
                </li>
              </ul>
            </div>
          </div>

          <span class="glow" />
        </div>
      </div>
    </section>

    <section class="container metrics-band">
      <dl class="metrics">
        <div v-for="metric in metrics" :key="metric.label" class="metric">
          <dt class="metric-value numeric">{{ metric.value }}</dt>
          <dd class="metric-label tiny muted">{{ metric.label }}</dd>
        </div>
      </dl>
    </section>

    <section class="container section">
      <div class="section-head">
        <h2>Everything a retail bank needs</h2>
        <p class="muted">Not a UI mock-up — the ledger underneath is real.</p>
      </div>

      <div class="grid grid-4">
        <article v-for="feature in features" :key="feature.title" class="card feature card-interactive">
          <span class="feature-icon"><AppIcon :name="feature.icon" :size="19" /></span>
          <h3>{{ feature.title }}</h3>
          <p class="small muted">{{ feature.text }}</p>
        </article>
      </div>
    </section>

    <section class="container section">
      <div class="card tech">
        <div class="tech-copy">
          <h2>Under the hood</h2>
          <p class="small muted">
            Every balance is derived from immutable ledger entries, written inside a
            serializable transaction with row-level locking — the same discipline real
            core banking systems use. Eight invariants are re-checked straight from SQL.
          </p>
          <NuxtLink to="/register" class="btn btn-secondary btn-sm tech-cta">
            Try the demo <AppIcon name="arrow-right" :size="14" />
          </NuxtLink>
        </div>

        <ul class="tech-list">
          <li>
            <AppIcon name="check" :size="15" />
            <span><strong>Nuxt 4</strong> — SSR, file-based routing, Nitro server</span>
          </li>
          <li>
            <AppIcon name="check" :size="15" />
            <span><strong>TypeScript</strong> — strict mode across app and server</span>
          </li>
          <li>
            <AppIcon name="check" :size="15" />
            <span><strong>Prisma + PostgreSQL</strong> — typed access, versioned migrations</span>
          </li>
          <li>
            <AppIcon name="check" :size="15" />
            <span><strong>Docker</strong> — one command from clone to running bank</span>
          </li>
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
.landing {
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  background: var(--bg);
}

.landing-header {
  position: sticky;
  top: 0;
  z-index: var(--z-sticky);
  padding: var(--space-3) 0;
  background: color-mix(in srgb, var(--surface) 82%, transparent);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--border);
}

.brand {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-weight: var(--weight-bold);
}

.brand-mark {
  width: 30px;
  height: 30px;
  display: grid;
  place-items: center;
  border-radius: var(--radius-xs);
  background: var(--card-checking);
  color: #fff;
  font-weight: var(--weight-bold);
}

/* --- Hero ----------------------------------------------------------------- */

.hero {
  position: relative;
  padding: clamp(var(--space-12), 8vw, 96px) 0 clamp(var(--space-10), 6vw, 72px);
  overflow: hidden;
}

.hero::before {
  content: '';
  position: absolute;
  inset: 0;
  background:
    radial-gradient(60% 70% at 78% 8%, var(--primary-soft) 0%, transparent 62%),
    radial-gradient(46% 56% at 6% 4%, color-mix(in srgb, var(--success) 12%, transparent) 0%, transparent 60%);
  pointer-events: none;
}

.hero-grid {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 0.95fr);
  gap: clamp(var(--space-8), 5vw, var(--space-16));
  align-items: center;
}

.hero-copy { display: flex; flex-direction: column; align-items: flex-start; gap: var(--space-4); }

.hero-title {
  font-size: clamp(2.1rem, 4.6vw, 3.4rem);
  line-height: 1.06;
  letter-spacing: -0.035em;
  max-width: 15ch;
}

.hero-text { font-size: var(--text-md); color: var(--text-muted); max-width: 46ch; }
.hero-actions { flex-wrap: wrap; margin-top: var(--space-1); }

.credentials {
  margin-top: var(--space-2);
  padding: var(--space-3) var(--space-4);
  border: 1px dashed var(--border-strong);
  border-radius: var(--radius-sm);
  background: var(--surface-muted);
}

/* --- Hero preview --------------------------------------------------------- */

.hero-visual { position: relative; }

.glow {
  position: absolute;
  inset: 12% -8% -12% 8%;
  z-index: 0;
  border-radius: 50%;
  background: radial-gradient(closest-side, color-mix(in srgb, var(--primary) 26%, transparent), transparent);
  filter: blur(48px);
  pointer-events: none;
}

.preview {
  position: relative;
  z-index: 1;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: var(--surface);
  box-shadow: var(--shadow-xl);
  overflow: hidden;
  transform: perspective(1400px) rotateY(-9deg) rotateX(3deg);
  transition: transform var(--duration-slow) var(--ease-out);
}

.preview:hover { transform: perspective(1400px) rotateY(-4deg) rotateX(1deg); }

.preview-bar {
  display: flex;
  gap: 6px;
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--border);
  background: var(--surface-muted);
}

.dot { width: 9px; height: 9px; border-radius: 50%; background: var(--border-strong); }

.preview-body { padding: var(--space-5); display: flex; flex-direction: column; gap: var(--space-4); }

.preview-balance {
  font-size: var(--text-2xl);
  font-weight: var(--weight-bold);
  letter-spacing: -0.03em;
  line-height: 1.15;
}

.preview-delta {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  font-size: var(--text-xs);
  font-weight: var(--weight-medium);
  color: var(--success);
}

.preview-cards { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-3); }

.preview-card {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  padding: var(--space-3);
  border-radius: var(--radius-sm);
  background: var(--card-checking);
  color: #fff;
}

.preview-card.is-savings { background: var(--card-savings); }
.preview-card-name { opacity: 0.85; }
.preview-card-balance { font-weight: var(--weight-semibold); font-size: var(--text-sm); }

.preview-rows { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }

.preview-row {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-2) 0;
  border-bottom: 1px solid var(--border);
}

.preview-row:last-child { border-bottom: none; }

.preview-dot {
  display: grid;
  place-items: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: var(--surface-muted);
  color: var(--text-muted);
}

.preview-dot.in { background: var(--success-soft); color: var(--success); }

/* --- Metrics -------------------------------------------------------------- */

.metrics-band { padding-bottom: var(--space-10); }

.metrics {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: var(--space-5);
  margin: 0;
  padding: var(--space-6);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface);
}

.metric { text-align: center; }
.metric-value {
  font-size: var(--text-2xl);
  font-weight: var(--weight-bold);
  letter-spacing: -0.03em;
  color: var(--primary);
}
.metric-label { margin: var(--space-1) 0 0; }

/* --- Sections ------------------------------------------------------------- */

.section { padding-bottom: clamp(var(--space-10), 6vw, var(--space-16)); }
.section-head { margin-bottom: var(--space-6); }
.section-head h2 { font-size: var(--text-2xl); letter-spacing: -0.025em; }
.section-head p { margin-top: var(--space-2); }

.feature { display: flex; flex-direction: column; gap: var(--space-2); }

.feature-icon {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  margin-bottom: var(--space-2);
  border-radius: var(--radius-sm);
  background: var(--primary-soft);
  color: var(--primary);
}

.tech {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: var(--space-8);
  align-items: center;
  padding: var(--space-8);
}

.tech-copy h2 { font-size: var(--text-xl); }
.tech-copy p { margin-top: var(--space-3); }
.tech-cta { margin-top: var(--space-5); }

.tech-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  font-size: var(--text-sm);
  color: var(--text-muted);
}

.tech-list li { display: flex; align-items: flex-start; gap: var(--space-3); }
.tech-list svg { color: var(--success); margin-top: 3px; }
.tech-list strong { color: var(--text); font-weight: var(--weight-semibold); }

.landing-footer {
  margin-top: auto;
  padding: var(--space-5) 0;
  border-top: 1px solid var(--border);
  background: var(--surface);
}

@media (max-width: 900px) {
  .hero-grid { grid-template-columns: 1fr; }
  .hero-visual { display: none; }
  .tech { grid-template-columns: 1fr; padding: var(--space-6); }
}
</style>
