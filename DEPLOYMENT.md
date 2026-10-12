<div align="center">

# Deployment runbook

</div>

Forge is two deployables: a **static SPA** (`client/dist`) and a **Node API**
(`server`). They can share one host or live on separate origins.

## Option A - Docker Compose (everything in one command)

```bash
cp .env.example .env        # set DB_PASSWORD + two JWT secrets (+ SMTP)
docker compose up --build   # -> http://localhost:8080
```

- `db` - Postgres 16 with a persistent volume
- `migrate` - one-shot service; runs `prisma migrate deploy` and the API waits
  for it to succeed (`service_completed_successfully`)
- `server` - slim production image serving the API on `:4000` (internal)
- `client` - nginx serving the SPA on `:8080`, reverse-proxying `/api` and
  `/uploads` to the API, so auth cookies stay same-site

Seed demo + admin accounts once, after first boot:

```bash
docker compose exec server npm run db:seed
```

## Option B - Vercel (serverless API)

`server/` is Vercel-ready: `api/index.js` exports the Express app as a
function (no `listen()`), `vercel.json` routes every path to it, and
`vercel-build` compiles `dist/` on deploy.

1. Create a Vercel project with **Root Directory = `server`**.
2. Set env vars in the dashboard (`DATABASE_URL`, `JWT_*_SECRET`,
   `CORS_ORIGINS`, `APP_URL`, `MAIL_PROVIDER` + `SMTP_*`).
   Also set **`DB_POOL_MAX=2`** - serverless instances should hold few
   connections; the Neon/Supabase pooler multiplexes.
3. Deploy: `vercel --prod` or git-push. Migrations are NOT applied by the
   function - run `npm run db:deploy` locally/CI before deploying.

Serverless notes:

- **Uploads land in `/tmp`** (the only writable path) and are per-instance +
  ephemeral. Media upload works, but files vanish - move to S3/R2 before
  relying on admin media.
- Rate limiting + the login throttle are **per-warm-instance** (in-memory).
  Still useful, but not globally enforced.
- `maxDuration` is 30s - the JSON/CSV export is the slowest request.
- `trust proxy 1` matches Vercel's single edge hop; client IPs are correct.

The SPA deploys as a second Vercel project (`client/` root) - see "SPA
hosting notes" below for connecting them. `client/vercel.json` already ships
the SPA fallback, immutable `/assets` caching, and security headers (CSP,
nosniff, frame-deny). If you want the **same-origin proxy** instead of
`VITE_API_URL`, add this rewrite BEFORE the SPA fallback there:

```json
{ "source": "/api/(.*)", "destination": "https://YOUR-API.vercel.app/api/$1" }
```

## Option C - separate hosts (VM / container)

Continue below for the manual build/deploy path.

## 1. Build

```bash
# API
cd server
npm ci
npm run build          # prisma generate + tsc -> dist/

# SPA
cd client
npm ci
npm run build          # tsc -b + vite build -> dist/
```

## 2. Database

```bash
cd server
npm run db:deploy      # applies pending migrations - runs BEFORE traffic
```

Schema changes are versioned under `server/prisma/migrations/`. Never run
`db push` against production - it can drop data silently.

## 3. Environment (`server/.env` equivalent on the host)

Required to boot - startup fails fast if anything is missing or weak:

| Variable | Production value |
| --- | --- |
| `NODE_ENV` | `production` |
| `DATABASE_URL` | Pooled Postgres URL (`sslmode=verify-full`) |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | `crypto.randomBytes(48).toString('base64url')` - unique per env |
| `CORS_ORIGINS` | Your real SPA origin(s), comma-separated |
| `APP_URL` | Your real SPA origin - reset links point here |

Required for features to actually work:

| Variable | Why |
| --- | --- |
| `MAIL_PROVIDER=smtp` + `SMTP_HOST`/`PORT`/`SECURE`/`USER`/`PASS` + `MAIL_FROM` | Without this the server logs a loud warning and **reset emails never arrive**. Gmail: `smtp.gmail.com:465` + an app password |
| `UPLOAD_DIR` / `MAX_UPLOAD_MB` | Upload destination and cap |

Optional: `LOG_LEVEL` (`info` default hides per-request debug logs),
`COOKIE_CROSS_SITE` + `COOKIE_DOMAIN` (only for cross-site HTTPS setups),
`ACCESS_TOKEN_TTL`, `REFRESH_TOKEN_TTL_DAYS`, `RESET_TOKEN_TTL_MINUTES`,
`SHADOW_DATABASE_URL` (direct endpoint for `migrate dev`).

## 4. Run

```bash
cd server
npm start              # node dist/index.js
```

Health probe for the platform: `GET /api/health` → `{ status, database }`.
Graceful shutdown is handled (SIGTERM drains, 10s force-exit).

## 5. SPA hosting notes

Serve `client/dist` statically. Add `Content-Security-Policy` at the host -
it is deliberately off on the API (the SPA owns its CSP).

### Connecting SPA to API - pick one

**Same-origin via path rewrite (recommended).** Configure the SPA host to
proxy `/api/*` (and `/uploads/*`) to the API origin. Every static host does
this: Vercel `rewrites`, Netlify `_redirects`/`netlify.toml`, Cloudflare
snippets, nginx `proxy_pass`. Auth cookies stay `SameSite=Lax`, zero code
config - this is what the dev proxy and docker nginx already do.

```toml
# netlify.toml example
[[redirects]]
  from = "/api/*"
  to = "https://api.example.com/api/:splat"
  status = 200
  force = true
```

**Cross-origin (split domains).** Build the SPA with `VITE_API_URL` pointing
at the API; it is baked into the bundle at build time:

```bash
# client/.env or build env
VITE_API_URL="https://api.example.com"

# docker build
docker compose build --build-arg ...  # or set VITE_API_URL in .env
```

Server side then needs:

```env
CORS_ORIGINS="https://app.example.com"
APP_URL="https://app.example.com"
COOKIE_CROSS_SITE="true"    # SameSite=None + Secure cookies
# both origins MUST be HTTPS - browsers drop SameSite=None cookies on http
```

Note: the service worker skips cross-origin requests, so the offline
last-loaded-data fallback only covers the same-origin setup.

## 6. Scaling notes

- **One instance works out of the box.** The rate limiter is in-memory and
  uploads land on local disk - both are per-instance.
- **Multiple instances** need a shared rate-limit store (e.g.
  `rate-limit-redis`) and object storage for uploads (S3/R2 + CDN).
- `trust proxy` is set to `1` - correct for a single load balancer / platform
  router in front. Keep it that way.
- Prisma pool: 10 connections in production (`server/src/db/prisma.ts`) -
  size against your Postgres plan.

## 7. Deploy checklist

- [ ] `npm run build` clean on both projects
- [ ] `npm run db:deploy` applied
- [ ] `/api/health` returns `database: "up"`
- [ ] `Set-Cookie` on login shows `Secure; HttpOnly; SameSite=Lax`
- [ ] A disallowed `Origin:` gets no `Access-Control-Allow-Origin` header
- [ ] `forgot-password` actually delivers email (SMTP configured)
