# AGENTS.md

Guide for agents working on NeoBank. Add a section per area as conventions
emerge — don't pad sections with content that isn't established yet.

## What this project is

A fullstack banking platform: Nuxt 4 (Vue 3, SSR, Nitro), TypeScript in strict
mode, Prisma 6 against PostgreSQL 17, containerized with Docker. Customers hold
multi-currency accounts and move money through a double-entry ledger;
administrators manage users and review an audit trail.

Read [README.md](README.md) first — the "How the money works" and "Architecture"
sections explain the invariants the code exists to protect.

## Language

**UI copy is always English. No exceptions.** Labels, buttons, hints, validation
messages, page titles, empty states, error text — all English. Even if you find
a string in another language, new code is English and old code gets translated
when you touch it.

User-supplied data (transfer titles, recipient names) is whatever the user
typed. Render it as-is; never "normalize" it.

The boundary: did a developer write this string, or did a user? Developer
strings → English. Everything else → don't touch.

## Money

Read this before touching anything that holds an amount.

**Every amount is a `BigInt` of minor units** (grosze, cents) — in the database,
in services, in API responses. Never `number`, never a float, never a decimal
string in business logic.

```ts
const amountCents = parseAmountToCents('120.50', 'PLN') // 12050n
```

Rules:

1. **Parse at the edge.** User input becomes `BigInt` in the endpoint via
   `parseAmountToCents(input, currency)`, which rejects negatives, zero and
   over-precise values. Services receive `BigInt` and nothing else.
2. **Serialize on the way out.** `BigInt` cannot cross JSON. Every response goes
   through `serializeBigInt(...)`, which converts money to strings. The client
   formats via `useFormat()`.
3. **Never sum across currencies.** Group by currency first — see
   `balancesByCurrency` in `server/api/dashboard.get.ts`.
4. **Compare with the helper.** Use `hasSufficientFunds(balance, overdraft, debit)`
   rather than reimplementing the overdraft rule.

## The ledger

`server/services/transfers.ts` is the only place money moves. Do not write
balance updates anywhere else.

Non-negotiable invariants — every one is covered by a test in
`tests/transfers.integration.test.ts`:

1. **An account's balance equals the sum of its entries.** Never write
   `balanceCents` without writing the matching `Entry` in the same transaction.
   Seeding an "opening balance" directly onto the column breaks reconciliation —
   book a `DEPOSIT` instead.
2. **Internal transfers write exactly two entries summing to zero.**
3. **Balances are read after locking, never before.** The transaction locks the
   touched accounts `FOR UPDATE` **ordered by id**, then re-reads. The ordering
   is what prevents deadlocks between opposing transfers; keep it.
4. **Funds are re-checked against the locked balance**, not the value the caller
   saw.

### Serialization conflicts

Under `SERIALIZABLE`, PostgreSQL aborts transactions that race. That is not a
business error — `withSerializableRetry` replays with jittered backoff.

Prisma does **not** put the SQLSTATE on `error.code` for raw queries: a failed
`$queryRaw` surfaces as `P2010` with the real `40001` only in the message.
Matching on the code alone silently disables every retry. `isRetryableConflict`
handles both shapes and is pinned by `tests/retry.test.ts` — extend it there if
you meet a new error shape.

## Server code

### Endpoints stay thin

An endpoint does four things: validate input, resolve the caller, call a
service, shape the response.

```ts
export default defineEventHandler(async (event) => {
  const user = requireUser(event)
  const input = parseOrThrow(transferSchema, await readBody(event))
  const transfer = await executeTransfer({ userId: user.id, ...input })

  return serializeBigInt({ transfer })
})
```

- **No business logic in handlers.** Multi-step work with a transaction belongs
  in `server/services/`.
- **No `prisma.$transaction` in an endpoint.** That's a service.
- **Scope by owner.** `prisma.account.findFirst({ where: { id, userId } })` —
  never `findUnique({ where: { id } })` followed by a manual ownership check. A
  foreign id should read as 404.
- **Validate with Zod.** Add the schema to `server/utils/validation.ts` and call
  `parseOrThrow`, which turns failures into a 422 whose `data.errors` maps
  field → message. That is the shape the forms render.

