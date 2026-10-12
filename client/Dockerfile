# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# Forge SPA - built by Vite, served by nginx. nginx also reverse-proxies
# /api and /uploads to the `server` service, keeping auth cookies same-site.
# ---------------------------------------------------------------------------

FROM node:20-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

# Vite bakes env values into the bundle at build time. Split-hosting builds
# pass the API origin here; empty keeps requests same-origin (nginx proxies).
ARG VITE_API_URL=""
ENV VITE_API_URL=$VITE_API_URL

COPY . .
RUN npm run build

# ---------------------------------------------------------------------------
FROM nginx:1.27-alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
