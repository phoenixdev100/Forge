<div align="center">

# Security Policy

</div>

## Reporting a vulnerability

Do **not** open a public issue. Email the maintainer directly with a
description, reproduction steps, and impact. Expect acknowledgement within
a few days.

## What is implemented

**Authentication & sessions**

- Access token: short-lived JWT (`15m`), signed with `JWT_ACCESS_SECRET`
- Refresh token: opaque 48-byte random string - only its SHA-256 hash is
  stored, so a database leak cannot replay it
- Rotation with **reuse detection**: presenting a rotated token revokes the
  entire token family and the user must sign in again
- Cookies are `HttpOnly`, `Secure` in production, `SameSite=Lax`; the
  refresh cookie is path-scoped to `/api/auth`
- Password reset and password change revoke all existing sessions
- `logout-all` signs out every device

**Passwords**

- `bcrypt` cost factor 12
- Login runs a dummy verification when the email doesn't exist, so response
  timing cannot enumerate accounts
- Reset tokens are single-use, hashed in the DB, and expire
  (`RESET_TOKEN_TTL_MINUTES`)
- Emails are normalised to lowercase before lookup/storage

**Rate limiting** (`server/src/middleware/rateLimit.ts`)

- API: 600 req/min keyed by user ID (falls back to IP)
- Credential endpoints: 20 failed attempts per 15 min per IP
- Password reset requests: 5/hour per IP
- Token refresh: 60/min per IP
- Additional **per-account** throttle: 10 failed logins per 15 min per email,
  independent of source IP (botnet-rotation defence)

**Transport & headers**

- Helmet security headers; `x-powered-by` disabled
- CORS is an explicit allowlist with credentials; disallowed origins receive
  no CORS headers (they are never turned into 500s)
- JSON/URL-encoded bodies capped at 1 MB; uploads capped by `MAX_UPLOAD_MB`
- HTTP server timeouts hardened (keep-alive > LB idle, header + request caps)

**Input & data**

- Zod validation on every route's params/query/body; parsed output replaces
  the raw input, so unknown keys are stripped (no mass assignment)
- Prisma parameterised queries throughout - no raw SQL interpolation
- Every authenticated query is scoped by `userId`; admin routes require
  `Role.ADMIN`
- Uploads: admin-only, MIME allowlist **plus** magic-byte verification,
  random UUID filenames

**Errors & logs**

- Production responses never include stack traces or internal details
- Pino redacts authorization headers, cookies, passwords, and tokens
- Structured JSON logs in production; per-request success logs are `debug`-only

## Production checklist (ops)

- [ ] `NODE_ENV=production`, real `CORS_ORIGINS` + `APP_URL`
- [ ] Strong unique `JWT_*_SECRET` values in a secret manager
- [ ] `MAIL_PROVIDER=smtp` + SMTP credentials (reset emails otherwise undelivered)
- [ ] `npm run db:deploy` before `npm start`
- [ ] HTTPS terminated at a trusted single proxy (`trust proxy 1` is set)
- [ ] Multi-instance deployments need a shared rate-limit store (the default
      is in-memory) and shared upload storage (S3/R2)

## Out of scope (by design)

- Email verification on signup - not yet implemented
- CAPTCHA / risk scoring - the per-IP + per-account throttles are the current
  abuse controls
