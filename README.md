# NeoBank Platform

> 🚀 **Fullstack Retail Banking Platform** - Accounts, transfers and an admin panel on a real double-entry ledger

**NeoBank** is a working retail banking system built from scratch with **Nuxt 4**, **TypeScript**, **Prisma** and **PostgreSQL** — not a UI mock-up. Balances are derived from an immutable double-entry ledger, and money can only move through transactions that are guaranteed to balance. Customers hold multi-currency accounts with checksum-correct IBANs, send internal and external transfers, schedule standing orders and export statements; administrators manage users and review an append-only audit trail.

The project demonstrates the engineering that banking correctness actually requires: `BigInt` minor units end to end, `SERIALIZABLE` transactions with deterministic lock ordering, retry-on-serialization-failure, Argon2id password hashing with hashed session tokens, and a standalone reconciliation script that re-derives eight ledger invariants straight from SQL. Fully containerized with Docker and covered by a Vitest suite that runs against a real PostgreSQL.

[![CI](https://github.com/dawidolko/NeoBank-Platform-Nuxt/actions/workflows/ci.yml/badge.svg)](https://github.com/dawidolko/NeoBank-Platform-Nuxt/actions/workflows/ci.yml)
[![Nuxt](https://img.shields.io/badge/Nuxt-4.x-00DC82?logo=nuxt&logoColor=white)](https://nuxt.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Prisma](https://img.shields.io/badge/Prisma-6.x-2D3748?logo=prisma&logoColor=white)](https://www.prisma.io)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-17-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org)
[![Vitest](https://img.shields.io/badge/Vitest-3.x-6E9F18?logo=vitest&logoColor=white)](https://vitest.dev)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## 🎯 Key Features

### 💰 Banking Core

- 🌍 **Multi-Currency Accounts** — PLN, EUR, USD and GBP, each with its own valid IBAN (checksum-correct, ISO 13616 mod-97)
- 📒 **Double-Entry Ledger** — every internal transfer writes exactly two entries (a debit and a credit) whose amounts sum to zero; an account balance always equals the sum of its entries
- ⚡ **Instant Internal Transfers** between NeoBank accounts, plus external payouts to any valid IBAN — transfers between your own accounts are one click
- 📉 **Overdrafts** — credit accounts may go negative up to a configured limit; everything else is hard-blocked at zero
- 🚧 **Per-Transaction Ceilings** on transfers and deposits
- 📤 **Statement Export** — download any filtered view as CSV, with spreadsheet formula injection neutralised
- 🔁 **Standing Orders** — weekly or monthly payments that repeat on their own, executed by a Nitro scheduled task, with pause, resume and cancel
- 💳 **Cards and Saved Recipients** for faster repeat transfers

### 📊 Insight

- 🍩 **Spending by Category** — every transfer is categorised automatically from its title, then charted as a donut with a per-month breakdown
- 📈 **Balance Trend** — a 30-day area chart on the dashboard, drawn inline from the ledger with no chart library
- 💱 **Money In / Out / Net, per currency** — a EUR movement never contaminates a PLN total
- 🥇 **Top Payments** with proportional meters
- 🔔 **In-App Notifications** for money received, low balance and standing orders, with an unread badge
- ⚠️ **Low Balance Alerts** per account, firing once on the crossing rather than on every payment underneath the threshold
- 🌗 **Light, Dark and System Themes**, remembered across visits and applied before first paint so there is no flash

### 🔐 Accounts & Access

- 🔑 Registration and sign-in with **Argon2id** password hashing (OWASP parameters)
- 🧬 **Hashed Session Tokens** — only a SHA-256 digest is stored, so a leaked database yields no usable session cookies
- 🛑 **Rate Limiting** on sign-in, registration and transfers
- 👤 **Profile and Security Page** — edit your details, change your password, and review or revoke the devices you are signed in on
- 🧑‍⚖️ **Role-Based Access** (`CUSTOMER` / `ADMIN`) enforced on both the API and the routes
- 🚪 Suspending a user **revokes their live sessions**, not just future logins

### 🛡️ Admin Panel

- 📊 Bank-wide statistics — customers, accounts, transfer volume, deposits held
- 👥 **User Management** — suspend, reactivate, promote to administrator; every destructive action is confirmed and spells out its consequences first
- 🧾 Full transfer ledger across all customers, with search and status filters
- 📜 **Append-Only Audit Log**, filterable by action and entity

---

## 🖼️ Screenshots

| Dashboard — balances & 30-day flow | Insights — where the money goes |
|---|---|
| [<img src="docs/screenshots/dashboard.webp" alt="Customer dashboard with total balance, money in and out, a 30-day sparkline and multi-currency account cards"/>](docs/screenshots/dashboard.webp) | [<img src="docs/screenshots/insights.webp" alt="Insights page with total spent, monthly average, spending split by category donut chart and a by-month breakdown"/>](docs/screenshots/insights.webp) |

| Accounts | Transactions |
|---|---|
| [<img src="docs/screenshots/accounts.webp" alt="Accounts page listing everyday, savings and foreign currency accounts with IBANs and balances"/>](docs/screenshots/accounts.webp) | [<img src="docs/screenshots/transactions.webp" alt="Transaction history with counterparties, categories and running balances"/>](docs/screenshots/transactions.webp) |

| Send money | Administration |
|---|---|
| [<img src="docs/screenshots/transfer.webp" alt="Transfer form with source account, recipient IBAN, amount and title fields"/>](docs/screenshots/transfer.webp) | [<img src="docs/screenshots/admin.webp" alt="Admin overview with customer, account and transfer counters, deposits held, transfers by status and latest transfers"/>](docs/screenshots/admin.webp) |

| Audit log | Sign in |
|---|---|
| [<img src="docs/screenshots/admin-audit.webp" alt="Administrator audit log listing recorded actions"/>](docs/screenshots/admin-audit.webp) | [<img src="docs/screenshots/login.webp" alt="Sign in page with email and password fields"/>](docs/screenshots/login.webp) |

> Captured from the running Docker dev stack with the deterministic seed data.
> At capture time `npm run db:verify` reconciled the ledger across **7 accounts, 142 transfers and 156 entries** — all eight invariants passing.

---

## 🏗️ Architecture

### Application Layer

![Application Layer](docs/diagrams/app-layer.svg)

### Application Architecture

![Application Architecture](docs/diagrams/architecture.svg)

### Design Decisions Worth Calling Out

**Business logic lives in services, not endpoints.** API handlers parse input, call a service and map the result to a response. `executeTransfer` is the single path money can move through, so the locking and balancing rules cannot be bypassed by a new endpoint.

**BigInt is serialized explicitly.** `BigInt` cannot cross JSON, so every response runs through `serializeBigInt`, which converts money columns to strings. The client receives exact minor-unit values and formats them for display.

**SSR cookie forwarding is per-request.** During SSR, `useFetch` opens a fresh internal request that carries none of the browser's cookies, so protected pages pass `useApiHeaders()`. This is deliberately a composable rather than a patched global `$fetch`: `globalThis.$fetch` is shared by every concurrent render, so pinning one visitor's cookie onto it would leak that session to other users.

**Ownership is enforced by scoping, not by checking.** Queries filter on `userId` (`prisma.account.findFirst({ where: { id, userId } })`), so another customer's identifier reads as *not found* rather than relying on a separate authorization branch that could be forgotten.

**Failed transfers do not reveal who banks here.** If a destination IBAN exists inside NeoBank but cannot receive the money — frozen, or a different currency — the transfer is treated as external instead of being refused with a specific reason. Saying "that account is frozen" would confirm the IBAN belongs to a NeoBank customer and disclose its state. Only your *own* accounts get a descriptive error.

---

## 💸 How the Money Works

Three rules make the ledger trustworthy. They are enforced in code, not by convention, and re-checked from SQL by `npm run db:verify`.

**1. Money is never a float.** Every amount is a `BigInt` count of minor units (grosze, cents) end to end — database, API and business logic. Floats appear only at the presentation edge. Amounts beyond `Number.MAX_SAFE_INTEGER` stay exact.

**2. Every transfer balances.** A transfer owns its entries. Internal transfers write two legs that sum to zero; the balance written to the account always equals the running total of its entries, recorded on each entry as `balanceAfterCents`.

**3. Concurrent transfers cannot corrupt a balance.** Each transfer runs in a `SERIALIZABLE` transaction that locks the touched accounts **in a deterministic order (by id)** before reading any balance, then re-checks funds against the *locked* value. Ordering the locks is what prevents deadlocks when two transfers move money in opposite directions between the same pair of accounts.

PostgreSQL may still abort a transaction with a serialization failure under contention. That is not a business error, so the service replays it with exponentially backed-off jitter; only if the retries are exhausted does the customer see a `409` asking them to try again.

> Verified under load: 80 concurrent bidirectional transfers complete with zero deadlocks, money perfectly conserved, and every transfer carrying exactly two balanced legs. When an account is funded for exactly *N* transfers and 3×*N* are fired at once, exactly *N* succeed and the rest are cleanly refused.

### 🔎 Reconciling the Ledger

```bash
npm run db:verify
```

`scripts/verify-ledger.ts` is a standalone reconciliation tool. It re-derives **eight invariants straight from SQL**, independently of the code that wrote the rows, and exits non-zero if any of them fails:

| # | Invariant | What it proves |
|---|---|---|
| 1 | **balances match entries** | Every account balance equals the sum of its ledger entries |
| 2 | **internal transfers balance** | The legs of each internal transfer sum to zero |
| 3 | **internal transfers have two legs** | Exactly one debit and one credit, never more or fewer |
| 4 | **overdraft limits respected** | No account is negative beyond its configured limit |
| 5 | **entry directions match their sign** | A debit is negative and a credit positive, with no mismatches |
| 6 | **no orphaned entries** | Every entry belongs to an existing transfer and account |
| 7 | **completed transfers are booked** | No transfer marked completed is missing its ledger entries |
| 8 | **running balances form an unbroken chain** | Each `balanceAfterCents` links to the preceding entry's balance |

The run prints a per-check line with the violation count and finishes with a summary of how many accounts, transfers and entries were inspected. CI runs it after seeding, so a schema or service change that silently breaks the ledger fails the build rather than reaching production.

---

## 🧭 Screens

| Route | Purpose |
|---|---|
| `/` | Landing page |
| `/login`, `/register` | Authentication |
| `/dashboard` | Balances by currency, 30-day money in/out/net, recent activity |
| `/accounts` | Open and manage accounts, totals per currency |
| `/accounts/:id` | Account detail — balance, cards, statement, top-up, rename, close |
| `/transfer` | Send money, with own-account and saved-recipient shortcuts |
| `/transactions` | Full statement: filter by account, type, date, text; CSV export |
| `/transactions/:id` | Transaction receipt with both sides of the entry |
| `/insights` | Spending by category and by month, per currency |
| `/standing-orders` | Scheduled payments — create, pause, resume, cancel |
| `/beneficiaries` | Saved recipients |
| `/profile` | Personal details, password change, signed-in devices |
| `/admin` | Bank-wide overview *(admin only)* |
| `/admin/users` | User management *(admin only)* |
| `/admin/transactions` | All transfers *(admin only)* |
| `/admin/audit` | Filterable audit log *(admin only)* |

---

## 🛠️ Technology Stack

### Frontend

- **Nuxt 4** (Vue 3, SSR, file-based routing) — application shell and pages
- **TypeScript**, strict mode across app, server and scripts
- **Hand-written CSS design system** — tokens, components and light/dark themes; no UI framework
- **@nuxt/fonts** — self-hosted Inter
- **Inline SVG icon set** — no icon font, no third-party request
- **Inline charts** — `DonutChart` and `SparkLine` drawn from the ledger with no chart library

### Backend

- **Nitro** server (bundled with Nuxt 4) — REST endpoints under `server/api`
- **Prisma 6** — typed database access and versioned migrations
- **PostgreSQL 17** — relational store with `SERIALIZABLE` transactions
- **Zod 3** — validation schemas shared by every endpoint
- **argon2** — Argon2id password hashing
- **Nitro scheduled tasks** — standing order execution

### Infrastructure & Tooling

- **Docker** & **Docker Compose** — dev and production stacks
- **Vitest 3** (+ `@vitest/coverage-v8`, `@nuxt/test-utils`) — unit and integration tests against a real PostgreSQL
- **ESLint 9** (`@nuxt/eslint`) and **vue-tsc** — linting and type checking
- **tsx** — running the seed and ledger-verification scripts
- **GitHub Actions** — lint, typecheck, test, reconcile, build, boot

---

## 🚀 Getting Started

### Prerequisites

- **Docker** and **Docker Compose** — the recommended path, nothing else needed
- Without Docker: **Node.js 22+** and a running **PostgreSQL 17**

### 1. Clone the Repository

```bash
git clone https://github.com/dawidolko/NeoBank-Platform-Nuxt.git
cd NeoBank-Platform-Nuxt
```

### 2. Install Dependencies

Docker installs everything inside the image. For a local setup:

```bash
cp .env.example .env          # then set DATABASE_URL
npm install
```

### 3. Run

One command brings up the database, applies migrations, seeds demo data and starts the app:

```bash
docker compose -f .tools/docker/docker-compose.yml up --build
```

Open **http://localhost:3000** and sign in with either demo account:

| Role | Email | Password |
|---|---|---|
| Customer | `anna.kowalska@example.com` | `Customer12345!` |
| Administrator | `admin@neobank.dev` | `Admin12345!` |

> No local Node.js or PostgreSQL installation is required — everything runs in containers. The first request compiles the dev bundle, so give it a moment.

Useful Docker commands:

```bash
# Follow logs / open a shell
docker compose -f .tools/docker/docker-compose.yml logs -f app
docker compose -f .tools/docker/docker-compose.yml exec app sh

# Stop (add -v to also drop the database volume)
docker compose -f .tools/docker/docker-compose.yml down
```

Running locally without Docker:

```bash
npm run db:migrate            # apply migrations
npm run db:seed               # load demo data
npm run dev                   # http://localhost:3000
```

### 📜 Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm start` | Run the built server (`.output/server/index.mjs`) |
| `npm run preview` | Preview the production build |
| `npm test` | Run the test suite |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:coverage` | Tests with a coverage report |
| `npm run lint` / `npm run lint:fix` | ESLint |
| `npm run typecheck` | Typecheck app, server and standalone scripts |
| `npm run db:generate` | Regenerate the Prisma client |
| `npm run db:migrate` | Create and apply a migration |
| `npm run db:deploy` | Apply committed migrations (production) |
| `npm run db:seed` | Seed demo data (idempotent) |
| `npm run db:verify` | **Reconcile the ledger against itself (eight SQL invariants)** |
| `npm run db:reset` | Drop, re-migrate and re-seed |
| `npm run db:studio` | Prisma Studio |

---

## 🧪 Testing

```bash
npm test
```

135 tests covering the parts where a mistake costs money:

- **Money handling** — parsing, formatting, round-trips, values beyond `Number.MAX_SAFE_INTEGER`, rejection of over-precise and negative amounts
- **IBAN** — validated against real-world IBANs from six countries; rejects tampered check digits and transpositions that a length check alone would miss
- **Validation** — every password rule, IBAN normalization, amount formats, profile and admin query schemas
- **Rate limiting** — window expiry, per-identifier isolation so one account cannot lock out another, and reset after a successful sign-in
- **Retry detection** — regression tests pinning the error shapes that must stay retryable (Prisma reports a raw-query serialization failure as `P2010` with the real `40001` only in the message; matching on the code alone silently disables every retry)
- **Counterparty resolution** — pinned against the exact shape each endpoint returns, because the dashboard once omitted the account relations and labelled every transfer between two customers "Transfer to your account"
- **Pagination clamping** — a page past the end resolves to the last page rather than stranding the visitor with no controls
- **BigInt serialization** — the response path of every endpoint that returns money
- **Categorisation** — merchant rules, and the guarantee that an internal transfer is never counted as spending
- **Schedule arithmetic** — a monthly order on the 31st lands on the last day of a shorter month, and anchors to its due date so a late run never drifts
- **Limits** — overdraft and per-transaction ceiling enforcement
- **Ledger integrity** *(integration, real PostgreSQL)* — balanced entries, overdraft and ceiling limits, complete rollback on failure, cross-user access refusal, non-disclosure of internal accounts, and a concurrency test asserting that racing transfers can never overdraw an account

Integration tests skip themselves when `DATABASE_URL` is unset, so the unit suite runs anywhere.

---

## 🚢 Production Deployment

```bash
export POSTGRES_USER=neobank
export POSTGRES_PASSWORD="$(openssl rand -base64 24)"
export NUXT_SESSION_SECRET="$(openssl rand -base64 32)"

docker compose -f .tools/docker/docker-compose.prod.yml up --build -d
```

The production image is a four-stage build whose runtime layer carries only the self-contained Nitro bundle plus the two tools the entrypoint shells out to (`prisma migrate deploy` and `tsx` for seeding) — no application source, no dev dependencies, no build toolchain. It runs as the non-root `node` user with a health check, and PostgreSQL is not published to the host.

On start, the entrypoint waits for the database, applies migrations, optionally seeds, and only then launches the server — a failure at any step aborts the boot rather than serving a half-migrated application.

### Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `DATABASE_URL` | ✅ | — | PostgreSQL connection string |
| `NUXT_SESSION_SECRET` | ✅ | — | Session signing secret |
| `POSTGRES_USER` | ✅ | — | Database user (compose) |
| `POSTGRES_PASSWORD` | ✅ | — | Database password (compose) |
| `POSTGRES_DB` | | `neobank_production` | Database name |
| `NUXT_SESSION_TTL_HOURS` | | `720` | Session lifetime (30 days) |
| `SEED_ON_BOOT` | | `false` in prod | Seed demo data at container start |
| `APP_PORT` | | `3000` | Published host port |

---

## 🔒 Security Notes

- **Security headers** on every response: `frame-ancestors 'none'` plus `X-Frame-Options: DENY`, a restrictive CSP, `nosniff`, `Referrer-Policy` and a `Permissions-Policy` denying camera, microphone, geolocation and payment
- API responses are `Cache-Control: no-store`
- Passwords hashed with **Argon2id** (19 MiB memory cost, OWASP minimum)
- Session tokens are 256-bit random values; **only their SHA-256 digest is stored**
- Cookies are `httpOnly`, `sameSite=lax`, and `secure` in production
- Login returns an **identical error** for an unknown email and a wrong password, and hashes a dummy password when the account does not exist so response time does not reveal whether an address is registered
- **Rate limits**: 5 sign-in attempts per minute per email, 20 per minute per IP, 3 registrations per 10 minutes, 20 transfers and 10 deposits per minute per customer, 5 password changes per 10 minutes, 5 statement exports per minute
- Failed transfers never disclose whether an IBAN belongs to NeoBank
- Every input is validated server-side with Zod, including path parameters and admin query strings; client checks are convenience only
- Suspending a user, or changing a password, deletes the affected sessions immediately
- Admins cannot change their own role or status, so the panel cannot be locked out

> This is a portfolio project. It is not certified for real financial use — there is no KYC/AML, no PSD2 strong customer authentication, no payment-rail integration, and no two-factor authentication.

---

## ♿ Accessibility

- Every interactive control has a visible `:focus-visible` outline
- Forms wire labels, `aria-invalid` and `aria-describedby` to their error text; errors are announced via `role="alert"`
- Wide tables scroll inside a keyboard-reachable region with a caption and scoped headers
- Modals trap focus, close on Escape, and restore page scrolling on exit
- Icons are `aria-hidden` with text equivalents; a skip link jumps to content
- Animation is disabled under `prefers-reduced-motion`

---

## 📁 Project Structure

```
NeoBank-Platform-Nuxt/
├── 📁 app/                          # Nuxt application (client + SSR)
│   ├── 🎨 assets/css/               # Design system: tokens, components, light/dark themes
│   ├── ⚛️ components/               # AccountCard, AppModal, DonutChart, SparkLine,
│   │                                # NotificationBell, ToastHost, StatCard, …
│   ├── 🪝 composables/              # useApi, useApiError, useAuth, useCounterparty,
│   │                                # useFormat, useTheme, useToast
│   ├── 🧱 layouts/                  # default (app shell) and auth (split-screen)
│   ├── 🛡️ middleware/               # Global route guard: auth + admin
│   └── 📄 pages/                    # File-based routes (dashboard, accounts, transfer,
│                                    # transactions, insights, standing-orders, admin/*)
├── 📁 server/                       # Nitro server
│   ├── 🔌 api/                      # REST endpoints — auth, accounts, transfers,
│   │                                # transactions, analytics, beneficiaries,
│   │                                # standing-orders, notifications, profile, admin
│   ├── 🧩 middleware/               # Session resolution on every /api request
│   ├── ⚙️ services/                 # transfers (the transfer engine), audit,
│   │                                # notifications, standingOrders
│   ├── ⏰ tasks/                    # Nitro scheduled task: standing-orders
│   └── 🧰 utils/                    # money, iban, auth, prisma, validation,
│                                    # rateLimit, serialize, categorize, pagination
├── 📁 prisma/
│   ├── 🗄️ schema.prisma             # Data model
│   ├── 📜 migrations/               # Versioned SQL migrations
│   └── 🌱 seed.ts                   # Deterministic demo data
├── 📁 scripts/
│   └── 🔎 verify-ledger.ts          # Standalone ledger reconciliation (npm run db:verify)
├── 📁 tests/                        # Vitest unit + integration suites
├── 📁 public/                       # favicon, robots.txt, web manifest
├── 📁 docs/diagrams/                # Architecture diagrams (SVG)
├── 📁 .tools/docker/                # Dockerfile, Dockerfile.dev, compose stacks, entrypoint
├── ⚙️ nuxt.config.ts                # Nuxt configuration
├── ⚙️ vitest.config.ts              # Test configuration
├── 🤖 AGENTS.md / CLAUDE.md / GEMINI.md   # Conventions for AI coding agents
└── 📖 README.md                     # Project documentation
```

> `AGENTS.md`, `CLAUDE.md` and `GEMINI.md` at the repository root document the project conventions for AI coding assistants — they point back to the "How the money works" and "Architecture" sections above as the invariants the code exists to protect.

---

## 📄 License

[MIT](LICENSE) © Dawid Olko

---

## 👨‍💻 Author

Created by **[Dawid Olko](https://github.com/dawidolko)**

- **Website** — [dawidolko.pl](https://dawidolko.pl/)
- **LinkedIn** — [@dawidolko](https://www.linkedin.com/in/dawidolko/)
