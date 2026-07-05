# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# showmelove — AdonisJS 6 + better-sqlite3, deployed on Coolify.
#
# Multi-stage build:
#   deps            → all deps (incl. dev) for compiling the app
#   build           → `node ace build` → ./build
#   production-deps → prod-only node_modules (better-sqlite3 compiled for Node 22)
#   runtime         → slim final image, migrations run on boot via entrypoint
# ---------------------------------------------------------------------------

FROM node:22-bookworm-slim AS base
# Toolchain for compiling better-sqlite3's native addon (used as a fallback if
# no prebuilt binary is available for this Node/arch).
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ ca-certificates \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# --- Install all dependencies (for the build) -------------------------------
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

# --- Compile the AdonisJS app ----------------------------------------------
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN node ace build

# --- Install production-only dependencies -----------------------------------
FROM base AS production-deps
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# --- Final runtime image ----------------------------------------------------
FROM base AS runtime

# Sensible defaults — override any of these in Coolify. APP_KEY has no default
# and MUST be provided (generate one with `node ace generate:key`).
ENV NODE_ENV=production \
    PORT=3333 \
    HOST=0.0.0.0 \
    LOG_LEVEL=info \
    SESSION_DRIVER=cookie \
    TZ=UTC

COPY --from=production-deps /app/node_modules ./node_modules
COPY --from=build /app/build ./
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Persist the SQLite database (Lucid + Better Auth share /app/tmp/db.sqlite3).
# Mount a Coolify persistent volume at this path so data survives redeploys.
VOLUME ["/app/tmp"]

EXPOSE 3333

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "bin/server.js"]
