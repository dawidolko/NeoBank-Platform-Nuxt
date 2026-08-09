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
RUN --mount=type=cache,target=/root/.npm \
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
# Stage 3: production dependencies only
# ---------------------------------------------------------------------------
FROM node:${NODE_VERSION} AS prod-deps

WORKDIR /app

RUN apt-get update -qq \
    && apt-get install --no-install-recommends -y openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY prisma ./prisma

RUN --mount=type=cache,target=/root/.npm \
    npm ci --omit=dev --ignore-scripts \
    && npx prisma generate \
    && npm cache clean --force

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

# Prisma CLI (for `migrate deploy`) and tsx (for the seed script) must exist in
# the runtime image — the entrypoint runs both before booting the server.
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/node_modules/prisma ./node_modules/prisma
COPY --from=build /app/node_modules/.bin/prisma ./node_modules/.bin/prisma
COPY --from=build /app/node_modules/tsx ./node_modules/tsx
COPY --from=build /app/node_modules/.bin/tsx ./node_modules/.bin/tsx
COPY --from=build /app/node_modules/esbuild ./node_modules/esbuild
COPY --from=build /app/node_modules/get-tsconfig ./node_modules/get-tsconfig
COPY --from=build /app/node_modules/resolve-pkg-maps ./node_modules/resolve-pkg-maps

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
