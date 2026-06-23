# syntax=docker/dockerfile:1
# LinkUp web (Next.js) — production image. Build context is the REPO ROOT.
# NEXT_PUBLIC_* are inlined at build time, so they're passed as build args.
FROM node:20-bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@10.15.1 --activate

WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile --filter "@linkup/web..."

# Public origin the browser uses to reach the API + socket (same domain).
ARG NEXT_PUBLIC_API_URL=https://linkup.mahansigdel.com.np/api/v1
ARG NEXT_PUBLIC_WS_URL=https://linkup.mahansigdel.com.np
ARG NEXT_PUBLIC_GOOGLE_CLIENT_ID=
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_WS_URL=$NEXT_PUBLIC_WS_URL \
    NEXT_PUBLIC_GOOGLE_CLIENT_ID=$NEXT_PUBLIC_GOOGLE_CLIENT_ID \
    NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    NODE_OPTIONS=--max-old-space-size=1536

RUN pnpm --filter @linkup/web build

WORKDIR /app/apps/web
EXPOSE 3000
CMD ["pnpm", "start", "-p", "3000"]
