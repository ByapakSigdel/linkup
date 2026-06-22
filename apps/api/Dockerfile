# syntax=docker/dockerfile:1
# LinkUp API — production image.
# The @linkup/* workspace packages ship TS source (main: ./src/index.ts), so we
# run the API with ts-node (transpile-only) rather than a compiled dist — this is
# how it runs in dev and avoids a brittle monorepo build step. Build context is
# the REPO ROOT (see docker-compose.prod.yml).
FROM node:20-bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@10.15.1 --activate

WORKDIR /app

# Copy the monorepo (node_modules etc. excluded via .dockerignore) and install
# ONLY the API + its workspace deps (skips the web app's heavy deps).
COPY . .
RUN pnpm install --frozen-lockfile --filter "@linkup/api..."

ENV NODE_ENV=production \
    TS_NODE_TRANSPILE_ONLY=true \
    API_PORT=4000

WORKDIR /app/apps/api
EXPOSE 4000

# Liveness: is the API accepting TCP connections? (no endpoint dependency)
HEALTHCHECK --interval=20s --timeout=4s --start-period=45s --retries=5 \
  CMD node -e "require('net').connect(4000,'127.0.0.1').on('connect',()=>process.exit(0)).on('error',()=>process.exit(1))"

CMD ["node","-r","ts-node/register","-r","tsconfig-paths/register","src/main.ts"]