### Services

One use case per service, verb-named, in `server/services/<domain>.ts`. Domain
errors are typed (`TransferError` carries its own status code) so the endpoint
can translate them; bugs propagate.

Side effects are explicit. The service that saves also writes the audit entry,
in the same transaction — pass the transaction client to `recordAudit`, so the
log commits or rolls back with the thing it describes.

## Frontend

### SSR and authentication

Protected pages must forward the session cookie:

```ts
const { data } = await useFetch('/api/dashboard', { headers: useApiHeaders() })
```

During SSR, `useFetch` opens a fresh internal request carrying none of the
browser's cookies. Without this the page renders as signed-out and guarded
routes bounce to `/login`.

**Never patch `globalThis.$fetch` to do this automatically.** It is shared by
every concurrent SSR render, so pinning one visitor's cookie leaks their session
into other users' responses. This was tried and reverted; keep it per-request.

### Styling

Hand-written CSS in `app/assets/css/main.css` — no Tailwind, no UI framework.

- **Use the tokens.** `var(--primary)`, `var(--text-muted)`, `var(--radius)` —
  never raw hex. Both themes are defined; a hard-coded colour breaks dark mode.
- **Use the existing classes** before writing new ones: `.card`, `.btn`,
  `.input`, `.badge`, `.table`, `.stack`, `.grid`, `.alert`, `.empty`.
- **Component-specific styles go in `<style scoped>`.** Only genuinely shared
  utilities belong in `main.css`.
- Extract a component when the same markup appears **3+ times** or carries
  non-trivial logic. Don't extract on impulse.

### Formatting

All display formatting goes through `useFormat()` — `money`, `signedMoney`,
`date`, `relative`, `iban`, `maskIban`. Don't hand-roll `Intl` calls in a
component; amounts arrive as strings and must be converted in one place.

## Database

Schema changes go through Prisma migrations — never edit a committed migration.

```bash
npm run db:migrate    # create + apply
npm run db:deploy     # apply only (production, and the container entrypoint)
```

The seed (`prisma/seed.ts`) runs on **every** container boot, so it must stay
idempotent: upsert on natural keys, and guard history generation behind an
existence check. It uses a seeded PRNG — demo data must be identical on every
machine, so `Math.random()` and `Date.now()` are out for anything persisted.

## Testing

```bash
npm test
```

- Unit tests for pure logic (`money`, `iban`, `validation`, retry detection).
- Integration tests for the ledger, against real PostgreSQL — the locking and
  isolation guarantees cannot be reproduced with a mock. They skip themselves
  when `DATABASE_URL` is unset.
- Open test accounts at zero and fund them through `executeDeposit`, so
  balances stay reconcilable against entries.

Any change to `server/services/transfers.ts` needs a test proving the invariant
it touches still holds.

## Docker

Everything lives in `.tools/docker/`:

| File                      | Purpose                                            |
| ------------------------- | -------------------------------------------------- |
| `Dockerfile`              | Production, four stages, runtime carries no source |
| `Dockerfile.dev`          | Development, source bind-mounted                   |
| `docker-compose.yml`      | Dev stack with hot reload                          |
| `docker-compose.prod.yml` | Production-like stack                              |
| `entrypoint.sh`           | Wait for DB → migrate → seed → start               |

The production runtime deliberately installs only `prisma`, `@prisma/client`,
`tsx` and `argon2` rather than the app's dependency tree — Nitro inlines
everything else into `.output`. Do **not** prune packages from that install to
save space: `effect` looks like test tooling but is a real runtime dependency of
`@prisma/config`, and removing it breaks `migrate deploy` at container start.

## Checklist before finishing

- [ ] `npm run lint` and `npm run typecheck` pass.
- [ ] `npm test` passes, including integration tests against a real database.
- [ ] Money stayed `BigInt`; responses went through `serializeBigInt`.
- [ ] Queries are scoped by `userId`; admin endpoints call `requireRole`.
- [ ] New protected page passes `useApiHeaders()` to `useFetch`.
- [ ] Colours and spacing come from tokens, not literals.
- [ ] Copy is English.
