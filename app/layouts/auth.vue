<template>
  <div class="auth-shell">
    <div class="auth-panel">
      <NuxtLink to="/" class="brand">
        <span class="brand-mark">N</span>
        <span>NeoBank</span>
      </NuxtLink>
      <slot />
    </div>

    <aside class="auth-aside">
      <div class="aside-content">
        <h2 class="aside-title">Banking that keeps up with you</h2>
        <p class="aside-text">
          Multi-currency accounts, instant transfers between NeoBank customers and a
          complete, searchable history of every transaction.
        </p>
        <ul class="aside-list">
          <li>Double-entry ledger — every balance is provable</li>
          <li>Multi-currency accounts in PLN, EUR, USD and GBP</li>
          <li>Instant internal transfers, SEPA-style external payouts</li>
          <li>Full audit trail on every account action</li>
        </ul>
      </div>
    </aside>
  </div>
</template>

<style scoped>
.auth-shell {
  min-height: 100dvh;
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
}

.auth-panel {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 26px;
  padding: 40px clamp(20px, 6vw, 76px);
  background: var(--surface);
}

.brand {
  display: flex;
  align-items: center;
  gap: 9px;
  font-weight: 700;
  font-size: 1.05rem;
  color: var(--text);
  text-decoration: none;
}

.brand:hover { text-decoration: none; }

.brand-mark {
  width: 32px;
  height: 32px;
  display: grid;
  place-items: center;
  border-radius: 9px;
  background: var(--primary);
  color: #fff;
  font-weight: 700;
}

.auth-aside {
  display: flex;
  align-items: center;
  padding: 40px clamp(20px, 5vw, 60px);
  background: linear-gradient(150deg, var(--primary) 0%, var(--primary-dark) 100%);
  color: #fff;
}

.aside-content { max-width: 420px; display: flex; flex-direction: column; gap: 16px; }
.aside-title { font-size: 1.75rem; color: #fff; }
.aside-text { opacity: 0.9; font-size: 0.95rem; }

.aside-list {
  list-style: none;
  margin: 8px 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 11px;
  font-size: 0.9rem;
}

.aside-list li {
  padding-left: 26px;
  position: relative;
  opacity: 0.94;
}

.aside-list li::before {
  content: '✓';
  position: absolute;
  left: 0;
  font-weight: 700;
}

@media (max-width: 900px) {
  .auth-shell { grid-template-columns: 1fr; }
  .auth-aside { display: none; }
  .auth-panel { min-height: 100dvh; }
}
</style>
