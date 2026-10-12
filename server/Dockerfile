# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# Forge API - multi-stage build.
#
#   target: build    -> full toolchain (used by the compose `migrate` service)
#   final stage      -> slim runtime that only runs `node dist/index.js`
# ---------------------------------------------------------------------------

FROM node:20-alpine AS build
WORKDIR /app

# `npm ci` runs postinstall -> `prisma generate`, which evaluates
# prisma.config.ts and therefore needs DATABASE_URL to merely exist. It is a
# build-time placeholder only - generate never opens a connection.
ENV DATABASE_URL="postgresql://build:build@127.0.0.1:5432/build"

COPY package.json package-lock.json prisma.config.ts ./
COPY prisma ./prisma
RUN npm ci

COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npm run build

# ---------------------------------------------------------------------------
# Production dependencies only. Scripts skipped - the generated client is
# already compiled into dist/, so `prisma generate` is not needed here.
# ---------------------------------------------------------------------------
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts

# ---------------------------------------------------------------------------
FROM node:20-alpine
ENV NODE_ENV=production
WORKDIR /app

RUN addgroup -S forge && adduser -S forge -G forge

COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY --from=build /app/dist ./dist

# Local upload storage (object storage is the production-scale answer).
RUN mkdir -p uploads && chown -R forge:forge uploads

USER forge
EXPOSE 4000
CMD ["node", "dist/index.js"]
