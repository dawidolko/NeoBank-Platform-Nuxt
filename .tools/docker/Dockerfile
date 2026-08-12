# syntax=docker/dockerfile:1.7
#
# NeoBank production image.
#
# Multi-stage: dependencies -> build -> runtime. The final stage carries only
# the Nitro output, production node_modules and the Prisma engine, so it never
# ships source or dev tooling.

ARG NODE_VERSION=22-bookworm-slim

# ---------------------------------------------------------------------------
# Stage 1: full dependency tree (dev deps included — needed to build)
# ---------------------------------------------------------------------------
FROM node:${NODE_VERSION} AS deps

WORKDIR /app

# openssl is a Prisma engine runtime requirement on slim images.
RUN apt-get update -qq \
    && apt-get install --no-install-recommends -y openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY prisma ./prisma

# `npm ci` runs postinstall, which needs the schema present (copied above).
RUN --mount=type=cache,id=npm-build,target=/root/.npm,sharing=locked \
    npm ci --ignore-scripts \
    && npx prisma generate

# ---------------------------------------------------------------------------
# Stage 2: build the Nuxt application
# ---------------------------------------------------------------------------
FROM deps AS build

WORKDIR /app

COPY . .

# Nuxt requires a DATABASE_URL to be *parseable* at build time even though no
# connection is opened; the real value is injected at runtime.
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build?schema=public"
ENV NODE_ENV=production

RUN npx nuxt build

# ---------------------------------------------------------------------------
# Stage 3: runtime dependencies only
# ---------------------------------------------------------------------------
# Nitro inlines every application dependency into `.output`, so the runtime does
# NOT need the app's dependency tree. `npm ci --omit=dev` would still drag in
# Nuxt, TypeScript, Babel and the bundlers (~500 MB) because they are runtime
# `dependencies` at build time. Instead, install only the two tools the
# entrypoint itself shells out to: prisma (migrate deploy) and tsx (seed).
FROM node:${NODE_VERSION} AS prod-deps

WORKDIR /app

RUN apt-get update -qq \
    && apt-get install --no-install-recommends -y openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY prisma ./prisma

# Pinned to the versions resolved in package.json to keep builds reproducible.
RUN --mount=type=cache,id=npm-runtime,target=/root/.npm,sharing=locked \
    npm init -y > /dev/null \
    && npm install --no-audit --no-fund \
        prisma@^6.3.1 \
        @prisma/client@^6.3.1 \
        tsx@^4.19.2 \
        argon2@^0.41.1 \
    && npx prisma generate \
    # Strip only inert files. Do NOT prune packages here: `effect` looks like
    # test tooling but is a real runtime dependency of @prisma/config, and
    # removing it breaks `prisma migrate deploy` at container start.
    && find node_modules -name '*.md' -delete \
    && find node_modules -name '*.map' -delete \
    && rm -rf node_modules/.cache

# ---------------------------------------------------------------------------
# Stage 4: runtime
# ---------------------------------------------------------------------------
FROM node:${NODE_VERSION} AS runtime

WORKDIR /app

RUN apt-get update -qq \
    && apt-get install --no-install-recommends -y openssl ca-certificates curl \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production \
    NUXT_HOST=0.0.0.0 \
    NUXT_PORT=3000 \
    PORT=3000

# Only the entrypoint's own tooling (prisma migrate + tsx seed). The server
# itself runs entirely from the self-contained Nitro bundle in .output.
COPY --from=prod-deps /app/node_modules ./node_modules

COPY --from=build /app/.output ./.output
COPY package.json ./
COPY prisma ./prisma
COPY .tools/docker/entrypoint.sh /usr/local/bin/entrypoint.sh

RUN chmod +x /usr/local/bin/entrypoint.sh \
    && chown -R node:node /app

USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
    CMD curl -fsS http://127.0.0.1:3000/api/health || exit 1

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["node", ".output/server/index.mjs"]
